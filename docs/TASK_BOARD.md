# Task Board

> Central coordination point for all agent sessions.
> Update this file when starting or completing tasks.

---

## 🔴 Ready for Implementation

These tasks have specs ready and can be picked up:

### Phase 1: Remaining Work
- [ ] **Install & Verify** - Run `pnpm install` and verify both apps start
- [ ] **Wire Up Dashboard** - Connect frontend to backend API, show real queue data
- [ ] **Stuck Job Detection** - Implement threshold-based detection in queues service
- [ ] **Action Buttons** - Implement pause/resume/clear controls on dashboard

### Phase 2: Enhanced Features
- [ ] **Job History Logging** - Track stuck job events
- [ ] **Asset Identification** - Show asset details for stuck jobs
- [ ] **Processing Statistics** - Charts and rate calculations

---

## 🟡 In Progress

Tasks currently being worked on:

| Task | Agent/Session | Started | Notes |
|------|---------------|---------|-------|
| *None currently* | - | - | - |

---

## 🟢 Complete

Finished tasks:

| Task | Completed | Notes |
|------|-----------|-------|
| Implementation Plan | 2026-01-11 | `IMPLEMENTATION_PLAN.md` |
| README | 2026-01-11 | `README.md` |
| Agent Orchestration Guide | 2026-01-11 | `AGENT_ORCHESTRATION.md` |
| Cursor Rules | 2026-01-11 | `.cursor/rules` |
| Task Board Setup | 2026-01-11 | This file |
| **Project Scaffolding** | 2026-01-11 | Monorepo: `package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| **Backend Core** | 2026-01-11 | NestJS with Redis, Immich API, Queues, Health, WebSocket modules |
| **Frontend Shell** | 2026-01-11 | SvelteKit with Tailwind, dark theme, navigation, all routes |
| **Docker Config** | 2026-01-11 | `docker/Dockerfile`, `docker-compose.yml`, `.env.example` |
| **Module Specs** | 2026-01-11 | `docs/modules/backend-core.md`, `docs/modules/frontend-shell.md` |
| **Shared Types** | 2026-01-11 | In `apps/web/src/lib/types/index.ts` |
| Redis Service | 2026-01-11 | `apps/server/src/redis/redis.service.ts` |
| Immich API Client | 2026-01-11 | `apps/server/src/immich/immich-api.service.ts` |
| Queue Status Endpoint | 2026-01-11 | `apps/server/src/queues/queues.controller.ts` |
| WebSocket Events | 2026-01-11 | `apps/server/src/websocket/events.gateway.ts` |

---

## 🔵 Needs Architecture/Spec

Tasks that need spec written by Architect before implementation:

- [ ] **Auto-Heal Service** - Background service for automatic recovery
- [ ] **Prometheus Metrics** - Metrics endpoint for Grafana

---

## 📋 Backlog

Future tasks (not yet prioritized):

- Webhook notifications (Discord/Slack)
- Problem asset management
- Multi-instance support
- Documentation site

---

## How to Use This Board

### Picking Up a Task
1. Find task in "Ready for Implementation"
2. Move it to "In Progress" with your session info
3. Start working

### Completing a Task
1. Move from "In Progress" to "Complete"
2. Add completion date and notes
3. Update `CHANGELOG.md`

### Need a New Task?
If you need a task that isn't listed:
1. Add it to "Needs Architecture/Spec"
2. Ask Architect session to create the spec
3. Once spec exists, move to "Ready for Implementation"

---

*Last updated: 2026-01-11*
