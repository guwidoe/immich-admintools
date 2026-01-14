import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { ImmichApiService } from '../immich/immich-api.service';

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

    return {
      connection: {
        immichUrl: this.configService.get<string>('immich.apiUrl', ''),
        immichConnected,
        redisUrl: this.configService.get<string>('redis.url', ''),
        redisConnected,
      },
      thresholds: {
        default: this.configService.get<number>('autoHeal.thresholds.default', 300),
        faceDetection: this.configService.get<number>('autoHeal.thresholds.faceDetection', 300),
        facialRecognition: this.configService.get<number>('autoHeal.thresholds.facialRecognition', 300),
        thumbnailGeneration: this.configService.get<number>('autoHeal.thresholds.thumbnailGeneration', 120),
        metadataExtraction: this.configService.get<number>('autoHeal.thresholds.metadataExtraction', 180),
        videoConversion: this.configService.get<number>('autoHeal.thresholds.videoConversion', 1800),
      },
      autoHeal: {
        enabled: this.configService.get<boolean>('autoHeal.enabled', false),
        intervalSeconds: this.configService.get<number>('autoHeal.checkIntervalSeconds', 60),
      },
    };
  }
}
