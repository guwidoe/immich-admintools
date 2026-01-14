import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ImmichQueue {
  name: string;
  isActive: boolean;
  isPaused: boolean;
  jobCounts: {
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    waiting: number;
    paused: number;
  };
}

export interface ImmichServerInfo {
  major: number;
  minor: number;
  patch: number;
}

@Injectable()
export class ImmichApiService implements OnModuleInit {
  private apiUrl: string = '';
  private apiKey: string = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.apiUrl = this.configService.get<string>('immich.apiUrl', 'http://localhost:2283');
    this.apiKey = this.configService.get<string>('immich.apiKey', '');

    console.log(`[ImmichApiService] Configured for Immich API at ${this.apiUrl}`);

    if (!this.apiKey) {
      console.warn('[ImmichApiService] No API key configured - some operations may fail');
    }
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    const url = `${this.apiUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        console.error(`[ImmichApiService] API error: ${response.status} ${response.statusText}`);
        return null;
      }

      return await response.json() as T;
    } catch (error) {
      console.error(`[ImmichApiService] Request failed for ${endpoint}:`, error);
      return null;
    }
  }

  async getServerInfo(): Promise<ImmichServerInfo | null> {
    return this.fetch<ImmichServerInfo>('/api/server/version');
  }

  async isConnected(): Promise<boolean> {
    try {
      const info = await this.getServerInfo();
      return info !== null && typeof info.major === 'number';
    } catch {
      return false;
    }
  }

  async getQueues(): Promise<ImmichQueue[]> {
    const response = await this.fetch<Record<string, { queueStatus: { isPaused: boolean; isActive: boolean }; jobCounts: ImmichQueue['jobCounts'] }>>('/api/jobs');

    if (!response) {
      return [];
    }

    // Transform the jobs object into an array with names
    return Object.entries(response).map(([name, queue]) => ({
      name,
      isActive: queue.queueStatus.isActive,
      isPaused: queue.queueStatus.isPaused,
      jobCounts: queue.jobCounts,
    }));
  }

  async pauseQueue(name: string): Promise<boolean> {
    const response = await this.fetch<{ success: boolean }>(`/api/jobs/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ command: 'pause' }),
    });

    return response !== null;
  }

  async resumeQueue(name: string): Promise<boolean> {
    const response = await this.fetch<{ success: boolean }>(`/api/jobs/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ command: 'resume' }),
    });

    return response !== null;
  }
}
