import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  Person,
  BulkIdResult,
  ImmichPeopleResponse,
  PersonStatistics,
} from '../people/people.types';

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

  async getPeople(withHidden = true): Promise<Person[]> {
    const response = await this.fetch<ImmichPeopleResponse>(
      `/api/people?withHidden=${withHidden}`,
    );

    if (!response) {
      return [];
    }

    return response.people || [];
  }

  async mergePeople(primaryId: string, ids: string[]): Promise<BulkIdResult[]> {
    const response = await this.fetch<BulkIdResult[]>(
      `/api/people/${primaryId}/merge`,
      {
        method: 'POST',
        body: JSON.stringify({ ids }),
      },
    );

    return response || [];
  }

  async getPersonThumbnail(id: string): Promise<Buffer | null> {
    const url = `${this.apiUrl}/api/people/${id}/thumbnail`;

    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        console.error(
          `[ImmichApiService] Thumbnail error: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(
        `[ImmichApiService] Thumbnail request failed for ${id}:`,
        error,
      );
      return null;
    }
  }

  async getPersonStatistics(id: string): Promise<PersonStatistics | null> {
    return this.fetch<PersonStatistics>(`/api/people/${id}/statistics`);
  }

  async getPeopleWithCounts(withHidden = true): Promise<Person[]> {
    const people = await this.getPeople(withHidden);

    // Fetch statistics for all people in parallel (batched)
    const BATCH_SIZE = 20;
    const results: Person[] = [];

    for (let i = 0; i < people.length; i += BATCH_SIZE) {
      const batch = people.slice(i, i + BATCH_SIZE);
      const batchWithCounts = await Promise.all(
        batch.map(async (person) => {
          const stats = await this.getPersonStatistics(person.id);
          return {
            ...person,
            assetCount: stats?.assets,
          };
        }),
      );
      results.push(...batchWithCounts);
    }

    return results;
  }
}
