import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { ImmichApiService } from '../immich/immich-api.service';
import { SettingsService } from '../settings/settings.service';

export interface HealthStatus {
  redis: boolean;
  immich: boolean;
  status: 'ok' | 'degraded' | 'error';
}

export interface SettingsResponse {
  connection: {
    immichUrl: string;
    immichConnected: boolean;
    redisUrl: string;
    redisConnected: boolean;
  };
  thresholds: {
    default: number;
    faceDetection: number;
    facialRecognition: number;
    thumbnailGeneration: number;
    metadataExtraction: number;
    videoConversion: number;
  };
  autoHeal: {
    enabled: boolean;
    intervalSeconds: number;
  };
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly immichApi: ImmichApiService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get()
  async getHealth(): Promise<HealthStatus> {
    const [redisConnected, immichConnected] = await Promise.all([
      this.redis.isConnected(),
      this.immichApi.isConnected(),
    ]);

    let status: 'ok' | 'degraded' | 'error';

    if (redisConnected && immichConnected) {
      status = 'ok';
    } else if (redisConnected || immichConnected) {
      status = 'degraded';
    } else {
      status = 'error';
    }

    return {
      redis: redisConnected,
      immich: immichConnected,
      status,
    };
  }

  @Get('settings')
  async getSettings(): Promise<SettingsResponse> {
    const [redisConnected, immichConnected] = await Promise.all([
      this.redis.isConnected(),
      this.immichApi.isConnected(),
    ]);

    const settings = this.settingsService.getSettings();

    return {
      connection: {
        immichUrl: this.configService.get<string>('immich.apiUrl', ''),
        immichConnected,
        redisUrl: this.configService.get<string>('redis.url', ''),
        redisConnected,
      },
      thresholds: settings.thresholds,
      autoHeal: settings.autoHeal,
    };
  }
}
