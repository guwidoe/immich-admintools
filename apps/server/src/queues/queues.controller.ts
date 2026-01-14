import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { QueuesService, ExtendedQueueInfo, JobsResponse } from './queues.service';

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

  @Get(':name/jobs')
  async getJobs(
    @Param('name') name: string,
    @Query('state') state: 'waiting' | 'active' | 'failed' | 'delayed' = 'waiting',
    @Query('page') page = '0',
    @Query('pageSize') pageSize = '50',
  ): Promise<JobsResponse> {
    return this.queuesService.getJobs(
      name,
      state,
      parseInt(page, 10),
      parseInt(pageSize, 10),
    );
  }
}
