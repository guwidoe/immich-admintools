# Autonomous Agent Orchestration

> How to set up an AI orchestrator that **automatically spawns sub-agents** to build this project.

---

## Available Tools (2026)

| Tool | Type | Auto-Spawn | Parallel | Best For |
|------|------|------------|----------|----------|
| **Claude Code Subagents** | Native | ✅ Built-in | ⚠️ Sequential | Simple orchestration |
| **ccswarm** | Rust CLI | ✅ Yes | ✅ Git worktrees | Parallel dev with isolation |
| **Agor** | Extension | ✅ Non-blocking | ✅ Yes | Complex workflows |
| **Python Orchestrator** | Custom script | ✅ Yes | ✅ Yes | Full control |
| **CrewAI** | Python framework | ✅ Yes | ✅ Yes | Team simulation |
| **AutoGen Studio** | No-code UI | ✅ Visual | ✅ Yes | Rapid prototyping |

---

## Option 1: Claude Code Native Subagents (Recommended Start)

Claude Code has **built-in subagent support**. Agents are defined as Markdown files with YAML frontmatter.

### Setup

```
immich-admin-tools/
├── .claude/
│   └── agents/                    # Project-level agents
│       ├── architect.md
│       ├── backend-dev.md
│       ├── frontend-dev.md
│       └── code-reviewer.md
└── ...
```

### Agent Definition Example

```markdown
<!-- .claude/agents/architect.md -->
---
name: architect
description: System architect that maintains the big picture and spawns implementors
model: claude-opus-4-5-20250514
tools:
  - Read
  - Write
  - Bash
  - Task
allowed_tools:
  - all
---

# Architect Agent

You are the system architect for immich-admin-tools.

## Your Responsibilities
1. Read and maintain `docs/ARCHITECTURE.md`
2. Create module specs in `docs/modules/`
3. Delegate implementation to specialized sub-agents
4. Review integration between modules

## Before Starting Any Task
1. Read `docs/TASK_BOARD.md` to understand current state
2. Read `docs/ARCHITECTURE.md` for system design
3. Check `CHANGELOG.md` for recent changes

## How to Delegate
When you need implementation done, invoke the appropriate sub-agent:

"Use @backend-dev to implement the QueuesModule based on docs/modules/queues-module.md"
"Use @frontend-dev to create the dashboard components"
"Use @code-reviewer to review the recent changes"

## After Completing Work
1. Update `docs/TASK_BOARD.md`
2. Update `CHANGELOG.md`
3. If design changed, update `docs/ARCHITECTURE.md`
```

### Backend Developer Agent

```markdown
<!-- .claude/agents/backend-dev.md -->
---
name: backend-dev
description: NestJS backend specialist
model: claude-opus-4-5-20250514
tools:
  - Read
  - Write
  - Bash
allowed_tools:
  - Read
  - Write
  - Bash(npm, pnpm, node, tsc)
---

# Backend Developer Agent

You are a NestJS specialist working on immich-admin-tools.

## Your Focus
- `apps/server/` directory only
- NestJS modules, controllers, services
- TypeScript strict mode
- Follow Immich's patterns

## Before Coding
1. Read the module spec provided by architect
2. Check existing code patterns in the codebase
3. Understand the interfaces in `packages/shared/`

## Constraints
- Do NOT modify frontend code
- Do NOT change architecture without architect approval
- Always add tests for new features
- Use dependency injection

## After Completing
Report back to architect with:
- What was implemented
- Any interface changes needed
- Any blockers encountered
```

### Using Subagents

```bash
# In Claude Code CLI
claude

# Invoke architect to start
> @architect Let's begin implementing Phase 1. Read the task board and create a plan.

# Architect can then invoke sub-agents:
# "I'll delegate the backend work to @backend-dev..."
```

---

## Option 2: ccswarm - Parallel Git Worktree Orchestration

**ccswarm** is a Rust-based multi-agent orchestrator that:
- Spawns Claude Code agents in **isolated Git worktrees**
- Enables true **parallel development** without conflicts
- Auto-merges completed work

### Install

```bash
# Install from crates.io
cargo install ccswarm

# Or from source
git clone https://github.com/nwiizo/ccswarm
cd ccswarm
cargo install --path .
```

### Configuration

