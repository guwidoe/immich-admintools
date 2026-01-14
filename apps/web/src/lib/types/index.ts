export interface QueueStatus {
  name: string;
  isPaused: boolean;
  isActive: boolean;
  jobCounts: {
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    waiting: number;
    paused: number;
  };
  stuckJobs?: StuckJob[];
  trackedStats?: {
    completed: number;
    failed: number;
    lastUpdated: string | null;
  };
}

export interface StuckJob {
  jobId: string;
  ageSeconds: number;
  assetId?: string;
  assetPath?: string;
}

export interface HealthStatus {
  redis: boolean;
  immich: boolean;
  status: 'ok' | 'degraded' | 'error';
}

export interface ApiError {
  message: string;
  code?: string;
}
