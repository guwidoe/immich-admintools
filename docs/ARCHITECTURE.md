# Architecture

> System design document. This is the source of truth for how components interact.
> Update this when making architectural decisions.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              User Browser                                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     │ HTTP / WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Immich Admin Tools                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      SvelteKit Frontend                          │   │
│  │                       (port 5173 dev)                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │   │
│  │  │Dashboard │  │ Queue    │  │ History  │  │ Settings         │ │   │
│  │  │  Page    │  │  Detail  │  │   Page   │  │   Page           │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │   │
│  └──────────────────────────────────┬──────────────────────────────┘   │
│                                     │                                   │
│                                     │ REST API / WebSocket              │
│                                     ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      NestJS Backend                              │   │
│  │                       (port 3001)                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │QueuesModule │  │HealthModule│  │  WebSocketGateway       │  │   │
│  │  │             │  │             │  │                         │  │   │
│  │  │ Controller  │  │ AutoHeal   │  │  Real-time updates      │  │   │
│  │  │ Service     │  │ Service     │  │                         │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │   │
│  │         │                │                                       │   │
│  └─────────┼────────────────┼───────────────────────────────────────┘   │
│            │                │                                           │
└────────────┼────────────────┼───────────────────────────────────────────┘
             │                │
             │                │
    ┌────────┴────────┐   ┌───┴───────────────────────────────┐
    │                 │   │                                    │
    ▼                 ▼   ▼                                    ▼
┌────────┐      ┌─────────────┐                          ┌─────────┐
│ Redis  │      │   Immich    │                          │ Immich  │
│        │      │   Server    │                          │   DB    │
│(BullMQ │      │   (API)     │                          │(Postgres│
│ queues)│      │ port 2283   │                          │  future)│
└────────┘      └─────────────┘                          └─────────┘
```

---

## Component Details

### Frontend (apps/web)

**Framework**: SvelteKit  
**UI Library**: @immich/ui  
**Styling**: Tailwind CSS

#### Routes
| Route | Purpose |
|-------|---------|
| `/` | Dashboard - queue overview |
| `/queues/[name]` | Queue detail - jobs list |
| `/history` | Job history log |
| `/settings` | Configuration |

#### Key Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `QueueCard` | `lib/components/` | Displays single queue status |
| `StuckJobAlert` | `lib/components/` | Warning banner for stuck jobs |
| `ActionButtons` | `lib/components/` | Pause/Resume/Clear buttons |
| `ProcessingChart` | `lib/components/` | Rate/history visualization |

#### Stores (Svelte)
| Store | Purpose |
|-------|---------|
| `queues` | Queue status data, updated via WebSocket |
| `settings` | User preferences, persisted to localStorage |

### Backend (apps/server)

**Framework**: NestJS  
**Runtime**: Node.js 20+

#### Modules
| Module | Purpose | Dependencies |
|--------|---------|--------------|
| `QueuesModule` | Queue status & control | ImmichService, RedisService |
| `HealthModule` | Auto-heal functionality | RedisService |
| `WebSocketModule` | Real-time events | QueuesModule |
| `ConfigModule` | Environment config | - |

#### Services
| Service | Purpose |
|---------|---------|
| `ImmichApiService` | Wrapper around @immich/sdk |
| `RedisService` | Direct Redis access for job inspection |
| `AutoHealService` | Background stuck job detection |

### Shared Types (packages/shared)

```typescript
// Queue status
interface QueueStatus {
  name: QueueName;
  isPaused: boolean;
  waiting: number;
  active: number;
  failed: number;
  rate: number;        // jobs/minute (calculated)
  eta: number;         // seconds until empty (estimated)
  stuckJobs: StuckJob[];
}

// Stuck job info
interface StuckJob {
  jobId: string;
  ageSeconds: number;
  assetId?: string;
  assetPath?: string;
}

