import { Module, Global } from '@nestjs/common';
import { StatsService } from './stats.service';

@Global()
@Module({
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
