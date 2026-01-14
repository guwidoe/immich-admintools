import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImmichApiService, ImmichQueue } from '../immich/immich-api.service';
import { RedisService } from '../redis/redis.service';

export interface ExtendedQueueInfo extends ImmichQueue {
  stuckJobs: StuckJob[];
}

export interface StuckJob {
  jobId: string;
  ageSeconds: number;
}

@Injectable()
export class QueuesService {
  constructor(
    private readonly immichApi: ImmichApiService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async getAllQueues(): Promise<ExtendedQueueInfo[]> {
    const queues = await this.immichApi.getQueues();

    const extendedQueues = await Promise.all(
      queues.map(async (queue) => this.extendQueueInfo(queue)),
    );

    return extendedQueues;
  }

  async getQueue(name: string): Promise<ExtendedQueueInfo | null> {
    const queues = await this.immichApi.getQueues();
    const queue = queues.find((q) => q.name === name);

    if (!queue) {
      return null;
    }

    return this.extendQueueInfo(queue);
  }

  async pauseQueue(name: string): Promise<boolean> {
    return this.immichApi.pauseQueue(name);
  }

  async resumeQueue(name: string): Promise<boolean> {
    return this.immichApi.resumeQueue(name);
  }

  async clearStuckJobs(name: string): Promise<number> {
    const threshold = this.getStuckThreshold(name);
    const activeJobIds = await this.redis.getActiveJobIds(name);

    let clearedCount = 0;

    for (const jobId of activeJobIds) {
      const ageSeconds = await this.redis.getJobAge(name, jobId);

      if (ageSeconds !== null && ageSeconds > threshold) {
        const removed = await this.redis.removeActiveJob(name, jobId);
        if (removed) {
          clearedCount++;
          console.log(`[QueuesService] Cleared stuck job ${name}:${jobId} (age: ${ageSeconds}s)`);
        }
      }
    }

    return clearedCount;
  }

  private async extendQueueInfo(queue: ImmichQueue): Promise<ExtendedQueueInfo> {
    const threshold = this.getStuckThreshold(queue.name);
    const activeJobIds = await this.redis.getActiveJobIds(queue.name);

    const stuckJobs: StuckJob[] = [];

    for (const jobId of activeJobIds) {
      const ageSeconds = await this.redis.getJobAge(queue.name, jobId);

      if (ageSeconds !== null && ageSeconds > threshold) {
        stuckJobs.push({ jobId, ageSeconds });
      }
    }

    return {
      ...queue,
      stuckJobs,
    };
  }

  private getStuckThreshold(queueName: string): number {
    const thresholds = this.configService.get<Record<string, number>>('autoHeal.thresholds', {});

    // Convert queue name to threshold key (e.g., 'face-detection' -> 'faceDetection')
    const normalizedName = queueName
      .split('-')
      .map((part, index) =>
        index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
      )
      .join('');

    return thresholds[normalizedName] ?? thresholds['default'] ?? 300;
  }
}
