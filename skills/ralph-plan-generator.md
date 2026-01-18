# Ralph Plan Generator Skill

## Description

Generates a structured implementation plan for Ralph Wiggum loops. Creates tasks with proper IDs, priorities, dependencies, and acceptance criteria that can be consumed by TypeScript code for autonomous iteration.

## When to Use

- Starting a new Ralph Wiggum loop
- Creating implementation plans from requirements
- Breaking down specifications into executable tasks
- Generating task lists for AI-driven development loops

## Usage Instructions

When invoked, follow this process:

1. **Analyze Requirements**: Read the user's requirements carefully
2. **Gather Context**: Use exploration tools to understand the codebase structure
3. **Identify Topics**: Break down requirements into "topics of concern"
4. **Generate Spec Files** (optional): Create `specs/[topic].md` files for complex projects
5. **Create Implementation Plan**: Generate a structured plan with tasks
6. **Output in Multiple Formats**: Provide both Markdown and JSON

## Output Format

### 1. Markdown Format (IMPLEMENTATION_PLAN.md)

```markdown
# Implementation Plan

## Overview
[Brief project description]

## Tasks

### Task 1: Task Title
**ID:** task-001
**Priority:** high|medium|low
**Dependencies:** task-000

**Description:**
[Detailed description of what to implement]

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

**Spec Reference:** [Topic](specs/topic.md)
---
```

### 2. JSON Format (for TypeScript consumption)

```json
{
  "projectName": "Project Name",
  "description": "Project description",
  "overview": "Brief overview",
  "tasks": [
    {
      "id": "task-001",
      "title": "Task Title",
      "description": "Detailed description",
      "priority": "high",
      "dependencies": ["task-000"],
      "acceptanceCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
      "specReference": "specs/topic.md",
      "estimatedComplexity": 3,
      "tags": ["frontend", "auth"]
    }
  ],
  "generatedAt": "2025-01-17T00:00:00.000Z",
  "totalTasks": 1,
  "estimatedDuration": "2-3 days"
}
```

## Task ID Format

Use sequential zero-padded IDs: `task-001`, `task-002`, `task-003`, etc.

## Priority Levels

- **high**: Critical path items, blocking other tasks
- **medium**: Important but not blocking
- **low**: Nice-to-have, can be deferred

## Dependency Guidelines

1. **Minimal Dependencies**: Only list actual blocking dependencies
2. **No Circular References**: Ensure the dependency graph is acyclic
3. **Clear Ordering**: Dependencies should represent logical sequencing
4. **Prerequisite Check**: All dependency IDs must exist in the plan

## Acceptance Criteria

Each task must have 1-5 acceptance criteria that:
- Are objectively verifiable (tests pass, file exists, etc.)
- Can be automatically checked
- Define clear completion conditions
- Use action verbs: "implements", "creates", "adds", "fixes"

## Complexity Estimation

1 = Trivial (1-2 lines, simple change)
2 = Simple (small function, clear scope)
3 = Moderate (multiple files, some complexity)
4 = Complex (significant logic, many files)
5 = Very Complex (architectural changes, high risk)

## Example Tasks

### Example 1: Setup Task
```markdown
### Task 1: Initialize TypeScript project
**ID:** task-001
**Priority:** high
**Dependencies:** task-000

**Description:**
Initialize a new TypeScript project with proper configuration. Set up package.json with all required dependencies and scripts.

**Acceptance Criteria:**
- [ ] package.json exists with tsconfig.json (ES2022, NodeNext)
- [ ] Dependencies installed: @anthropic-ai/claude-agent-sdk, zustand, ink
- [ ] Dev scripts: dev, build, test configured
- [ ] tsconfig.json configured correctly
- [ ] ESLint and Prettier configured (optional)

**Complexity:** 2
**Tags:** ["setup", "typescript"]
---
```

