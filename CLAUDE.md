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
**Status:** To Do | In Progress | Implemented | Needs Re-Work | Verified
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

## Web UI Development Notes

### Important: Runtime Status Integration

When making changes to the web-ui code, it's critical to understand the dual-layer status system:

1. **Plan File Status** (`TaskStatus` type in plan-utils.ts)
   - Static status from markdown: "To Do" | "In Progress" | "Implemented" | "Needs Re-Work" | "Verified"
   - Used for manual plan editing and review
   - Located in `IMPLEMENTATION_PLAN.md` under `**Status:**` field

2. **Runtime Status** (`TaskStatus` type in lib/ralph/status.ts)
   - Dynamic status from execution: "pending" | "in-progress" | "completed" | "blocked" | "failed"
   - Read from `.ralph/sessions/` directory and git commit history
   - Used for dashboard and progress tracking

### API Layer Changes

**Always update BOTH API endpoints when modifying status behavior:**

1. `/api/plans` (plural) - Dashboard/plan list endpoint
   - Returns summary for all plans
   - Uses `getPlanStatusSummary(plan, projectRoot)`
   - Must include `progress`, `completedTasks`, `inProgressTasks`, `failedTasks`

2. `/api/plans/[id]` (singular) - Plan detail endpoint
   - Returns full plan with task-level statuses
   - Uses `getTaskStatus(plan, projectRoot)` + `getPlanStatusSummary(plan, projectRoot)`
   - Must attach `runtimeStatus` to each task
   - Must include `runtimeStatus` summary object

### Component Changes

When updating UI components for status:

1. **PlanCard** (`components/PlanCard.tsx`)
   - Accept `progress?: number` prop for pre-calculated percentage
   - Fall back to calculating from `completedTasks / totalTasks` if not provided

2. **PlanList** (`components/PlanList.tsx`)
   - Pass `progress` from API to PlanCard
   - Update `PlanData` interface to include `progress?: number`

3. **PlanDetail** (`components/PlanDetail.tsx`)
   - Use `plan.runtimeStatus?.progress` instead of hardcoded values
   - Handle null/undefined states gracefully

4. **TaskList** & **TaskItem** (`components/TaskList.tsx`, `components/TaskItem.tsx`)
   - Use `runtimeStatus` from task objects
   - Display appropriate icons per status state

### Development Workflow

1. **Server-side code (API routes, lib/ralph/status.ts):**
   - Uses `lib/ralph/status.ts` (no `src/` prefix)
   - Can access file system directly
   - Imports use `../../../../lib/ralph/status` relative to `app/api/` directory

2. **Client-side code (React components):**
   - Uses `src/lib/ralph/status.ts` for types
   - Cannot import server-side functions (file system access not allowed)
   - Receives pre-calculated status from API

3. **Hot reload behavior:**
   - `npm run dev` auto-reloads on file changes
   - If you see 404s for `.js`/`.css` resources, restart the server
   - API changes require rebuild to pick up new static assets

### Common Pitfalls

1. **Status not updating:**
   - Check if `lib/ralph/status.ts` exports are being used correctly
   - Verify `getPlanStatusSummary()` and `getTaskStatus()` are called
   - Ensure `.ralph/sessions/` directory exists with valid session data

2. **Progress showing 0%:**
   - API routes might be returning hardcoded zeros
   - Check lines with `completedTasks: 0` in `app/api/plans/route.ts`
   - Verify `statusSummary.completed` is being returned, not hardcoded

3. **404 errors after changes:**
   - Next.js dev server needs to rebuild static assets
   - Kill and restart `npm run dev` if auto-reload fails
   - Check build output for TypeScript errors before assuming it compiled
