import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  Person,
  BulkIdResult,
  ImmichPeopleResponse,
  PersonStatistics,
  FaceWithAsset,
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
    return this.getPeopleWithProgress(withHidden);
  }

  async getPeopleWithProgress(
    withHidden = true,
    onProgress?: (progress: { type: string; loaded: number; total: number; page: number }) => void,
  ): Promise<Person[]> {
    const allPeople: Person[] = [];
    let page = 1;
    const pageSize = 1000; // Max allowed by Immich API
    let totalPeople = 0;

    console.log(`[ImmichApiService] Fetching people (withHidden: ${withHidden})`);

    while (true) {
      const response = await this.fetch<ImmichPeopleResponse>(
        `/api/people?withHidden=${withHidden}&page=${page}&size=${pageSize}`,
      );

      if (!response || !response.people) {
        console.error(`[ImmichApiService] Failed to fetch page ${page}`);
        break;
      }

      if (page === 1) {
        totalPeople = response.total;
        console.log(`[ImmichApiService] Total people in Immich: ${totalPeople}`);
      }

      console.log(`[ImmichApiService] Page ${page}: fetched ${response.people.length} people`);
      allPeople.push(...response.people);

      // Report progress
      if (onProgress) {
        onProgress({
          type: 'progress',
          loaded: allPeople.length,
          total: totalPeople,
          page,
        });
      }

      // Check if we have all people
      if (allPeople.length >= totalPeople || response.people.length < pageSize) {
        break;
      }

      page++;
    }

    console.log(`[ImmichApiService] Total fetched: ${allPeople.length}/${totalPeople} people`);
    return allPeople;
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

  async getPersonFaces(personId: string): Promise<FaceWithAsset[]> {
    // Use the search/metadata endpoint with personIds to get assets containing this person
    interface SearchAssetItem {
      id: string;
    }

    interface SearchMetadataResponse {
      assets: {
        items: SearchAssetItem[];
        count: number;
        total: number;
        nextPage: string | null;
      };
    }

    // Response from GET /faces?id={assetId}
    interface AssetFaceResponse {
      id: string;
      boundingBoxX1: number;
      boundingBoxX2: number;
      boundingBoxY1: number;
      boundingBoxY2: number;
      imageWidth: number;
      imageHeight: number;
      person: {
        id: string;
        name: string;
      } | null;
    }

    const response = await this.fetch<SearchMetadataResponse>(
      `/api/search/metadata`,
      {
        method: 'POST',
        body: JSON.stringify({
          personIds: [personId],
          size: 100,
        }),
      },
    );

    if (!response || !response.assets || !response.assets.items) {
      return [];
    }

    // For each asset, fetch the faces and find the one belonging to this person
    const faces: FaceWithAsset[] = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < response.assets.items.length; i += BATCH_SIZE) {
      const batch = response.assets.items.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (asset) => {
          const assetFaces = await this.fetch<AssetFaceResponse[]>(
            `/api/faces?id=${asset.id}`,
          );

          if (!assetFaces) {
            return null;
          }

          // Find the face belonging to this person
          const personFace = assetFaces.find(
            (face) => face.person?.id === personId,
          );

          if (!personFace) {
            return null;
          }

          // Convert pixel coordinates to normalized percentages (0-1)
          return {
            id: personFace.id,
            assetId: asset.id,
            boundingBox: {
              x1: personFace.boundingBoxX1 / personFace.imageWidth,
              y1: personFace.boundingBoxY1 / personFace.imageHeight,
              x2: personFace.boundingBoxX2 / personFace.imageWidth,
              y2: personFace.boundingBoxY2 / personFace.imageHeight,
            },
          } as FaceWithAsset;
        }),
      );

      faces.push(...batchResults.filter((f): f is FaceWithAsset => f !== null));
    }

    return faces;
  }

  async getAssetThumbnail(assetId: string, size: 'preview' | 'thumbnail' = 'thumbnail'): Promise<Buffer | null> {
    const url = `${this.apiUrl}/api/assets/${assetId}/thumbnail?size=${size}`;

    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        console.error(
          `[ImmichApiService] Asset thumbnail error: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(
        `[ImmichApiService] Asset thumbnail request failed for ${assetId}:`,
        error,
      );
      return null;
    }
  }
}
