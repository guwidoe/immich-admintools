#!/usr/bin/env python3
"""
Multi-Agent Orchestrator for immich-admin-tools

This script coordinates multiple Claude Code agents working in parallel
on different parts of the codebase using Git worktrees for isolation.

Usage:
    python scripts/orchestrator.py "Implement Phase 1"
    python scripts/orchestrator.py --interactive
"""

import subprocess
import json
import asyncio
import argparse
import re
import shutil
import tempfile
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from datetime import datetime


class AgentRole(Enum):
    ARCHITECT = "architect"
    BACKEND_DEV = "backend-dev"
    FRONTEND_DEV = "frontend-dev"
    CODE_REVIEWER = "code-reviewer"


class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class Task:
    id: str
    description: str
    role: AgentRole
    dependencies: list[str] = field(default_factory=list)
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[str] = None
    error: Optional[str] = None


@dataclass 
class AgentConfig:
    role: AgentRole
    model: str
    prompt_file: Path
    allowed_paths: list[str]
    use_worktree: bool = True


class Orchestrator:
    def __init__(self, project_root: Path, verbose: bool = False):
        self.project_root = project_root
        self.verbose = verbose
        self.tasks: dict[str, Task] = {}
        self.worktrees: list[Path] = []
        
        # Agent configurations
        self.agents = {
            AgentRole.ARCHITECT: AgentConfig(
                role=AgentRole.ARCHITECT,
                model="claude-opus-4-5-20250514",
                prompt_file=project_root / ".claude/agents/architect.md",
                allowed_paths=["docs/", "*.md", ".claude/"],
                use_worktree=False  # Architect works on main
            ),
            AgentRole.BACKEND_DEV: AgentConfig(
                role=AgentRole.BACKEND_DEV,
                model="claude-opus-4-5-20250514",
                prompt_file=project_root / ".claude/agents/backend-dev.md",
                allowed_paths=["apps/server/", "packages/shared/"],
                use_worktree=True
            ),
            AgentRole.FRONTEND_DEV: AgentConfig(
                role=AgentRole.FRONTEND_DEV,
                model="claude-opus-4-5-20250514", 
                prompt_file=project_root / ".claude/agents/frontend-dev.md",
                allowed_paths=["apps/web/", "packages/shared/"],
                use_worktree=True
            ),
            AgentRole.CODE_REVIEWER: AgentConfig(
                role=AgentRole.CODE_REVIEWER,
                model="claude-opus-4-5-20250514",
                prompt_file=project_root / ".claude/agents/code-reviewer.md",
                allowed_paths=["**"],
                use_worktree=False
            ),
        }
    
    def log(self, message: str, level: str = "INFO"):
        """Print log message with timestamp."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        icons = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "WARNING": "⚠️",
            "ERROR": "❌",
            "AGENT": "🤖",
            "TASK": "📋",
        }
        icon = icons.get(level, "•")
        print(f"[{timestamp}] {icon} {message}")
    
    def load_system_prompt(self, agent: AgentConfig) -> str:
        """Load agent's system prompt from markdown file."""
        if agent.prompt_file.exists():
            content = agent.prompt_file.read_text()
            # Remove YAML frontmatter
            if content.startswith("---"):
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    return parts[2].strip()
            return content
        return f"You are a {agent.role.value} agent."
    
    async def create_worktree(self, branch_name: str) -> Path:
        """Create an isolated Git worktree for parallel work."""
        worktree_dir = Path(tempfile.mkdtemp(prefix=f"agent_{branch_name[:20]}_"))
        
        # Create branch and worktree
        try:
            subprocess.run(
                ["git", "worktree", "add", "-b", branch_name, str(worktree_dir), "HEAD"],
                cwd=self.project_root,
                check=True,
                capture_output=True
            )
            self.worktrees.append(worktree_dir)
            self.log(f"Created worktree: {worktree_dir.name}", "INFO")
            return worktree_dir
        except subprocess.CalledProcessError as e:
            self.log(f"Failed to create worktree: {e.stderr.decode()}", "ERROR")
            raise
    
    async def merge_worktree(self, worktree_dir: Path, branch_name: str) -> bool:
        """Commit changes in worktree and merge back to main."""
        try:
            # Stage and commit
            subprocess.run(["git", "add", "-A"], cwd=worktree_dir, check=True)
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=worktree_dir,
                capture_output=True,
                text=True
            )
            
            if result.stdout.strip():  # There are changes
                subprocess.run(
                    ["git", "commit", "-m", f"Agent work: {branch_name}"],
                    cwd=worktree_dir,
                    check=True,
                    capture_output=True
                )
                
                # Merge to main
                subprocess.run(["git", "checkout", "main"], cwd=self.project_root, check=True)
                subprocess.run(
                    ["git", "merge", branch_name, "--no-ff", "-m", f"Merge {branch_name}"],
                    cwd=self.project_root,
                    check=True
                )
                self.log(f"Merged {branch_name} to main", "SUCCESS")
            else:
                self.log(f"No changes in {branch_name}", "INFO")
            
            return True
        except subprocess.CalledProcessError as e:
            self.log(f"Merge failed: {e}", "ERROR")
            return False
    
    async def cleanup_worktree(self, worktree_dir: Path, branch_name: str):
        """Remove worktree and optionally delete branch."""
        try:
            subprocess.run(
                ["git", "worktree", "remove", str(worktree_dir), "--force"],
                cwd=self.project_root,
                capture_output=True
            )
            shutil.rmtree(worktree_dir, ignore_errors=True)
            self.worktrees.remove(worktree_dir)
        except Exception as e:
            self.log(f"Cleanup warning: {e}", "WARNING")
    
    async def run_agent(
        self,
        role: AgentRole,
        task: str,
        timeout: int = 600
    ) -> tuple[bool, str]:
        """
        Run a Claude Code agent with the given task.
        Returns (success, output).
        """
        agent = self.agents[role]
        work_dir = self.project_root
        branch_name = None
        worktree_dir = None
        
        try:
            # Create worktree if needed
            if agent.use_worktree:
                branch_name = f"agent/{role.value}/{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                worktree_dir = await self.create_worktree(branch_name)
                work_dir = worktree_dir
            
            # Load system prompt
            system_prompt = self.load_system_prompt(agent)
            
            # Build Claude Code command
            # Note: Adjust this based on your Claude Code CLI installation
            cmd = [
                "claude",
                "--print",  # Non-interactive, print output
                "--model", agent.model,
            ]
            
            self.log(f"Running {role.value}: {task[:50]}...", "AGENT")
            
            # Run Claude Code
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=work_dir
            )
            
            # Send the task
            full_prompt = f"{system_prompt}\n\n---\n\nTask: {task}"
            stdout, stderr = await asyncio.wait_for(
                process.communicate(full_prompt.encode()),
                timeout=timeout
            )
            
            output = stdout.decode()
            
            if process.returncode == 0:
                # Merge worktree changes if applicable
                if worktree_dir and branch_name:
                    await self.merge_worktree(worktree_dir, branch_name)
                return True, output
            else:
                return False, stderr.decode()
                
        except asyncio.TimeoutError:
            self.log(f"Agent {role.value} timed out", "ERROR")
            return False, "Timeout"
        except FileNotFoundError:
            self.log("Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code", "ERROR")
            return False, "Claude Code CLI not found"
        except Exception as e:
            self.log(f"Agent error: {e}", "ERROR")
            return False, str(e)
        finally:
            # Cleanup
            if worktree_dir and branch_name:
                await self.cleanup_worktree(worktree_dir, branch_name)
    
    def parse_architect_plan(self, output: str) -> list[Task]:
        """Extract task breakdown from architect's response."""
        tasks = []
        
        # Try to find JSON in the output
        json_match = re.search(r'\{[\s\S]*"tasks"[\s\S]*\}', output)
        if json_match:
            try:
                data = json.loads(json_match.group())
                for t in data.get("tasks", []):
                    role_str = t.get("role", "backend-dev")
                    try:
                        role = AgentRole(role_str)
                    except ValueError:
                        role = AgentRole.BACKEND_DEV
                    
                    tasks.append(Task(
                        id=t.get("id", str(len(tasks) + 1)),
                        description=t.get("task", t.get("description", "")),
                        role=role,
                        dependencies=t.get("depends_on", [])
                    ))
                return tasks
            except json.JSONDecodeError:
                pass
        
        # Fallback: Parse markdown task lists
        for match in re.finditer(r'- \[[ x]\] (.+?) \((@\w+-?\w*)\)', output):
            task_desc = match.group(1)
            agent_ref = match.group(2).replace("@", "")
            
            try:
                role = AgentRole(agent_ref)
            except ValueError:
                role = AgentRole.BACKEND_DEV
            
            tasks.append(Task(
                id=str(len(tasks) + 1),
                description=task_desc,
                role=role
            ))
        
        return tasks
    
    async def orchestrate(self, goal: str):
        """Main orchestration loop."""
        self.log(f"Goal: {goal}", "TASK")
        print("=" * 60)
        
        # Phase 1: Architect plans
        self.log("Phase 1: Architect creating plan...", "INFO")
        
        architect_prompt = f"""
Analyze this goal and create a detailed task breakdown:

Goal: {goal}

First, read these files:
- IMPLEMENTATION_PLAN.md
- docs/ARCHITECTURE.md  
- docs/TASK_BOARD.md

Then create specific, parallelizable tasks for specialized agents.

Output your plan as JSON:
{{
  "analysis": "Brief analysis of what needs to be done",
  "tasks": [
    {{
      "id": "1",
      "role": "backend-dev",
      "task": "Detailed task description with specific files to create/modify",
      "depends_on": []
    }},
    {{
      "id": "2", 
      "role": "frontend-dev",
      "task": "Detailed task description",
      "depends_on": []
    }}
  ]
}}

Use roles: backend-dev, frontend-dev
Mark dependencies between tasks using the "depends_on" array.
"""
        
        success, plan_output = await self.run_agent(AgentRole.ARCHITECT, architect_prompt)
        
        if not success:
            self.log("Architect failed to create plan", "ERROR")
            return False
        
        tasks = self.parse_architect_plan(plan_output)
        
        if not tasks:
            self.log("No tasks extracted from architect's plan", "WARNING")
            print("\nArchitect output:")
            print(plan_output[:2000])
            return False
        
        self.log(f"Architect created {len(tasks)} tasks", "SUCCESS")
        for task in tasks:
            self.tasks[task.id] = task
            self.log(f"  Task {task.id} ({task.role.value}): {task.description[:50]}...", "TASK")
        
        # Phase 2: Execute tasks
        self.log("\nPhase 2: Executing tasks...", "INFO")
        
        # Separate independent and dependent tasks
        independent = [t for t in tasks if not t.dependencies]
        dependent = [t for t in tasks if t.dependencies]
        
        # Run independent tasks in parallel
        if independent:
            self.log(f"Running {len(independent)} independent tasks in parallel...", "INFO")
            parallel_coroutines = []
            for task in independent:
                task.status = TaskStatus.IN_PROGRESS
                parallel_coroutines.append(
                    self.run_agent(task.role, task.description)
                )
            
            results = await asyncio.gather(*parallel_coroutines, return_exceptions=True)
            
            for task, result in zip(independent, results):
                if isinstance(result, Exception):
                    task.status = TaskStatus.FAILED
                    task.error = str(result)
                    self.log(f"Task {task.id} failed: {result}", "ERROR")
                else:
                    success, output = result
                    if success:
                        task.status = TaskStatus.COMPLETE
                        task.result = output
                        self.log(f"Task {task.id} complete", "SUCCESS")
                    else:
                        task.status = TaskStatus.FAILED
                        task.error = output
                        self.log(f"Task {task.id} failed", "ERROR")
        
        # Run dependent tasks sequentially
        for task in dependent:
            # Check if dependencies are complete
            deps_complete = all(
                self.tasks.get(dep_id, Task("", "", AgentRole.ARCHITECT)).status == TaskStatus.COMPLETE
                for dep_id in task.dependencies
            )
            
            if not deps_complete:
                self.log(f"Skipping task {task.id} - dependencies not met", "WARNING")
                continue
            
            task.status = TaskStatus.IN_PROGRESS
            success, output = await self.run_agent(task.role, task.description)
            
            if success:
                task.status = TaskStatus.COMPLETE
                task.result = output
                self.log(f"Task {task.id} complete", "SUCCESS")
            else:
                task.status = TaskStatus.FAILED
                task.error = output
                self.log(f"Task {task.id} failed", "ERROR")
        
        # Phase 3: Review
        self.log("\nPhase 3: Code review...", "INFO")
        success, review = await self.run_agent(
            AgentRole.CODE_REVIEWER,
            "Review all recent changes. Check for bugs, consistency with architecture, and code quality."
        )
        
        if success:
            self.log("Review complete", "SUCCESS")
        
        # Summary
        print("\n" + "=" * 60)
        self.log("Orchestration Summary", "INFO")
        
        completed = sum(1 for t in self.tasks.values() if t.status == TaskStatus.COMPLETE)
        failed = sum(1 for t in self.tasks.values() if t.status == TaskStatus.FAILED)
        
        self.log(f"Completed: {completed}/{len(self.tasks)}", "SUCCESS" if failed == 0 else "WARNING")
        if failed > 0:
            self.log(f"Failed: {failed}/{len(self.tasks)}", "ERROR")
        
        return failed == 0
    
    async def cleanup(self):
        """Clean up any remaining worktrees."""
        for worktree in self.worktrees[:]:  # Copy list to avoid modification during iteration
            try:
                subprocess.run(
                    ["git", "worktree", "remove", str(worktree), "--force"],
                    cwd=self.project_root,
                    capture_output=True
                )
                shutil.rmtree(worktree, ignore_errors=True)
            except:
                pass