```yaml
# ccswarm.yaml
project:
  name: immich-admin-tools
  repo: .
  
agents:
  architect:
    role: orchestrator
    model: claude-opus-4-5-20250514
    context:
      - docs/ARCHITECTURE.md
      - docs/TASK_BOARD.md
    can_spawn:
      - backend-dev
      - frontend-dev
      - reviewer

  backend-dev:
    role: implementor
    model: claude-opus-4-5-20250514
    worktree: true  # Creates isolated branch
    scope:
      - apps/server/**
    context:
      - docs/modules/backend-*.md
      
  frontend-dev:
    role: implementor
    model: claude-opus-4-5-20250514
    worktree: true
    scope:
      - apps/web/**
    context:
      - docs/modules/frontend-*.md

  reviewer:
    role: validator
    model: claude-opus-4-5-20250514
    worktree: false  # Reviews in main
    
orchestration:
  parallel_limit: 3
  auto_merge: true
  merge_strategy: rebase
```

### Usage

```bash
# Start the orchestrator
ccswarm start

# Give it a task
ccswarm task "Implement Phase 1: project scaffolding, backend core, and frontend shell"

# ccswarm will:
# 1. Architect analyzes task
# 2. Creates sub-tasks for backend-dev and frontend-dev
# 3. Spawns them in parallel worktrees
# 4. Monitors progress
# 5. Reviewer validates
# 6. Auto-merges to main
```

---

## Option 3: Python Orchestrator Script

For maximum control, build a custom orchestrator that chains Claude Code commands.

### orchestrator.py

