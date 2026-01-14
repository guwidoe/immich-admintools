# Module: Backend Core Scaffolding

## Purpose
Complete the NestJS backend structure with all core modules needed for Phase 1.

## Scope
- Files: `apps/server/src/`
- This is foundational scaffolding - implement module structure, not full business logic

## Existing Files (DO NOT RECREATE)
The following files already exist:
- `apps/server/package.json`
- `apps/server/tsconfig.json`
- `apps/server/nest-cli.json`
- `apps/server/src/main.ts`
- `apps/server/src/app.module.ts`
- `apps/server/src/config/configuration.ts`
- `apps/server/src/redis/redis.module.ts`

## Requirements

### 1. Redis Service (`src/redis/redis.service.ts`)
```typescript
@Injectable()
export class RedisService {
  // Connect to Redis using ioredis
  // Methods needed:
  // - isConnected(): Promise<boolean>
  // - getActiveJobIds(queueName: string): Promise<string[]>
  // - getJobData(queueName: string, jobId: string): Promise<object | null>
  // - getJobAge(queueName: string, jobId: string): Promise<number | null>
  // - removeActiveJob(queueName: string, jobId: string): Promise<boolean>
}
```

### 2. Immich Module (`src/immich/`)
- `immich.module.ts` - Global module
- `immich-api.service.ts` - Wrapper around Immich API
```typescript
@Injectable()
export class ImmichApiService {
  // Use fetch to call Immich API (not @immich/sdk yet, keep it simple)
  // Methods:
  // - getServerInfo(): Promise<{ version: string } | null>
  // - isConnected(): Promise<boolean>
  // - getQueues(): Promise<ImmichQueue[]>
  // - pauseQueue(name: string): Promise<boolean>
  // - resumeQueue(name: string): Promise<boolean>
}
```

### 3. Queues Module (`src/queues/`)
- `queues.module.ts`
- `queues.controller.ts` - REST endpoints
- `queues.service.ts` - Business logic combining Immich API + Redis
```typescript
// Controller endpoints:
// GET /api/queues - List all queues with extended info
// GET /api/queues/:name - Get specific queue
// POST /api/queues/:name/pause - Pause queue
// POST /api/queues/:name/resume - Resume queue
// POST /api/queues/:name/clear-stuck - Clear stuck jobs
```

### 4. Health Module (`src/health/`)
- `health.module.ts`
- `health.controller.ts` - Health check endpoint
```typescript
// GET /api/health - Returns connection status
// { redis: boolean, immich: boolean, status: 'ok' | 'degraded' | 'error' }
```

### 5. WebSocket Module (`src/websocket/`)
- `websocket.module.ts`
- `events.gateway.ts` - Socket.IO gateway for real-time updates
```typescript
@WebSocketGateway({ cors: true })
export class EventsGateway {
  // Will emit queue status updates to connected clients
  // For now, just set up the basic gateway structure
}
```

## Implementation Notes
- Use dependency injection for all services
- Keep implementations minimal - this is scaffolding
- Use ConfigService for all configuration values
- Add `console.log` for connection status on startup

## Acceptance Criteria
- [ ] All modules compile without errors
- [ ] App starts successfully with `pnpm dev`
- [ ] GET /api/health returns status response
- [ ] Redis and Immich services log connection attempts on startup
