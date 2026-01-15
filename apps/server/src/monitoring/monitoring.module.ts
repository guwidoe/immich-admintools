import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { MonitoringController } from './monitoring.controller';

@Module({
  imports: [ConfigModule],
  controllers: [MonitoringController],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class MonitoringModule {}
