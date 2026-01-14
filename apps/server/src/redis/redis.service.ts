import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('redis.url', 'redis://localhost:6379');

    console.log(`[RedisService] Connecting to Redis at ${redisUrl}...`);

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await this.client.connect();
      console.log('[RedisService] Successfully connected to Redis');
    } catch (error) {
      console.error('[RedisService] Failed to connect to Redis:', error);
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      console.log('[RedisService] Disconnected from Redis');
    }
  }

  async isConnected(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  async getActiveJobIds(queueName: string): Promise<string[]> {
    if (!this.client) {
      return [];
    }
    try {
      // BullMQ stores active jobs in immich_bull:<queueName>:active
      const activeKey = `immich_bull:${queueName}:active`;
      const jobIds = await this.client.lrange(activeKey, 0, -1);
      return jobIds;
    } catch (error) {
      console.error(`[RedisService] Error getting active jobs for ${queueName}:`, error);
      return [];
    }
  }

  async getJobData(queueName: string, jobId: string): Promise<object | null> {
    if (!this.client) {
      return null;
    }
    try {
      // BullMQ stores job data in immich_bull:<queueName>:<jobId>
      const jobKey = `immich_bull:${queueName}:${jobId}`;
      const data = await this.client.hgetall(jobKey);
      return Object.keys(data).length > 0 ? data : null;
    } catch (error) {
      console.error(`[RedisService] Error getting job data for ${queueName}:${jobId}:`, error);
      return null;
    }
  }

  async getJobAge(queueName: string, jobId: string): Promise<number | null> {
    if (!this.client) {
      return null;
    }
    try {
      const jobKey = `immich_bull:${queueName}:${jobId}`;
      const processedOn = await this.client.hget(jobKey, 'processedOn');

      if (!processedOn) {
        return null;
      }

      const processedTime = parseInt(processedOn, 10);
      const ageMs = Date.now() - processedTime;
      return Math.floor(ageMs / 1000); // Return age in seconds
    } catch (error) {
      console.error(`[RedisService] Error getting job age for ${queueName}:${jobId}:`, error);
      return null;
    }
  }

  async removeActiveJob(queueName: string, jobId: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      const activeKey = `immich_bull:${queueName}:active`;
      const removed = await this.client.lrem(activeKey, 1, jobId);
      return removed > 0;
    } catch (error) {
      console.error(`[RedisService] Error removing active job ${queueName}:${jobId}:`, error);
      return false;
    }
  }

  async getJobsByState(
    queueName: string,
    state: 'waiting' | 'active' | 'failed' | 'delayed',
    start = 0,
    end = 49,
  ): Promise<{ jobId: string; data: Record<string, string> }[]> {
    if (!this.client) {
      return [];
    }

    try {
      const prefix = `immich_bull:${queueName}`;
      let jobIds: string[] = [];

      if (state === 'waiting') {
        // Waiting jobs are stored in a list
        jobIds = await this.client.lrange(`${prefix}:wait`, start, end);
      } else if (state === 'active') {
        // Active jobs are stored in a list
        jobIds = await this.client.lrange(`${prefix}:active`, start, end);
      } else if (state === 'failed') {
        // Failed jobs are stored in a sorted set
        jobIds = await this.client.zrange(`${prefix}:failed`, start, end);
      } else if (state === 'delayed') {
        // Delayed jobs are stored in a sorted set
        jobIds = await this.client.zrange(`${prefix}:delayed`, start, end);
      }

      // Fetch job data for each job
      const jobs = await Promise.all(
        jobIds.map(async (jobId) => {
          const data = await this.client!.hgetall(`${prefix}:${jobId}`);
          return { jobId, data };
        }),
      );

      return jobs.filter((job) => Object.keys(job.data).length > 0);
    } catch (error) {
      console.error(`[RedisService] Error getting ${state} jobs for ${queueName}:`, error);
      return [];
    }
  }

  async getJobCountByState(
    queueName: string,
    state: 'waiting' | 'active' | 'failed' | 'delayed',
  ): Promise<number> {
    if (!this.client) {
      return 0;
    }

    try {
      const prefix = `immich_bull:${queueName}`;

      if (state === 'waiting') {
        return await this.client.llen(`${prefix}:wait`);
      } else if (state === 'active') {
        return await this.client.llen(`${prefix}:active`);
      } else if (state === 'failed') {
        return await this.client.zcard(`${prefix}:failed`);
      } else if (state === 'delayed') {
        return await this.client.zcard(`${prefix}:delayed`);
      }

      return 0;
    } catch (error) {
      console.error(`[RedisService] Error getting ${state} count for ${queueName}:`, error);
      return 0;
    }
  }
}