async def interactive_mode(orchestrator: Orchestrator):
    """Run orchestrator in interactive mode."""
    print("\n🎮 Interactive Orchestrator Mode")
    print("Commands: 'goal <description>', 'status', 'quit'\n")
    
    while True:
        try:
            cmd = input("orchestrator> ").strip()
            
            if not cmd:
                continue
            elif cmd == "quit" or cmd == "exit":
                break
            elif cmd == "status":
                print(f"Tasks: {len(orchestrator.tasks)}")
                for task in orchestrator.tasks.values():
                    print(f"  [{task.status.value}] {task.id}: {task.description[:40]}...")
            elif cmd.startswith("goal "):
                goal = cmd[5:].strip()
                await orchestrator.orchestrate(goal)
            else:
                print(f"Unknown command: {cmd}")
        except KeyboardInterrupt:
            print("\nInterrupted")
            break
        except EOFError:
            break


async def main():
    parser = argparse.ArgumentParser(description="Multi-agent orchestrator for immich-admin-tools")
    parser.add_argument("goal", nargs="*", help="Goal to accomplish")
    parser.add_argument("--interactive", "-i", action="store_true", help="Run in interactive mode")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent
    orchestrator = Orchestrator(project_root, verbose=args.verbose)
    
    try:
        if args.interactive:
            await interactive_mode(orchestrator)
        elif args.goal:
            goal = " ".join(args.goal)
            await orchestrator.orchestrate(goal)
        else:
            # Default goal
            await orchestrator.orchestrate(
                "Implement Phase 1: Project scaffolding with NestJS backend and SvelteKit frontend"
            )
    finally:
        await orchestrator.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
