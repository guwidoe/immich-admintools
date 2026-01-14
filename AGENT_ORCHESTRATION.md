# Multi-Agent Orchestration Strategy

> How to coordinate multiple AI agent sessions to build this project effectively

## The Core Problem

Each AI agent session (like this Cursor chat) has:
- ✅ Deep technical capability
- ❌ No memory between sessions
- ❌ No awareness of what other sessions have done

**Solution**: Create **persistent context files** that act as shared memory between agents.

---

## Practical Approach: File-Based Agent Coordination

Instead of complex frameworks, we use **the codebase itself** as the coordination mechanism.

### 1. Context Files (Shared Memory)

```
immich-admin-tools/
├── .cursor/                          # Cursor-specific context
│   └── rules                         # Agent instructions (always loaded)
├── docs/
│   ├── ARCHITECTURE.md               # System design (Architect's source of truth)
│   ├── IMPLEMENTATION_PLAN.md        # Overall roadmap
│   ├── TASK_BOARD.md                 # Current tasks & status
│   └── modules/
│       ├── backend-api.md            # Backend module spec
│       ├── frontend-dashboard.md     # Frontend module spec
│       ├── redis-integration.md      # Redis module spec
│       └── stuck-job-detection.md    # Feature spec
└── CHANGELOG.md                      # What's been done
```

### 2. Agent Roles via Context

#### "Architect" Session
**Prompt prefix**: "You are the Architect agent. Your job is to maintain the big picture. Before making changes, always read `docs/ARCHITECTURE.md` and `docs/IMPLEMENTATION_PLAN.md`. Update these files when design decisions are made."

**Responsibilities**:
- Maintain `ARCHITECTURE.md`
- Review and approve module interfaces
- Update `TASK_BOARD.md` with new tasks
- Ensure consistency across modules

#### "Implementor" Session(s)
**Prompt prefix**: "You are an Implementor agent working on [MODULE_NAME]. Read `docs/modules/[module].md` for your scope. Do NOT modify other modules without updating `TASK_BOARD.md`."

**Responsibilities**:
- Implement specific module
- Follow spec in module docs
- Update `CHANGELOG.md` when complete
- Mark tasks done in `TASK_BOARD.md`

---

## The `.cursor/rules` File

This file is **automatically loaded** by Cursor for every session. It provides persistent instructions:

```markdown
# Project: Immich Admin Tools

## Context Files (Read These First)
- `docs/ARCHITECTURE.md` - System design
- `docs/IMPLEMENTATION_PLAN.md` - Full roadmap
- `docs/TASK_BOARD.md` - Current tasks

## Tech Stack
- Backend: NestJS (TypeScript)
- Frontend: SvelteKit + @immich/ui
- Styling: Tailwind CSS
- Package Manager: pnpm

## Key Principles
1. Match Immich's architecture and conventions
2. Use @immich/ui for native look
3. API via @immich/sdk, Redis for advanced features
4. Every feature must be documented

## Before Coding
1. Check TASK_BOARD.md for current assignments
2. Read relevant module spec in docs/modules/
3. Update TASK_BOARD.md to mark task "in progress"

## After Coding
1. Update CHANGELOG.md with what was done
2. Mark task complete in TASK_BOARD.md
3. If you changed interfaces, update ARCHITECTURE.md
```

---

## Workflow: How Sessions Coordinate

### Starting a New Session

```
1. Load context: @ARCHITECTURE.md @TASK_BOARD.md
2. State your role: "I'm continuing as [Architect/Implementor for X]"
3. Check what's done: Read CHANGELOG.md
4. Pick a task: From TASK_BOARD.md
5. Work on it
6. Update files before closing
```

### Task Handoff Example

**Session 1 (Architect)**:
```
"Create the backend API module spec"
→ Creates docs/modules/backend-api.md
→ Updates TASK_BOARD.md: "Backend API: Ready for implementation"
```

**Session 2 (Implementor)**:
```
"@backend-api.md Implement the backend API module"
→ Reads spec, implements apps/server/
→ Updates CHANGELOG.md: "Backend API scaffolded"
→ Updates TASK_BOARD.md: "Backend API: Complete"
```

**Session 3 (Different Implementor)**:
```
"@frontend-dashboard.md Implement the dashboard"
→ Works on frontend independently
→ Can proceed in parallel because modules are decoupled
```

