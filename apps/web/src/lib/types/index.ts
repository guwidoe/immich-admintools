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

export type JobState = 'waiting' | 'active' | 'failed' | 'delayed';

export interface TrackedQueueStats {
  completed: number;
  failed: number;
  lastUpdated: string | null;
}

export type AllTrackedStats = Record<string, TrackedQueueStats>;

// People types
export interface Person {
  id: string;
  name: string;
  birthDate: string | null;
  thumbnailPath: string;
  isHidden: boolean;
  assetCount?: number;
}

export interface PersonCluster {
  id: string;
  people: Person[];
  primaryId: string;
  similarity: number;
  representativeName: string;
}

export interface BulkIdResult {
  id: string;
  success: boolean;
  error?: 'NO_PERMISSION' | 'NOT_FOUND' | 'UNKNOWN';
}

export interface MergeResult {
  clusterId: string;
  results: BulkIdResult[];
  success: boolean;
}

export interface FaceWithAsset {
  id: string;
  assetId: string;
  boundingBox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

// Monitoring types
export interface ActiveQuery {
  pid: number;
  username: string;
  database: string;
  state: string;
  query: string;
  queryStart: string | null;
  duration: number | null;
  waitEventType: string | null;
  waitEvent: string | null;
}

export interface FinishedQuery {
  pid: number;
  query: string;
  duration: number;
  completedAt: number; // timestamp in ms
  username: string;
}

export interface DatabaseStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  activeQueries: ActiveQuery[];
}