### Example 2: Feature Task
```markdown
### Task 2: Implement session store
**ID:** task-002
**Priority:** high
**Dependencies:** task-001

**Description:**
Create a Zustand store for managing session state. The store should track session ID, phase, current task, execution status, and metadata. Include methods for updating session state and getting progress.

**Acceptance Criteria:**
- [ ] src/store/sessionStore.ts exists
- [ ] Store exports useSessionStore hook
- [ ] State includes: sessionId, phase, currentTaskId, isExecuting, error
- [ ] Metadata includes: startedAt, lastActivity, totalTokens, totalCost
- [ ] Actions: setSession, updatePhase, setError, clearSession
- [ ] TypeScript types exported separately

**Spec Reference:** [State Management](specs/state-management.md)
**Complexity:** 3
**Tags:** ["state", "zustand", "store"]
---
```

### Example 3: Test Task
```markdown
### Task 3: Add tests for session store
**ID:** task-003
**Priority:** medium
**Dependencies:** task-002

**Description:**
Write comprehensive tests for the session store using Vitest. Test state updates, actions, and edge cases. Ensure >80% coverage.

**Acceptance Criteria:**
- [ ] src/store/__tests__/sessionStore.test.ts exists
- [ ] All state mutations tested
- [ ] All actions tested
- [ ] Edge cases covered (null checks, invalid state)
- [ ] Coverage >80%
- [ ] All tests pass: `npm run test:run`

**Complexity:** 2
**Tags:** ["testing", "vitest", "store"]
---
```

## Validation Checklist

Before finalizing the plan, ensure:

- [ ] All task IDs are unique and follow `task-XXX` format
- [ ] No circular dependencies exist
- [ ] All dependencies reference existing task IDs
- [ ] Each task has 1-5 acceptance criteria
- [ ] Acceptance criteria are objectively verifiable
- [ ] Tasks are ordered logically (dependencies first)
- [ ] Priorities are assigned appropriately
- [ ] High-priority tasks form a complete critical path
- [ ] Total complexity is reasonable for the project scope
- [ ] Spec references are valid (if provided)

## Integration with Ralph Loop

The generated plan should be saved to `IMPLEMENTATION_PLAN.md` and can be consumed by TypeScript code:

```typescript
import { planFromMarkdown, sortTasksByDependencies, getNextTask } from './skills/ralph-plan-generator.skill.js';

// Read the plan
const planContent = await fs.readFile('IMPLEMENTATION_PLAN.md', 'utf-8');
const plan = planFromMarkdown(planContent);

// Sort by dependencies
const sortedTasks = sortTasksByDependencies(plan.tasks);

// Get next task to execute
const completed = new Set<string>();
const nextTask = getNextTask(plan, completed);

if (nextTask) {
  console.log(`Executing: ${nextTask.id} - ${nextTask.title}`);
  // Execute task with AI...
}
```

## Special Considerations

1. **Granularity**: Tasks should be small enough to complete in 1-2 iterations
2. **Independence**: Maximize parallel execution by minimizing dependencies
3. **Verifiability**: Each task should have clear pass/fail criteria
4. **Testability**: Tasks should be testable after completion
5. **Atomicity**: Tasks should be complete units of work (no placeholders)

## Common Mistakes to Avoid

- ❌ Tasks that are too broad ("Implement the entire UI")
- ❌ Vague acceptance criteria ("Make it better")
- ❌ Missing dependencies (task assumes previous work exists)
- ❌ Over-specified acceptance criteria (implementation details, not outcomes)
- ❌ Unprioritized tasks (everything is high priority)
- ❌ Circular dependencies that make execution impossible
- ❌ Tasks without completion criteria (how do we know it's done?)

## Notes

- This skill generates plans for **autonomous execution**, not human project management
- Focus on **mechanical completion**, not creative direction
- Tasks should be **AI-executable** with minimal human intervention
- The plan becomes **shared state** between loop iterations
- Each iteration sees the updated plan and selects the next task