---

## Task Board Structure

```markdown
# Task Board

## 🔴 Ready for Implementation
- [ ] Backend API scaffolding (@backend-api.md)
- [ ] Frontend dashboard structure (@frontend-dashboard.md)

## 🟡 In Progress
- [ ] Redis integration (Session: Implementor-Redis, Started: 2026-01-11)

## 🟢 Complete
- [x] Project scaffolding (2026-01-10)
- [x] Architecture documentation (2026-01-11)

## 🔵 Blocked / Needs Review
- [ ] Auto-heal feature (Blocked: needs backend API first)
```

---

## Parallel Work Strategy

### Module Independence

Design modules to be **independently implementable**:

```
┌─────────────────────────────────────────────────────────────┐
│                     Shared Types/Interfaces                  │
│               (defined by Architect in docs/)                │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Backend    │      │  Frontend   │      │   Redis     │
│  API Module │      │  Dashboard  │      │  Service    │
│             │      │             │      │             │
│ Implementor │      │ Implementor │      │ Implementor │
│  Session A  │      │  Session B  │      │  Session C  │
└─────────────┘      └─────────────┘      └─────────────┘
```

### What Can Be Parallelized

| Module | Dependencies | Can Start After |
|--------|--------------|-----------------|
| Project scaffolding | None | Immediately |
| Backend API structure | Scaffolding | Scaffolding complete |
| Frontend structure | Scaffolding | Scaffolding complete |
| Redis service | Scaffolding | Scaffolding complete |
| Queue endpoints | Backend structure | Backend ready |
| Dashboard UI | Frontend structure | Frontend ready |
| Stuck job detection | Redis + Backend | Both ready |

---

## Advanced: Cursor Background Agents

Cursor has experimental **background agents** that can run tasks in parallel. Usage:

1. Open Command Palette: `Ctrl+Shift+P`
2. "Start Background Agent"
3. Give it a focused task: "Implement the Redis service based on @redis-integration.md"
4. Continue working in main session on different module

**Limitations**:
- Background agents are less interactive
- Best for well-specified, bounded tasks
- Main session should do Architect work

---

## Alternative: External Orchestration Tools

If you want more sophisticated orchestration:

### CrewAI (Python)
```python
from crewai import Agent, Task, Crew

architect = Agent(
    role='Software Architect',
    goal='Maintain system coherence',
    backstory='Expert in distributed systems',
    llm='claude-opus-4-5-20250514'
)

developer = Agent(
    role='Backend Developer', 
    goal='Implement backend modules',
    backstory='NestJS expert',
    llm='claude-opus-4-5-20250514'
)

# Define tasks, crew orchestrates
```

### GitHub Copilot Workspace
- Uses "Mission Control" for task delegation
- Tracks multiple agent tasks
- Good for larger teams

### When to Use External Tools

| Scenario | Recommendation |
|----------|----------------|
| Solo developer, small project | File-based coordination (this approach) |
| Team of 2-3 | File-based + occasional sync sessions |
| Larger team | CrewAI or similar framework |
| Enterprise | Full MAS framework (BeeAI, AgentMesh) |

---

## Getting Started: Immediate Next Steps

1. **Create the coordination files**:
   ```
   .cursor/rules           # Always-loaded context
   docs/ARCHITECTURE.md    # System design
   docs/TASK_BOARD.md      # Current tasks
   docs/modules/           # Module specs
   CHANGELOG.md            # History
   ```

2. **Scaffold the project** (single Architect session)

3. **Create module specs** (Architect session)

4. **Parallel implementation** (multiple Implementor sessions)

5. **Integration** (Architect session reviews, merges)

---

## Summary

| Approach | Pros | Cons |
|----------|------|------|
| **File-based coordination** | Simple, no external tools, works in Cursor | Manual task tracking |
| **Cursor background agents** | True parallelism | Experimental, less interactive |
| **CrewAI/external** | Sophisticated orchestration | Setup overhead, separate from IDE |

**Recommended for this project**: Start with file-based coordination. It's simple, effective for a project this size, and teaches you the principles without framework complexity.

---

*The key insight: The codebase IS the coordination mechanism. Well-structured docs enable any agent to understand context and contribute meaningfully.*
