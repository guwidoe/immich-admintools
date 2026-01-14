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
      // BullMQ stores active jobs in bull:<queueName>:active
      const activeKey = `bull:${queueName}:active`;
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
      // BullMQ stores job data in bull:<queueName>:<jobId>
      const jobKey = `bull:${queueName}:${jobId}`;
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
      const jobKey = `bull:${queueName}:${jobId}`;
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
      const activeKey = `bull:${queueName}:active`;
      const removed = await this.client.lrem(activeKey, 1, jobId);
      return removed > 0;
    } catch (error) {
      console.error(`[RedisService] Error removing active job ${queueName}:${jobId}:`, error);
      return false;
    }
  }
}
