import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImmichApiService, ImmichQueue } from '../immich/immich-api.service';
import { RedisService } from '../redis/redis.service';
import { StatsService } from '../stats/stats.service';

export interface ExtendedQueueInfo extends ImmichQueue {
  stuckJobs: StuckJob[];
  trackedStats: {
    completed: number;
    failed: number;
    lastUpdated: Date | null;
  };
}

export interface StuckJob {
  jobId: string;
  ageSeconds: number;
}

export interface JobInfo {
  id: string;
  name: string;
  data: Record<string, unknown>;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  attemptsMade: number;
}

export interface JobsResponse {
  jobs: JobInfo[];
  total: number;
}

@Injectable()
export class QueuesService {
  constructor(
    private readonly immichApi: ImmichApiService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly statsService: StatsService,
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

  async getJobs(
    queueName: string,
    state: 'waiting' | 'active' | 'failed' | 'delayed',
    page = 0,
    pageSize = 50,
  ): Promise<JobsResponse> {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    const [rawJobs, total] = await Promise.all([
      this.redis.getJobsByState(queueName, state, start, end),
      this.redis.getJobCountByState(queueName, state),
    ]);

    const jobs: JobInfo[] = rawJobs.map((job) => {
      let parsedData: Record<string, unknown> = {};
      try {
        if (job.data.data) {
          parsedData = JSON.parse(job.data.data);
        }
      } catch {
        // Keep empty object if parse fails
      }

      return {
        id: job.jobId,
        name: job.data.name || 'unknown',
        data: parsedData,
        timestamp: parseInt(job.data.timestamp || '0', 10),
        processedOn: job.data.processedOn
          ? parseInt(job.data.processedOn, 10)
          : undefined,
        finishedOn: job.data.finishedOn
          ? parseInt(job.data.finishedOn, 10)
          : undefined,
        failedReason: job.data.failedReason || undefined,
        attemptsMade: parseInt(job.data.attemptsMade || '0', 10),
      };
    });

    return { jobs, total };
  }

  async clearStuckJobs(name: string): Promise<number> {
    // Skip excluded queues (e.g., backup-database can legitimately run for hours)
    if (this.isQueueExcluded(name)) {
      console.log(`[QueuesService] Skipping stuck job detection for excluded queue: ${name}`);
      return 0;
    }

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
    const stuckJobs: StuckJob[] = [];

    // Skip stuck job detection for excluded queues (e.g., backup-database)
    if (!this.isQueueExcluded(queue.name)) {
      const threshold = this.getStuckThreshold(queue.name);
      const activeJobIds = await this.redis.getActiveJobIds(queue.name);

      for (const jobId of activeJobIds) {
        const ageSeconds = await this.redis.getJobAge(queue.name, jobId);

        if (ageSeconds !== null && ageSeconds > threshold) {
          stuckJobs.push({ jobId, ageSeconds });
        }
      }
    }

    // Get tracked stats from our StatsService
    const trackedStats = await this.statsService.getQueueStats(queue.name);

    return {
      ...queue,
      stuckJobs,
      trackedStats,
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

  private isQueueExcluded(queueName: string): boolean {
    const excludedQueues = this.configService.get<string[]>('autoHeal.excludedQueues', []);
    return excludedQueues.includes(queueName);
  }
}
