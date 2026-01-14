# Module: Frontend Shell Scaffolding

## Purpose
Create the SvelteKit frontend structure with basic layout and placeholder pages.

## Scope
- Files: `apps/web/`
- This is foundational scaffolding - create structure, not full UI implementation

## Requirements

### 1. Package Configuration (`package.json`)
```json
{
  "name": "@immich-admin-tools/web",
  "dependencies": {
    "@immich/ui": "latest",
    "@sveltejs/kit": "^2.x"
  },
  "devDependencies": {
    "tailwindcss": "^3.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x"
  }
}
```

### 2. SvelteKit Configuration
- `svelte.config.js` - Standard SvelteKit config
- `vite.config.ts` - Vite config with proxy to backend
- `tsconfig.json` - TypeScript config

### 3. Tailwind Setup
- `tailwind.config.js` - Include @immich/ui preset if available
- `postcss.config.js`
- `src/app.css` - Base styles with Tailwind directives

### 4. App Shell
- `src/app.html` - HTML template
- `src/routes/+layout.svelte` - Main layout with:
  - Header with "Immich Admin Tools" title
  - Navigation sidebar (Dashboard, History, Settings)
  - Connection status indicator
  - Dark theme support

### 5. Route Structure
```
src/routes/
├── +layout.svelte      # App shell
├── +page.svelte        # Dashboard (placeholder)
├── queues/
│   └── [name]/
│       └── +page.svelte # Queue detail (placeholder)
├── history/
│   └── +page.svelte    # Job history (placeholder)
└── settings/
    └── +page.svelte    # Settings (placeholder)
```

### 6. Lib Structure
```
src/lib/
├── components/         # Empty dir for now
├── stores/
│   └── connection.ts   # Store for API connection status
├── api/
│   └── client.ts       # Fetch wrapper for backend API
└── types/
    └── index.ts        # TypeScript interfaces
```

### 7. Types (`src/lib/types/index.ts`)
```typescript
export interface QueueStatus {
  name: string;
  isPaused: boolean;
  waiting: number;
  active: number;
  failed: number;
  rate?: number;
  eta?: number;
  stuckJobs?: StuckJob[];
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
```

### 8. API Client (`src/lib/api/client.ts`)
```typescript
const API_BASE = '/api';

export async function fetchHealth(): Promise<HealthStatus> { ... }
export async function fetchQueues(): Promise<QueueStatus[]> { ... }
export async function pauseQueue(name: string): Promise<void> { ... }
export async function resumeQueue(name: string): Promise<void> { ... }
```

## Implementation Notes
- Use @immich/ui components where available (Button, Card, etc.)
- Proxy /api requests to backend (localhost:3001) in dev
- Keep pages as placeholders with "Coming soon" or basic structure
- Dashboard should show a simple "Loading queues..." message

## Acceptance Criteria
- [ ] App compiles without errors
- [ ] `pnpm dev` starts the dev server
- [ ] Navigation between routes works
- [ ] Dark theme is applied
- [ ] Vite proxies /api to backend