```python
#!/usr/bin/env python3
"""
Multi-agent orchestrator for immich-admin-tools.
Automatically spawns Claude Code sub-agents for parallel development.
"""

import subprocess
import json
import asyncio
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
from typing import Optional
import tempfile
import shutil

class AgentRole(Enum):
    ARCHITECT = "architect"
    BACKEND_DEV = "backend-dev"
    FRONTEND_DEV = "frontend-dev"
    REVIEWER = "reviewer"

@dataclass
class Task:
    id: str
    description: str
    assigned_to: AgentRole
    dependencies: list[str]
    status: str = "pending"
    result: Optional[str] = None

@dataclass
class Agent:
    role: AgentRole
    model: str
    system_prompt: str
    allowed_paths: list[str]
    
class Orchestrator:
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.tasks: dict[str, Task] = {}
        self.agents = self._init_agents()
        
    def _init_agents(self) -> dict[AgentRole, Agent]:
        return {
            AgentRole.ARCHITECT: Agent(
                role=AgentRole.ARCHITECT,
                model="claude-opus-4-5-20250514",
                system_prompt=self._load_prompt("architect"),
                allowed_paths=["docs/", "*.md"]
            ),
            AgentRole.BACKEND_DEV: Agent(
                role=AgentRole.BACKEND_DEV,
                model="claude-opus-4-5-20250514",
                system_prompt=self._load_prompt("backend-dev"),
                allowed_paths=["apps/server/", "packages/shared/"]
            ),
            AgentRole.FRONTEND_DEV: Agent(
                role=AgentRole.FRONTEND_DEV,
                model="claude-opus-4-5-20250514",
                system_prompt=self._load_prompt("frontend-dev"),
                allowed_paths=["apps/web/", "packages/shared/"]
            ),
            AgentRole.REVIEWER: Agent(
                role=AgentRole.REVIEWER,
                model="claude-opus-4-5-20250514",
                system_prompt=self._load_prompt("reviewer"),
                allowed_paths=["**"]
            ),
        }
    
    def _load_prompt(self, role: str) -> str:
        prompt_file = self.project_root / ".claude" / "agents" / f"{role}.md"
        if prompt_file.exists():
            return prompt_file.read_text()
        return f"You are a {role} agent."
    
    async def run_agent(self, agent: Agent, task: str, worktree: bool = False) -> str:
        """Run a Claude Code agent with the given task."""
        
        work_dir = self.project_root
        
        if worktree:
            # Create isolated git worktree for parallel work
            branch_name = f"agent/{agent.role.value}/{task[:20].replace(' ', '-')}"
            work_dir = await self._create_worktree(branch_name)
        
        # Build the Claude Code command
        cmd = [
            "claude",
            "--model", agent.model,
            "--system-prompt", agent.system_prompt,
            "--allowedTools", "Read,Write,Bash",
            "--print",  # Non-interactive mode
            task
        ]
        
        try:
            result = subprocess.run(
                cmd,
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout
            )
            return result.stdout
        finally:
            if worktree:
                await self._cleanup_worktree(work_dir, branch_name)
    
    async def _create_worktree(self, branch_name: str) -> Path:
        """Create a git worktree for isolated work."""
        worktree_dir = Path(tempfile.mkdtemp(prefix="agent_"))
        
        subprocess.run([
            "git", "worktree", "add", "-b", branch_name,
            str(worktree_dir), "HEAD"
        ], cwd=self.project_root, check=True)
        
        return worktree_dir
    
    async def _cleanup_worktree(self, worktree_dir: Path, branch_name: str):
        """Merge worktree changes and cleanup."""
        # Commit any changes
        subprocess.run(
            ["git", "add", "-A"],
            cwd=worktree_dir
        )
        subprocess.run(
            ["git", "commit", "-m", f"Agent work: {branch_name}"],
            cwd=worktree_dir
        )
        
        # Merge back to main
        subprocess.run(
            ["git", "checkout", "main"],
            cwd=self.project_root
        )
        subprocess.run(
            ["git", "merge", branch_name, "--no-ff"],
            cwd=self.project_root
        )
        
        # Cleanup
        subprocess.run(
            ["git", "worktree", "remove", str(worktree_dir)],
            cwd=self.project_root
        )
        shutil.rmtree(worktree_dir, ignore_errors=True)
    
    async def orchestrate(self, goal: str):
        """Main orchestration loop."""
        
        print(f"🎯 Goal: {goal}")
        print("=" * 60)
        
        # Step 1: Architect plans the work
        print("\n📐 Architect analyzing goal...")
        plan = await self.run_agent(
            self.agents[AgentRole.ARCHITECT],
            f"""Analyze this goal and create a task breakdown:
            
Goal: {goal}

Read docs/TASK_BOARD.md and docs/ARCHITECTURE.md first.
Then create specific, parallelizable tasks for:
- backend-dev (NestJS work)
- frontend-dev (SvelteKit work)

Output as JSON:
{{
  "tasks": [
    {{"id": "1", "role": "backend-dev", "task": "...", "depends_on": []}},
    {{"id": "2", "role": "frontend-dev", "task": "...", "depends_on": []}}
  ]
}}
"""
        )
        
        # Parse architect's plan
        tasks = self._parse_plan(plan)
        
        # Step 2: Execute parallelizable tasks
        print(f"\n🚀 Executing {len(tasks)} tasks...")
        
        # Group by dependencies
        independent = [t for t in tasks if not t.dependencies]
        dependent = [t for t in tasks if t.dependencies]
        
        # Run independent tasks in parallel
        parallel_tasks = []
        for task in independent:
            agent = self.agents[AgentRole(task.assigned_to)]
            parallel_tasks.append(
                self.run_agent(agent, task.description, worktree=True)
            )
        
        results = await asyncio.gather(*parallel_tasks)
        
        # Run dependent tasks sequentially
        for task in dependent:
            agent = self.agents[AgentRole(task.assigned_to)]
            result = await self.run_agent(agent, task.description, worktree=True)
        
        # Step 3: Review
        print("\n🔍 Code review...")
        review = await self.run_agent(
            self.agents[AgentRole.REVIEWER],
            "Review recent changes. Check for consistency, bugs, and adherence to architecture."
        )
        
        print("\n✅ Orchestration complete!")
        return results
    
    def _parse_plan(self, plan_output: str) -> list[Task]:
        """Extract tasks from architect's JSON output."""
        # Find JSON in output
        import re
        json_match = re.search(r'\{[\s\S]*\}', plan_output)
        if json_match:
            data = json.loads(json_match.group())
            return [
                Task(
                    id=t["id"],
                    description=t["task"],
                    assigned_to=t["role"],
                    dependencies=t.get("depends_on", [])
                )
                for t in data.get("tasks", [])
            ]
        return []

# Entry point
async def main():
    import sys
    
    project_root = Path(__file__).parent.parent
    orchestrator = Orchestrator(project_root)
    
    goal = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else \
           "Implement Phase 1: Project scaffolding with NestJS backend and SvelteKit frontend"
    
    await orchestrator.orchestrate(goal)

if __name__ == "__main__":
    asyncio.run(main())
```

### Usage

```bash
# Run orchestrator with a goal
python scripts/orchestrator.py "Implement the queue status endpoint and dashboard"

# The orchestrator will:
# 1. Ask architect to plan
# 2. Spawn backend-dev and frontend-dev in parallel worktrees
# 3. Merge their work
# 4. Run reviewer
```

