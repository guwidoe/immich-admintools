# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **Project Scaffolding Complete** - Full monorepo structure with NestJS + SvelteKit
- Root configuration: `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- Backend scaffolding (`apps/server/`):
  - NestJS app with modular architecture
  - Redis service for BullMQ job access
  - Immich API service wrapper
  - Queues module with REST endpoints
  - Health check endpoint
  - WebSocket gateway for real-time updates
- Frontend scaffolding (`apps/web/`):
  - SvelteKit with Tailwind CSS
  - Dark theme with Immich-inspired design
  - Navigation layout with sidebar
  - Dashboard, queue detail, history, and settings routes
  - API client and connection status store
  - TypeScript interfaces for queue data
- Docker configuration:
  - Multi-stage Dockerfile
  - docker-compose.yml for production
  - docker-compose.dev.yml for local development
- Environment configuration (`.env.example`)
- Module specs in `docs/modules/`

### Documentation
- Created `docs/modules/backend-core.md` specification
- Created `docs/modules/frontend-shell.md` specification

---

## [0.0.1] - 2026-01-11

### Added
- `IMPLEMENTATION_PLAN.md` - Comprehensive implementation roadmap
- `README.md` - Project overview and quick start guide
- `AGENT_ORCHESTRATION.md` - Multi-agent coordination strategy
- `.cursor/rules` - Shared context for Cursor agent sessions
- `docs/ARCHITECTURE.md` - System design documentation
- `docs/TASK_BOARD.md` - Task tracking for agent coordination
- `LICENSE` - AGPL-3.0 license (matching Immich)

### Documentation
- Defined tech stack: NestJS + SvelteKit + @immich/ui
- Documented API integration strategy (Immich API + Redis)
- Created agent role definitions (Architect vs Implementor)
- Established file-based coordination workflow

---

## How to Update This File

When completing a task:

1. Add entry under `[Unreleased]` section
2. Use appropriate category:
   - `Added` - New features
   - `Changed` - Changes to existing features
   - `Deprecated` - Features to be removed
   - `Removed` - Removed features
   - `Fixed` - Bug fixes
   - `Security` - Security fixes
   - `Documentation` - Docs only changes

3. Include brief description of what was done
4. Reference related files or issues if applicable

Example:
```markdown
### Added
- Queue status endpoint (`apps/server/src/modules/queues/queues.controller.ts`)
- Real-time WebSocket updates for queue changes
```