// Queue names (matches Immich)
type QueueName = 
  | 'faceDetection'
  | 'facialRecognition'
  | 'thumbnailGeneration'
  | 'metadataExtraction'
  | 'smartSearch'
  | 'videoConversion'
  | 'sidecar'
  | 'library'
  | 'notifications'
  | 'backgroundTask'
  | 'search'
  | 'duplicateDetection'
  | 'storageTemplateMigration'
  | 'ocr';
```

---

## Data Flow

### Queue Status Update Flow

```
1. Frontend connects via WebSocket
2. Backend starts polling (every 2 seconds):
   a. Call Immich API: GET /api/queues
   b. Call Redis: Get active job timestamps
   c. Calculate rates from history
   d. Identify stuck jobs (age > threshold)
   e. Emit via WebSocket to frontend
3. Frontend updates stores, UI reacts
```

### Stuck Job Detection Flow

```
1. RedisService reads: LRANGE immich_bull:{queue}:active 0 -1
2. For each job ID, get timestamp from job data
3. Calculate age: now - startedAt
4. If age > threshold, mark as stuck
5. Include in QueueStatus.stuckJobs[]
```

### Clear Stuck Jobs Flow

```
1. User clicks "Clear Stuck Jobs"
2. Frontend: POST /api/queues/{name}/clear-stuck
3. Backend:
   a. Get stuck job IDs
   b. Redis: LREM immich_bull:{queue}:active {jobId}
   c. Optionally: Move to failed or re-queue
4. Return { cleared: number, jobIds: string[] }
5. Frontend updates via next WebSocket push
```

---

## External Dependencies

### Immich API (via @immich/sdk)

| Endpoint | Used For |
|----------|----------|
| `GET /api/queues` | List queues with counts |
| `GET /api/queues/{name}` | Single queue detail |
| `PUT /api/queues/{name}` | Pause/resume |
| `GET /api/queues/{name}/jobs` | List jobs (with status filter) |
| `DELETE /api/queues/{name}/jobs` | Clear queue |
| `GET /api/assets/{id}` | Get asset info for stuck job |

### Redis (Direct Access)

| Key Pattern | Purpose |
|-------------|---------|
| `immich_bull:{queue}:wait` | Waiting jobs list |
| `immich_bull:{queue}:active` | Active jobs list |
| `immich_bull:{queue}:failed` | Failed jobs set |
| `immich_bull:{queue}:{jobId}` | Job data (includes timestamp) |

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `IMMICH_API_URL` | Yes | - | Immich server URL |
| `IMMICH_API_KEY` | Yes | - | Immich API key |
| `REDIS_URL` | Yes | - | Redis connection URL |
| `PORT` | No | 3001 | Backend server port |
| `LOG_LEVEL` | No | info | Logging verbosity |
| `AUTO_HEAL_ENABLED` | No | false | Enable auto-clear stuck jobs |
| `AUTO_HEAL_INTERVAL` | No | 60 | Check interval in seconds |
| `STUCK_THRESHOLD_SECONDS` | No | 300 | Age to consider job stuck |

### Thresholds (Configurable)

| Queue | Default Threshold | Rationale |
|-------|-------------------|-----------|
| `videoConversion` | 30 min | Videos take longer |
| `faceDetection` | 5 min | ML can hang |
| `thumbnailGeneration` | 2 min | Should be fast |
| `metadataExtraction` | 3 min | Usually quick |
| Others | 5 min | Safe default |

---

## Security Considerations

1. **API Key Protection**: Never expose IMMICH_API_KEY to frontend
2. **Redis Access**: Backend only; frontend never touches Redis
3. **Action Authorization**: All destructive actions require API key validation
4. **Network**: Should run in same Docker network as Immich

---

## Future Considerations

### Potential Enhancements
- Direct PostgreSQL access for deeper metrics
- Prometheus metrics endpoint
- Multi-instance support
- Plugin system for custom actions

### Known Limitations
- Depends on Immich's internal Redis key structure
- Rate calculations are estimates based on short history
- No persistence of historical data (yet)

---

*Last updated: 2026-01-11*
