# Immich Admin Tools - Implementation Plan

> A standalone administration dashboard for Immich that provides enhanced transparency and control over job queues and system operations.

## Background & Problem Statement

Based on real-world experience managing a 100k+ photo Immich instance:

### Pain Points with Immich's Built-in Job Management
1. **Jobs get stuck silently** - After container restarts or when processing problematic files, jobs show as "active" indefinitely without any indication of being stuck
2. **No timeout handling** - BullMQ has built-in stalled job detection, but Immich doesn't expose or enable it
3. **Poor visibility** - Can't see:
   - How long a job has been running
   - Which specific file is causing a job to hang
   - Processing rates and ETAs
   - Historical patterns (when/why jobs fail)
4. **Limited control** - No way to:
   - Clear individual stuck jobs without Redis CLI
   - Set job timeouts
   - Auto-recover from stalled states
5. **Manual intervention required** - Currently need to run Redis commands to clear stuck jobs

### Root Cause
When workers pick up jobs but hang (due to corrupted files, memory issues, or unexpected restarts), BullMQ marks them as "active" forever. Over time, all concurrency slots fill with these zombie jobs, deadlocking the entire system.

---

## Solution Overview

**Immich Admin Tools** - A companion Docker container that:
- Provides real-time insight into what Immich is actually doing
- Automatically detects and recovers from stuck states
- Gives administrators fine-grained control over job processing
- Follows Immich's architecture and design language (native feel)

---

## Technical Architecture

### Stack (Matching Immich's Official Stack)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | SvelteKit | Same as Immich web |
| **UI Components** | `@immich/ui` | Official component library for native look |
| **Styling** | Tailwind CSS | Same as Immich |
| **Backend** | NestJS (TypeScript) | Same as Immich server |
| **API Client** | `@immich/sdk` | Official SDK for type-safe API calls |
| **Package Manager** | pnpm | Same as Immich |
| **License** | AGPL-3.0 | Same as Immich |

### Deployment

```yaml
# docker-compose.yml (user adds to their Immich stack)
services:
  immich-admin-tools:
    image: ghcr.io/your-org/immich-admin-tools:latest
    container_name: immich_admin_tools
    environment:
      - IMMICH_API_URL=http://immich_server:2283
      - IMMICH_API_KEY=${IMMICH_API_KEY}
      - REDIS_URL=redis://immich_redis:6379
    ports:
      - "2285:3000"
    depends_on:
      - immich_server
      - immich_redis
    restart: unless-stopped
```

### API Integration

Uses Immich's **v2.4.0+ Queues API** (Alpha):

| Endpoint | Purpose |
|----------|---------|
| `GET /api/queues` | List all queues with statistics |
| `GET /api/queues/{name}` | Get specific queue details |
| `PUT /api/queues/{name}` | Pause/resume queue |
| `GET /api/queues/{name}/jobs?status=active` | List individual jobs with status |
| `DELETE /api/queues/{name}/jobs` | Clear queue jobs |

**Direct Redis access** for advanced features:
- Reading job age/timestamps from active lists
- Clearing individual stuck jobs
- Queue health monitoring

---

## Feature Specification

### Phase 1: Core Dashboard (MVP)

