import type { HealthStatus, QueueStatus, JobsResponse, JobState, AllTrackedStats } from '$lib/types';

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
