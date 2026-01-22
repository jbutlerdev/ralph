---
name: ralph-plan-generator
description: Generate structured implementation plans for Ralph autonomous development loops. Creates tasks with IDs, priorities, dependencies, and acceptance criteria for AI-driven development. Use when starting a new Ralph loop, breaking down specs into executable tasks, or creating task lists for autonomous iteration.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
user-invocable: true
---

# Ralph Plan Generator

## Description

Generates a structured implementation plan for Ralph Wiggum loops. Creates tasks with proper IDs, priorities, dependencies, and acceptance criteria that can be consumed by the Ralph executor server for autonomous iteration.

## When to Use

- Starting a new Ralph Wiggum loop
- Creating implementation plans from requirements
- Breaking down specifications into executable tasks
- Generating task lists for AI-driven development loops

## Usage Instructions

When invoked, follow this process:

### Step 1: Analyze Requirements

Read the user's requirements carefully. Identify:
- Core functionality needed
- Technical constraints
- Integration points
- Testing requirements

### Step 2: Gather Context

Use exploration tools to understand the codebase structure:
- Read existing code to understand patterns
- Identify relevant files and directories
- Note existing conventions and styles

### Step 3: Identify Topics of Concern

Break down requirements into logical "topics of concern":
- Each topic should be a cohesive unit of work
- Topics should have minimal cross-dependencies
- Consider: setup, core logic, integrations, tests, documentation

### Step 4: Create Implementation Plan

Generate a structured plan with tasks in the following Markdown format.

## Output Format

Create an `IMPLEMENTATION_PLAN.md` file in the `plans/<plan-name>/` directory:

```markdown
# Implementation Plan

## Overview
[Brief project description - 1-2 sentences explaining the goal]

**Project:** [Project Name]
**Total Tasks:** [N]
**Estimated Duration:** [X-Y days]

---

## Tasks

### Task 1: [Task Title]
**ID:** task-001
**Status:** To Do
**Priority:** high
**Dependencies:** task-000

**Description:**
[Detailed description of what to implement. Be specific about files to create/modify,
functions to implement, and patterns to follow.]

**Acceptance Criteria:**
- [ ] Criterion 1 - specific, verifiable condition
- [ ] Criterion 2 - another verifiable condition
- [ ] Criterion 3 - test or verification step

---

### Task 2: [Task Title]
**ID:** task-002
**Status:** To Do
**Priority:** medium
**Dependencies:** task-001

**Description:**
[Detailed description...]

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

---
```

## Task ID Format

Use sequential zero-padded IDs: `task-001`, `task-002`, `task-003`, etc.

The special ID `task-000` means "no dependencies" (task can start immediately).

## Status Values

- **To Do**: Task not yet started
- **In Progress**: Currently being worked on
- **Implemented**: Code complete, awaiting verification
- **Needs Re-Work**: Failed verification, needs fixes
- **Verified**: Complete and verified

## Priority Levels

- **high**: Critical path items, blocking other tasks
- **medium**: Important but not blocking
- **low**: Nice-to-have, can be deferred

## Dependency Guidelines

1. **Minimal Dependencies**: Only list actual blocking dependencies
2. **No Circular References**: Ensure the dependency graph is acyclic
3. **Clear Ordering**: Dependencies should represent logical sequencing
4. **Prerequisite Check**: All dependency IDs must exist in the plan
5. **Use task-000**: For tasks with no dependencies

## Acceptance Criteria Guidelines

Each task must have 1-5 acceptance criteria that:
- Are objectively verifiable (tests pass, file exists, function works, etc.)
- Can be automatically or manually checked
- Define clear completion conditions
- Use action verbs: "implements", "creates", "adds", "fixes", "returns"

Good examples:
- `src/utils/parser.ts exists and exports parseConfig function`
- `Unit tests pass: npm test -- parser.test.ts`
- `Function returns correct output for edge cases (null, empty array)`
- `API endpoint responds with 200 status for valid requests`

