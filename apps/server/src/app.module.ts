import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import configuration from './config/configuration';
import { QueuesModule } from './queues/queues.module';
import { RedisModule } from './redis/redis.module';
import { ImmichModule } from './immich/immich.module';
import { HealthModule } from './health/health.module';
import { WebsocketModule } from './websocket/websocket.module';
import { StatsModule } from './stats/stats.module';
import { PeopleModule } from './people/people.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Look for .env in monorepo root
      envFilePath: [
        join(__dirname, '..', '..', '..', '.env'), // apps/server/dist -> apps/server -> apps -> root
        join(process.cwd(), '..', '..', '.env'), // From apps/server cwd -> root (turbo)
        '.env',
      ],
    }),
    RedisModule,
    ImmichModule,
    SettingsModule,
    StatsModule,
    QueuesModule,
    HealthModule,
    WebsocketModule,
    PeopleModule,
    MonitoringModule,
  ],
})
export class AppModule {}
