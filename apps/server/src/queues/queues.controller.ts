import { Controller, Get, Post, Param } from '@nestjs/common';
import { QueuesService, ExtendedQueueInfo } from './queues.service';

@Controller('queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get()
  async getQueues(): Promise<ExtendedQueueInfo[]> {
    return this.queuesService.getAllQueues();
  }

  @Get(':name')
  async getQueue(@Param('name') name: string): Promise<ExtendedQueueInfo | null> {
    return this.queuesService.getQueue(name);
  }

  @Post(':name/pause')
  async pauseQueue(@Param('name') name: string): Promise<{ success: boolean }> {
    const success = await this.queuesService.pauseQueue(name);
    return { success };
  }

  @Post(':name/resume')
  async resumeQueue(@Param('name') name: string): Promise<{ success: boolean }> {
    const success = await this.queuesService.resumeQueue(name);
    return { success };
  }

  @Post(':name/clear-stuck')
  async clearStuckJobs(@Param('name') name: string): Promise<{ cleared: number }> {
    const cleared = await this.queuesService.clearStuckJobs(name);
    return { cleared };
  }
}
