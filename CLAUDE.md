# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ralph is a server-based AI development orchestrator powered by the "Ralph Wiggum technique" - run the same AI prompt repeatedly until tasks are complete, with git-backed branching for exploration and structured review at commit boundaries.

## Three-Component Architecture

### 1. Ralph Server

A TypeScript server that uses the Claude Code SDK to implement plans using the Ralph Wiggum methodology.

**Location:** `src/server.ts`

**Tech Stack:**
- Express 5.2.1 for HTTP API
- @anthropic-ai/claude-agent-sdk v0.2.8 for AI execution
- simple-git v3.22.0 for git operations
- TypeScript 5.x

**API Endpoints:**
- `POST /execute` - Start plan execution
- `GET /status/:sessionId` - Check execution status
- `GET /plans` - List available plans
- `GET /plans/:planId` - Get plan details
- `GET /sessions` - List active sessions
- `GET /health` - Health check

**Key Files:**
- `src/server.ts` - Express HTTP server
- `src/cli.ts` - CLI entry point
- `src/executor.ts` - Main executor logic

**Usage:**
```bash
# Start the server
npm run server

# CLI mode
ralph run [plan]

# Server mode
ralph server --port 3001

# Build
npm run build
```

### 2. Plan Generator Skill

A Claude Code skill that generates structured implementation plans from requirements.

**Location:** `skills/ralph-plan-generator.skill.ts`

**Functions:**
- `planFromMarkdown()` - Parse markdown to structured format
- `planToMarkdown()` - Convert structured plans to markdown
- `validateRalphPlan()` - Validate plan structure
- `sortTasksByDependencies()` - Topological sort for execution order
- `getNextTask()` - Get next pending task
- `calculateProgress()` - Calculate completion percentage

**Plan Format:**

```markdown
# Implementation Plan

## Overview
[Project description]

## Tasks

### Task 1: Task Title
**ID:** task-001
**Priority:** high|medium|low
**Dependencies:** task-000

**Description:**
[Detailed description]

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

---
```

### 3. Plan Sender Skill

A Claude Code skill that sends plans to the Ralph server for execution.

**Location:** `.claude/skills/ralph-executor/ralph-executor.skill.ts`

**Features:**
- Submits plans to Ralph server API
- Tracks execution progress via session IDs
- Retrieves task results
- Handles errors and retries
- Real-time status updates

**Usage in Claude Code:**
```
Use the ralph-executor skill to send the plan to the server.
```

## File System Structure

### Runtime State (.ralph/ - gitignored)
```
.ralph/
├── sessions/           # Session metadata JSON files
├── checkpoints/        # File checkpoint data
└── prompts/            # Task-specific prompts for execution
```

### Project Files
```
my-project/
├── plans/              # Generated implementation plans
│   └── web-ui/
│       └── IMPLEMENTATION_PLAN.md
└── .ralph/             # Runtime state (gitignored)
```

## The Ralph Wiggum Technique

The core philosophy: run the same AI prompt repeatedly until tasks are complete, with git-backed branching for exploration and structured review at commit boundaries.

### Execution Flow

1. **Planning Phase**
   - Generate `IMPLEMENTATION_PLAN.md` using plan generator skill
   - User reviews and edits tasks
   - Plan is validated for dependencies

2. **Execution Phase**
   - Select next task from plan
   - Create git checkpoint/worktree
   - Execute task with AI
   - Commit changes at task completion
   - Review diff

3. **Iteration Phase**
   - User: Approve | Iterate | Fork
   - Iterate: Re-run task with feedback
   - Fork: Create new branch for parallel exploration

### Session Structure

```typescript
interface RalphSession {
  sessionId: string;
  planPath: string;
  completedTasks: string[];
  currentTaskId?: string;
  taskHistory: TaskExecution[];
  startedAt: number;
  lastActivity: number;
}

interface TaskExecution {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: string;
}
```

## Configuration

Location: `~/.ralph/config.json`

```json
{
  "port": 3001,
  "autoSave": true,
  "autoCommit": true,
  "verbose": false,
  "maxParallelTasks": 3,
  "aiTimeout": 30000,
  "aiMaxRetries": 3
}
```

## Development Commands

```bash
# Ralph development
npm run build           # Compile TypeScript
npm run watch           # Watch mode
npm run server          # Start server
npm start               # CLI mode
```

## Technology Stack Summary

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript 5.x |
| **Server** | Express 5.2.1 |
| **AI SDK** | @anthropic-ai/claude-agent-sdk v0.2.8 |
| **Git Operations** | simple-git v3.22.0 |
| **Testing** | Vitest v4.0.17 |

## Key Patterns

### Plan Parsing

```typescript
import { planFromMarkdown, validateRalphPlan } from './skills/ralph-plan-generator.skill';

// Parse markdown plan
const plan = planFromMarkdown(markdownContent);

// Validate structure
const errors = validateRalphPlan(plan);
if (errors.length > 0) {
  console.error('Invalid plan:', errors);
}
```

### Server Communication

```typescript
// Submit plan for execution
const response = await fetch('http://localhost:3001/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ planPath: './plans/IMPLEMENTATION_PLAN.md' })
});

const { sessionId } = await response.json();

// Check status
const status = await fetch(`http://localhost:3001/status/${sessionId}`);
const { currentTask, progress } = await status.json();
```

### Task Execution

Each task is executed with a prompt that includes:
- Task description and acceptance criteria
- Context from completed tasks
- File system state
- Git history

## Git Commit Message Format

```
[task-001] Task Title

Task description...

Summary: Changed N file(s):
  - path/to/file1
  - path/to/file2
```

## Important Path Constants

- `RALPH_DIR = '.ralph'`
- `PLANS_DIR = 'plans'`
- `IMPLEMENTATION_PLAN_FILE = 'IMPLEMENTATION_PLAN.md'`

## Related Documentation

- [README.md](./README.md) - Project overview and getting started
- [ralph-wiggum-technique.md](./ralph-wiggum-technique.md) - Methodology deep dive
- [skills/ralph-plan-generator.md](./skills/ralph-plan-generator.md) - Plan generator documentation