#### 1.1 Real-Time Queue Overview
```
┌─────────────────────────────────────────────────────────────────┐
│ IMMICH ADMIN TOOLS                              [Connected ✓]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  QUEUE STATUS                                                   │
│  ────────────────────────────────────────────────────────────── │
│                                                                 │
│  ● Face Detection          ▶ Running                           │
│    Waiting: 12,450  Active: 5  Failed: 23  Rate: ~42/min       │
│    ETA: ~5 hours                                                │
│    ⚠️ 2 jobs running > 5 min (potential stuck)                  │
│                                                                 │
│  ● Facial Recognition      ▶ Running                           │
│    Waiting: 3,201   Active: 1  Failed: 0   Rate: ~180/min      │
│    ETA: ~18 min                                                 │
│                                                                 │
│  ● Metadata Extraction     ⏸ Paused                            │
│    Waiting: 45,892  Active: 0  Failed: 156                     │
│                                                                 │
│  ● Thumbnail Generation    ▶ Running                           │
│    Waiting: 8,440   Active: 10 Failed: 12  Rate: ~85/min       │
│    ETA: ~1.5 hours                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Live queue counts (polling every 2-5 seconds)
- Processing rate calculation (jobs/minute)
- ETA estimates based on current rate
- Visual indicators for:
  - Queue state (running/paused/stalled)
  - Potential stuck jobs (age > threshold)
  - Failed job counts

#### 1.2 Stuck Job Detection & Alerts

**Automatic Detection:**
- Monitor job age in active lists
- Configurable threshold (default: 5 minutes for most, 15 min for video transcoding)
- Visual warning when jobs exceed threshold

**Alert Display:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ STUCK JOBS DETECTED                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Face Detection - 2 stuck jobs                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Job ID: abc123                                             │ │
│  │ Running for: 47 minutes                                    │ │
│  │ Asset: /external/Photos/2019/IMG_4521.jpg                  │ │
│  │                                                            │ │
│  │ [View Asset]  [Clear Job]  [Clear All Stuck]               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.3 One-Click Recovery Actions

| Action | Description |
|--------|-------------|
| **Clear Stuck Jobs** | Remove jobs > threshold age from active list |
| **Pause Queue** | Stop processing for specific queue |
| **Resume Queue** | Resume paused queue |
| **Clear Failed** | Remove failed jobs from queue |
| **Retry Failed** | Re-queue failed jobs |
| **Clear All + Restart** | Nuclear option: clear all active, restart workers |

### Phase 2: Enhanced Visibility

#### 2.1 Job History & Logs
- Track when jobs get stuck (timestamp, which queue, which asset)
- Processing rate history (chart over time)
- Failed job log with error messages (if available)
- Export logs for debugging

#### 2.2 Asset Identification
When a job is stuck, show:
- Full file path
- Asset thumbnail (via Immich API)
- Link to asset in Immich UI
- File size, format, metadata

#### 2.3 Processing Statistics
- Jobs completed today/week/month
- Average processing time per job type
- Failure rate trends
- Peak processing times

### Phase 3: Automation & Control

#### 3.1 Auto-Heal Mode
```yaml
# Configuration
auto_heal:
  enabled: true
  check_interval: 60  # seconds
  thresholds:
    faceDetection: 300       # 5 minutes
    facialRecognition: 300   # 5 minutes
    thumbnailGeneration: 120 # 2 minutes
    metadataExtraction: 180  # 3 minutes
    videoConversion: 1800    # 30 minutes
  action: clear_and_log     # or: alert_only, clear_and_restart
