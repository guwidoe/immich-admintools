import { Module, Global } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Global()
@Module({
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
