import { Controller, Get, Post, Param } from '@nestjs/common';
import { StatsService } from './stats.service';

interface QueueStats {
  completed: number;
  failed: number;
  lastUpdated: Date | null;
}

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  async getAllStats(): Promise<Record<string, QueueStats>> {
    return this.statsService.getAllStats();
  }

  @Get(':queueName')
  async getQueueStats(
    @Param('queueName') queueName: string,
  ): Promise<QueueStats> {
    return this.statsService.getQueueStats(queueName);
  }

  @Post(':queueName/reset')
  async resetQueueStats(
    @Param('queueName') queueName: string,
  ): Promise<{ success: boolean }> {
    await this.statsService.resetQueueStats(queueName);
    return { success: true };
  }

  @Post('reset-all')
  async resetAllStats(): Promise<{ success: boolean }> {
    await this.statsService.resetAllStats();
    return { success: true };
  }
}
