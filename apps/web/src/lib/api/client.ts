import type { HealthStatus, QueueStatus, JobsResponse, JobState, AllTrackedStats, Person, BulkIdResult, DatabaseStats, FaceWithAsset } from '$lib/types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(error.message || 'Request failed', response.status);
  }

  return response.json();
}

export async function fetchHealth(): Promise<HealthStatus> {
  return request<HealthStatus>('/health');
}

export async function fetchQueues(): Promise<QueueStatus[]> {
  return request<QueueStatus[]>('/queues');
}

export async function fetchQueue(name: string): Promise<QueueStatus> {
  return request<QueueStatus>(`/queues/${encodeURIComponent(name)}`);
}

export async function pauseQueue(name: string): Promise<void> {
  await request(`/queues/${encodeURIComponent(name)}/pause`, {
    method: 'POST'
  });
}

export async function resumeQueue(name: string): Promise<void> {
  await request(`/queues/${encodeURIComponent(name)}/resume`, {
    method: 'POST'
  });
}

export async function pauseAllQueues(): Promise<void> {
  await request('/queues/pause-all', {
    method: 'POST'
  });
}

export async function resumeAllQueues(): Promise<void> {
  await request('/queues/resume-all', {
    method: 'POST'
  });
}

export async function fetchJobs(
  queueName: string,
  state: JobState,
  page = 0,
  pageSize = 50
): Promise<JobsResponse> {
  const params = new URLSearchParams({
    state,
    page: page.toString(),
    pageSize: pageSize.toString()
  });
  return request<JobsResponse>(
    `/queues/${encodeURIComponent(queueName)}/jobs?${params}`
  );
}

export async function fetchAllStats(): Promise<AllTrackedStats> {
  return request<AllTrackedStats>('/stats');
}

export async function resetStats(queueName?: string): Promise<void> {
  if (queueName) {
    await request(`/stats/${encodeURIComponent(queueName)}/reset`, {
      method: 'POST'
    });
  } else {
    await request('/stats/reset-all', {
      method: 'POST'
    });
  }
}

// People API
export async function fetchPeople(withHidden = true, withCounts = false): Promise<Person[]> {
  return request<Person[]>(`/people?withHidden=${withHidden}&withCounts=${withCounts}`);
}

export interface FetchProgress {
  type: string;
  loaded: number;
  total: number;
  page: number;
}

export function fetchPeopleWithProgress(
  withHidden = true,
  onProgress: (progress: FetchProgress) => void
): Promise<Person[]> {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`${API_BASE}/people/stream?withHidden=${withHidden}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'progress') {
          onProgress(data);
        } else if (data.type === 'complete') {
          eventSource.close();
          resolve(data.people);
        } else if (data.type === 'error') {
          eventSource.close();
          reject(new Error(data.message));
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      reject(new Error('Connection lost'));
    };
  });
}

export async function mergePeople(primaryId: string, ids: string[]): Promise<BulkIdResult[]> {
  return request<BulkIdResult[]>(`/people/${encodeURIComponent(primaryId)}/merge`, {
    method: 'POST',
    body: JSON.stringify({ ids })
  });
}

export function getPersonThumbnailUrl(personId: string): string {
  return `${API_BASE}/people/${encodeURIComponent(personId)}/thumbnail`;
}

export async function fetchPersonFaces(personId: string): Promise<FaceWithAsset[]> {
  return request<FaceWithAsset[]>(`/people/${encodeURIComponent(personId)}/faces`);
}

export function getAssetThumbnailUrl(assetId: string, size: 'preview' | 'thumbnail' = 'thumbnail'): string {
  return `${API_BASE}/people/assets/${encodeURIComponent(assetId)}/thumbnail?size=${size}`;
}

// Monitoring API
export async function fetchMonitoringStatus(): Promise<{ available: boolean }> {
  return request<{ available: boolean }>('/monitoring/status');
}

export async function fetchDatabaseStats(): Promise<DatabaseStats | { error: string }> {
  return request<DatabaseStats | { error: string }>('/monitoring/database');
}

export interface DatabaseStatsMessage {
  type: 'stats' | 'error';
  stats?: DatabaseStats;
  error?: string;
}

export function streamDatabaseStats(
  onMessage: (data: DatabaseStatsMessage) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/monitoring/database/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as DatabaseStatsMessage;
      onMessage(data);
    } catch {
      // Ignore parse errors
    }
  };

  eventSource.onerror = () => {
    onMessage({ type: 'error', error: 'Connection lost' });
  };

  // Return cleanup function
  return () => eventSource.close();
}

// Settings API
export interface JobThresholds {
  default: number;
  faceDetection: number;
  facialRecognition: number;
  thumbnailGeneration: number;
  metadataExtraction: number;
  videoConversion: number;
}

export interface AutoHealSettings {
  enabled: boolean;
  intervalSeconds: number;
}

export interface AppSettings {
  thresholds: JobThresholds;
  autoHeal: AutoHealSettings;
  excludedQueues: string[];
}

export async function fetchSettings(): Promise<AppSettings> {
  return request<AppSettings>('/settings');
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  return request<AppSettings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}
