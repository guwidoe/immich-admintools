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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [join(__dirname, '..', '..', '..', '.env'), '.env'],
    }),
    RedisModule,
    ImmichModule,
    StatsModule,
    QueuesModule,
    HealthModule,
    WebsocketModule,
    PeopleModule,
  ],
})
export class AppModule {}