---

## Option 4: CrewAI (Full Team Simulation)

CrewAI simulates an entire development team with defined roles.

### Install

```bash
pip install crewai crewai-tools
```

### crew.py

```python
from crewai import Agent, Task, Crew, Process
from crewai_tools import FileReadTool, FileWriteTool

# Tools
file_reader = FileReadTool()
file_writer = FileWriteTool()

# Agents
architect = Agent(
    role='Software Architect',
    goal='Design and maintain system architecture for immich-admin-tools',
    backstory='Expert in distributed systems and Immich internals',
    tools=[file_reader, file_writer],
    llm='claude-opus-4-5-20250514',
    verbose=True
)

backend_dev = Agent(
    role='Backend Developer',
    goal='Implement NestJS backend modules',
    backstory='NestJS and TypeScript expert',
    tools=[file_reader, file_writer],
    llm='claude-opus-4-5-20250514',
    verbose=True
)

frontend_dev = Agent(
    role='Frontend Developer', 
    goal='Build SvelteKit UI with @immich/ui components',
    backstory='Svelte and Tailwind CSS specialist',
    tools=[file_reader, file_writer],
    llm='claude-opus-4-5-20250514',
    verbose=True
)

# Tasks
design_task = Task(
    description='Read IMPLEMENTATION_PLAN.md and create module specs for Phase 1',
    expected_output='Module specifications in docs/modules/',
    agent=architect
)

backend_task = Task(
    description='Implement NestJS project structure based on architect specs',
    expected_output='Working NestJS app in apps/server/',
    agent=backend_dev,
    dependencies=[design_task]
)

frontend_task = Task(
    description='Implement SvelteKit project with @immich/ui',
    expected_output='Working SvelteKit app in apps/web/',
    agent=frontend_dev,
    dependencies=[design_task]
)

# Crew
crew = Crew(
    agents=[architect, backend_dev, frontend_dev],
    tasks=[design_task, backend_task, frontend_task],
    process=Process.hierarchical,  # Architect manages others
    manager_agent=architect,
    verbose=True
)

# Run
result = crew.kickoff()
print(result)
```

---

## Option 5: Hybrid Approach (Recommended)

Combine the best of each:

```
┌─────────────────────────────────────────────────────────────┐
│                    Python Orchestrator                       │
│              (scripts/orchestrator.py)                       │
│                                                              │
│  • Parses goals into tasks                                  │
│  • Manages git worktrees for isolation                      │
│  • Coordinates parallel execution                           │
│  • Handles merging                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
           Spawns Claude Code with...
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  @architect │ │ @backend-dev│ │@frontend-dev│
│             │ │             │ │             │
│ Claude Code │ │ Claude Code │ │ Claude Code │
│  subagent   │ │   worktree  │ │   worktree  │
│             │ │   branch    │ │   branch    │
└─────────────┘ └─────────────┘ └─────────────┘
```

### Setup for This Project

```bash
# 1. Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 2. Create agent definitions
mkdir -p .claude/agents
# (Create architect.md, backend-dev.md, etc.)

# 3. Set up orchestrator
pip install asyncio  # Usually built-in

# 4. Run
python scripts/orchestrator.py "Build the MVP"
```

---

## Comparison: What Should You Use?

| Your Situation | Recommended Approach |
|----------------|---------------------|
| **Learning orchestration** | Claude Code subagents (simplest) |
| **Need true parallelism** | ccswarm or Python orchestrator |
| **Maximum control** | Python orchestrator (custom) |
| **Visual/no-code** | AutoGen Studio |
| **Team simulation** | CrewAI |
| **Production system** | Python orchestrator + monitoring |

---

## Quick Start for This Project

1. **Install Claude Code CLI**:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Create the agent definitions** (I'll create these next)

3. **Run architect to spawn workers**:
   ```bash
   claude @architect "Implement Phase 1 based on IMPLEMENTATION_PLAN.md"
   ```

The architect will automatically invoke `@backend-dev` and `@frontend-dev` as needed.

---

## Next Steps

1. Should I create the Claude Code subagent definitions (`.claude/agents/*.md`)?
2. Or set up the Python orchestrator for full parallel execution?
3. Or both?

The subagents are quick to set up and work immediately. The orchestrator gives you more power but needs more setup.