Bad examples:
- `Code is clean` (subjective)
- `Works correctly` (vague)
- `Implementation is good` (not verifiable)

## Plan Storage Convention

Store each plan in its own named folder under `plans/`:

```
plans/
├── web-ui/
│   └── IMPLEMENTATION_PLAN.md
├── api-server/
│   └── IMPLEMENTATION_PLAN.md
└── authentication/
    └── IMPLEMENTATION_PLAN.md
```

## Example Tasks

### Example 1: Setup Task

```markdown
### Task 1: Initialize project structure
**ID:** task-001
**Status:** To Do
**Priority:** high
**Dependencies:** task-000

**Description:**
Create the initial project structure with TypeScript configuration. Set up package.json with required dependencies and scripts. Configure tsconfig.json for ES2022 with NodeNext module resolution.

**Acceptance Criteria:**
- [ ] package.json exists with name, version, and scripts (dev, build, test)
- [ ] tsconfig.json configured with target ES2022, module NodeNext
- [ ] src/ directory created with index.ts entry point
- [ ] npm install completes without errors

---
```

### Example 2: Feature Implementation Task

```markdown
### Task 2: Implement user authentication service
**ID:** task-002
**Status:** To Do
**Priority:** high
**Dependencies:** task-001

**Description:**
Create an authentication service that handles user login and token generation. The service should use JWT for tokens with configurable expiration. Implement login, logout, and token refresh methods.

**Acceptance Criteria:**
- [ ] src/services/auth.ts exports AuthService class
- [ ] login(email, password) returns JWT token on success
- [ ] logout(token) invalidates the token
- [ ] refreshToken(token) returns new token if valid
- [ ] Tokens expire after configured duration (default 1 hour)

---
```

### Example 3: Testing Task

```markdown
### Task 3: Add unit tests for auth service
**ID:** task-003
**Status:** To Do
**Priority:** medium
**Dependencies:** task-002

**Description:**
Write comprehensive unit tests for the authentication service using the project's test framework. Mock external dependencies. Achieve >80% code coverage.

**Acceptance Criteria:**
- [ ] src/services/__tests__/auth.test.ts exists
- [ ] Tests cover login success and failure cases
- [ ] Tests cover token expiration handling
- [ ] Tests cover refresh token flow
- [ ] All tests pass: npm test
- [ ] Coverage report shows >80% for auth.ts

---
```

## Validation Checklist

Before finalizing the plan, ensure:

- [ ] All task IDs are unique and follow `task-XXX` format
- [ ] No circular dependencies exist
- [ ] All dependencies reference existing task IDs (or task-000)
- [ ] Each task has 1-5 acceptance criteria
- [ ] Acceptance criteria are objectively verifiable
- [ ] Tasks are ordered logically (dependencies come first in the list)
- [ ] Priorities are assigned appropriately
- [ ] High-priority tasks form a complete critical path
- [ ] Task descriptions are specific enough to implement without ambiguity

## Special Considerations

1. **Granularity**: Tasks should be small enough to complete in 1-3 AI iterations
2. **Independence**: Maximize parallel execution by minimizing dependencies
3. **Verifiability**: Each task should have clear pass/fail criteria
4. **Testability**: Consider adding test tasks after implementation tasks
5. **Atomicity**: Tasks should be complete units of work (no placeholders)

## Common Mistakes to Avoid

- ❌ Tasks that are too broad ("Implement the entire UI")
- ❌ Vague acceptance criteria ("Make it work")
- ❌ Missing dependencies (task assumes previous work exists)
- ❌ Over-specified implementation details (tell what, not exactly how)
- ❌ Everything marked as high priority
- ❌ Circular dependencies
- ❌ Tasks without completion criteria
- ❌ Acceptance criteria that require subjective judgment

## Notes

- This skill generates plans for **autonomous execution** by the Ralph server
- Focus on **mechanical completion**, not creative direction
- Tasks should be **AI-executable** with minimal human intervention
- The plan becomes **shared state** between execution iterations
- Each iteration sees the updated plan and selects the next task
