import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';
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

// Resolve the web build directory:
// - Docker/runtime build: /app/apps/web/build (from __dirname = /app/apps/server/dist)
// - Local production build: <repo>/apps/web/build
// - Dev: not used (Vite dev server proxies /api)
const webBuildPath = process.env.WEB_DIR || join(__dirname, '..', '..', 'web', 'build');
const serveStatic = existsSync(webBuildPath);

const conditionalImports = serveStatic
  ? [
      ServeStaticModule.forRoot({
        rootPath: webBuildPath,
        // Express 5 / path-to-regexp v8 require named wildcards.
        // Keep /api routes owned by NestJS while serving the SPA elsewhere.
        exclude: ['/api/{*path}'],
      }),
    ]
  : [];

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
    ...conditionalImports,
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