```

**Behaviors:**
- `alert_only` - Just show warning, don't auto-clear
- `clear_and_log` - Clear stuck job, log the asset ID for review
- `clear_and_restart` - Clear all stuck + restart immich_server

#### 3.2 Queue Prioritization
- Ability to pause lower-priority queues during initial import
- Suggested order: Metadata → Thumbnails → Face Detection → Recognition → Smart Search

#### 3.3 Webhook/Notification Support
- Discord/Slack webhook for alerts
- Email notifications (optional)
- Prometheus metrics endpoint for Grafana integration

### Phase 4: Advanced Features

#### 4.1 Problem Asset Management
- List of assets that have caused stuck jobs
- Ability to exclude assets from processing
- "Quarantine" mode for repeatedly failing assets

#### 4.2 Direct Redis Dashboard
- View raw queue state
- Manual Redis commands (for power users)
- Queue health metrics

#### 4.3 Multi-Instance Support
- Connect to multiple Immich instances
- Aggregate dashboard view

---

## Project Structure

```
immich-admin-tools/
├── apps/
│   ├── server/                 # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── config/
│   │   │   │   └── configuration.ts
│   │   │   ├── queues/
│   │   │   │   ├── queues.controller.ts
│   │   │   │   ├── queues.service.ts
│   │   │   │   └── queues.module.ts
│   │   │   ├── redis/
│   │   │   │   ├── redis.service.ts
│   │   │   │   └── redis.module.ts
│   │   │   ├── immich/
│   │   │   │   ├── immich-api.service.ts
│   │   │   │   └── immich.module.ts
│   │   │   ├── health/
│   │   │   │   ├── health.controller.ts
│   │   │   │   └── auto-heal.service.ts
│   │   │   └── websocket/
│   │   │       └── events.gateway.ts   # Real-time updates
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                    # SvelteKit frontend
│       ├── src/
│       │   ├── routes/
│       │   │   ├── +layout.svelte
│       │   │   ├── +page.svelte        # Dashboard
│       │   │   ├── queues/
│       │   │   │   └── [name]/+page.svelte
│       │   │   ├── history/
│       │   │   │   └── +page.svelte
│       │   │   └── settings/
│       │   │       └── +page.svelte
│       │   ├── lib/
│       │   │   ├── components/
│       │   │   │   ├── QueueCard.svelte
│       │   │   │   ├── StuckJobAlert.svelte
│       │   │   │   ├── ProcessingChart.svelte
│       │   │   │   └── ActionButtons.svelte
│       │   │   ├── stores/
│       │   │   │   ├── queues.ts
│       │   │   │   └── settings.ts
│       │   │   └── api/
│       │   │       └── client.ts
│       │   └── app.html
│       ├── static/
│       ├── package.json
│       ├── svelte.config.js
│       └── tailwind.config.js
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml      # For development
│
├── docs/
│   ├── installation.md
│   ├── configuration.md
│   └── api.md
│
├── package.json                # Root workspace
├── pnpm-workspace.yaml
├── turbo.json                  # Monorepo build tool
├── LICENSE                     # AGPL-3.0
├── README.md
└── CONTRIBUTING.md
```

---

## Implementation Phases & Timeline

### Phase 1: MVP (2-3 weeks)
- [ ] Project scaffolding (NestJS + SvelteKit + @immich/ui)
- [ ] Basic queue status display
- [ ] Stuck job detection
- [ ] One-click clear stuck jobs
- [ ] Docker packaging
- [ ] Documentation

**Deliverable:** Usable tool that solves the core stuck-jobs problem

### Phase 2: Enhanced Features (2-3 weeks)
- [ ] Job history logging
- [ ] Asset identification for stuck jobs
- [ ] Processing statistics
- [ ] Improved UI/UX

**Deliverable:** Full-featured dashboard with historical data

### Phase 3: Automation (2 weeks)
- [ ] Auto-heal mode
- [ ] Webhook notifications
- [ ] Prometheus metrics

**Deliverable:** Self-healing system with alerting

### Phase 4: Polish & Community (Ongoing)
- [ ] Problem asset management
- [ ] Multi-instance support
- [ ] Community feedback integration
- [ ] Potential contribution to Immich core

---

## Development Setup

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker (for local Immich instance)

### Local Development
```bash
# Clone repository
git clone https://github.com/your-org/immich-admin-tools.git
cd immich-admin-tools

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your Immich API key and Redis URL

# Start development servers
pnpm dev

# Server runs on http://localhost:3001
# Web runs on http://localhost:5173
```

### Environment Variables
```env
# Required
IMMICH_API_URL=http://localhost:2283
IMMICH_API_KEY=your-api-key-here
REDIS_URL=redis://localhost:6379

# Optional
PORT=3000
LOG_LEVEL=info
AUTO_HEAL_ENABLED=false
AUTO_HEAL_THRESHOLD_MINUTES=5
```

---

## API Design

### Internal API Endpoints

```typescript
// GET /api/status
// Returns overall system status
{
  "connected": true,
  "immichVersion": "1.94.0",
  "queues": 14,
  "totalWaiting": 45892,
  "totalActive": 16,
  "stuckJobs": 2
}

