import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueEvents } from 'bullmq';
import Redis from 'ioredis';

interface QueueStats {
  completed: number;
  failed: number;
  lastUpdated: Date | null;
}

@Injectable()
export class StatsService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;
  private queueEventListeners: QueueEvents[] = [];
  private readonly STATS_PREFIX = 'immich-admin:stats';

  // Known Immich queue names
  private readonly QUEUE_NAMES = [
    'thumbnailGeneration',
    'metadataExtraction',
    'videoConversion',
    'smartSearch',
    'storageTemplateMigration',
    'migration',
    'backgroundTask',
    'search',
    'duplicateDetection',
    'faceDetection',
    'facialRecognition',
    'sidecar',
    'library',
    'notifications',
    'backupDatabase',
    'ocr',
    'workflow',
  ];

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('redis.url');
    if (!redisUrl) {
      console.warn('[StatsService] Redis URL not configured, stats tracking disabled');
      return;
    }

    try {
      // Create Redis connection for storing stats
      this.redis = new Redis(redisUrl);

      console.log('[StatsService] Connecting to Redis for job event tracking...');

      // Parse Redis URL for BullMQ connection options
      const url = new URL(redisUrl);
      const connectionOptions = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
      };

      // Create QueueEvents listeners for each queue
      for (const queueName of this.QUEUE_NAMES) {
        try {
          const queueEvents = new QueueEvents(queueName, {
            connection: connectionOptions,
            prefix: 'immich_bull', // Immich uses 'immich_bull' prefix
          });

          // Listen for completed events
          queueEvents.on('completed', async () => {
            await this.incrementStat(queueName, 'completed');
          });

          // Listen for failed events
          queueEvents.on('failed', async () => {
            await this.incrementStat(queueName, 'failed');
          });

          // Listen for errors
          queueEvents.on('error', (err) => {
            console.error(`[StatsService] Error on ${queueName}:`, err.message);
          });

          this.queueEventListeners.push(queueEvents);
        } catch (err) {
          console.warn(`[StatsService] Failed to create listener for queue ${queueName}:`, err);
        }
      }

      console.log(`[StatsService] Listening to BullMQ events for ${this.queueEventListeners.length} queues`);
    } catch (error) {
      console.error('[StatsService] Failed to initialize:', error);
    }
  }

  async onModuleDestroy() {
    // Close all queue event listeners
    for (const queueEvents of this.queueEventListeners) {
      await queueEvents.close();
    }
    this.queueEventListeners = [];

    if (this.redis) {
      await this.redis.quit();
    }
  }

  private async incrementStat(queueName: string, stat: 'completed' | 'failed') {
    if (!this.redis) return;

    try {
      const key = `${this.STATS_PREFIX}:${queueName}:${stat}`;
      await this.redis.incr(key);

      // Update last updated timestamp
      const timestampKey = `${this.STATS_PREFIX}:${queueName}:lastUpdated`;
      await this.redis.set(timestampKey, new Date().toISOString());
    } catch (error) {
      // Silently fail to avoid spam
    }
  }

  async getQueueStats(queueName: string): Promise<QueueStats> {
    if (!this.redis) {
      return { completed: 0, failed: 0, lastUpdated: null };
    }

    try {
      const [completed, failed, lastUpdated] = await Promise.all([
        this.redis.get(`${this.STATS_PREFIX}:${queueName}:completed`),
        this.redis.get(`${this.STATS_PREFIX}:${queueName}:failed`),
        this.redis.get(`${this.STATS_PREFIX}:${queueName}:lastUpdated`),
      ]);

      return {
        completed: parseInt(completed || '0', 10),
        failed: parseInt(failed || '0', 10),
        lastUpdated: lastUpdated ? new Date(lastUpdated) : null,
      };
    } catch (error) {
      console.error('[StatsService] Failed to get queue stats:', error);
      return { completed: 0, failed: 0, lastUpdated: null };
    }
  }

  async getAllStats(): Promise<Record<string, QueueStats>> {
    const stats: Record<string, QueueStats> = {};

    for (const queueName of this.QUEUE_NAMES) {
      stats[queueName] = await this.getQueueStats(queueName);
    }

    return stats;
  }

  async resetQueueStats(queueName: string): Promise<void> {
    if (!this.redis) return;

    try {
      await Promise.all([
        this.redis.del(`${this.STATS_PREFIX}:${queueName}:completed`),
        this.redis.del(`${this.STATS_PREFIX}:${queueName}:failed`),
        this.redis.del(`${this.STATS_PREFIX}:${queueName}:lastUpdated`),
      ]);
      console.log(`[StatsService] Reset stats for queue: ${queueName}`);
    } catch (error) {
      console.error('[StatsService] Failed to reset queue stats:', error);
    }
  }

  async resetAllStats(): Promise<void> {
    for (const queueName of this.QUEUE_NAMES) {
      await this.resetQueueStats(queueName);
    }
    console.log('[StatsService] Reset all stats');
  }
}