// GET /api/queues
// Returns all queue statuses with extended info
[
  {
    "name": "faceDetection",
    "isPaused": false,
    "waiting": 12450,
    "active": 5,
    "failed": 23,
    "rate": 42.3,
    "eta": 17820,  // seconds
    "stuckJobs": [
      {
        "jobId": "abc123",
        "ageSeconds": 2820,
        "assetId": "asset-uuid",
        "assetPath": "/external/Photos/2019/IMG_4521.jpg"
      }
    ]
  }
]

// POST /api/queues/:name/clear-stuck
// Clears stuck jobs for a specific queue
{
  "cleared": 2,
  "jobIds": ["abc123", "def456"]
}

// POST /api/actions/clear-all-stuck
// Clears all stuck jobs across all queues
{
  "cleared": 5,
  "queues": ["faceDetection", "thumbnailGeneration"]
}

// GET /api/history
// Returns job history log
[
  {
    "timestamp": "2024-01-15T14:30:00Z",
    "event": "stuck_job_cleared",
    "queue": "faceDetection",
    "jobId": "abc123",
    "assetId": "asset-uuid",
    "ageSeconds": 2820
  }
]
```

---

## Success Criteria

### Technical
- [ ] Detects stuck jobs within 30 seconds
- [ ] UI updates in real-time (< 5 second lag)
- [ ] Works with Immich v2.4.0+
- [ ] Docker image < 200MB
- [ ] Memory footprint < 100MB

### User Experience
- [ ] Setup takes < 5 minutes
- [ ] Native Immich look and feel
- [ ] One-click stuck job recovery
- [ ] Clear documentation

### Community
- [ ] Open-sourced under AGPL-3.0
- [ ] Published to GitHub Container Registry
- [ ] Documentation site
- [ ] Listed in Immich community tools

---

## Design Decisions

### 1. Relationship to Immich Core

This tool is **not** intended to become an official Immich feature. Instead, it serves as:
- A **reference implementation** showing how job management problems can be solved
- A **working prototype** that Immich developers can study when tackling these issues
- A **community tool** that provides immediate relief for users facing stuck job issues

If Immich eventually implements native stuck job detection, this tool becomes less necessary—and that's a good outcome.

### 2. Redis Access Strategy

**Decision: Use both Immich API AND direct Redis access**

| Approach | Use For |
|----------|---------|
| **Immich API** | Queue stats, pause/resume, standard operations |
| **Direct Redis** | Stuck job detection, reading job age/timestamps, surgical job removal |

**Why Redis is necessary:**
The Immich API tells us "5 jobs are active" but not *how long* they've been active. To detect stuck jobs, we need to read BullMQ's internal job timestamps directly from Redis. This is the only way to know a job has been running for 47 minutes vs 2 seconds.

**Trade-off acknowledged:** If Immich changes their internal Redis key structure, we may need updates. This is acceptable because:
- BullMQ's key structure is stable and well-documented
- The alternative (no stuck detection) is worse
- We can version-gate features if needed

### 3. Scope

**Current scope: Job management and system health monitoring**

Future scope will be **driven organically** by real-world issues encountered while using Immich. This keeps the tool focused and ensures we're solving actual problems rather than theoretical ones.

When new pain points arise during Immich usage, they'll be evaluated for inclusion.

---

## References

- [Immich OpenAPI Specs](https://github.com/immich-app/immich/blob/main/open-api/immich-openapi-specs.json)
- [Immich UI Component Library](https://ui.immich.app) / [GitHub](https://github.com/immich-app/ui)
- [Immich SDK](https://www.npmjs.com/package/@immich/sdk)
- [GitHub Issue #22180 - Job Timeout Request](https://github.com/immich-app/immich/issues/22180)
- [BullMQ Documentation - Stalled Jobs](https://docs.bullmq.io/guide/jobs/stalled)

---

*This implementation plan is based on real-world experience with Immich job management issues and aims to provide a solution that feels native to the Immich ecosystem while solving critical operational pain points.*
