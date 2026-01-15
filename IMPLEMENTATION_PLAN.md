# Ralph TUI Orchestrator - Implementation Plan

## Overview

A TypeScript Terminal User Interface (TUI) that orchestrates the Ralph Wiggum technique - an autonomous AI-driven development methodology using the Claude Agent SDK. This project provides structured planning, git-backed branching for exploration, and comprehensive review workflows.

## Goals

1. **Planning Orchestration**: Guide users through AI-assisted spec and plan creation
2. **Implementation with Branching**: Execute tasks with git worktree-based parallel exploration
3. **Clear Reviews**: Present diffs, collect feedback, and enable iteration at task boundaries
4. **Visibility**: Always show plan state, progress, and current context

## Tasks

### Phase 1: Foundation

#### Task 1: Project Setup
**ID:** task-001
**Priority:** high
**Dependencies:** none

Initialize the TypeScript project with all dependencies and directory structure.

**Acceptance Criteria:**
- [ ] Node.js project with TypeScript 5.x
- [ ] Dependencies: ink, zustand, @anthropic-ai/claude-agent-sdk, simple-git
- [ ] Directory structure per architecture spec
- [ ] .gitignore for .ralph/, node_modules/
- [ ] package.json with dev/build/test scripts
- [ ] tsconfig.json for ES2022 target

---

#### Task 2: Store Implementation
**ID:** task-002
**Priority:** high
**Dependencies:** task-001

Implement Zustand stores for state management (session, plan, branch, UI).

**Acceptance Criteria:**
- [ ] sessionStore: session ID, phase, execution state
- [ ] planStore: tasks, progress tracking, completion status
- [ ] branchStore: git branches, worktrees, tree structure
- [ ] uiStore: current view, focus, mode
- [ ] All stores properly typed with TypeScript

---

#### Task 3: Git Integration
**ID:** task-003
**Priority:** high
**Dependencies:** task-001

Implement BranchManager for git worktree operations using simple-git.

**Acceptance Criteria:**
- [ ] Create/list/remove git worktrees
- [ ] Create/delete branches
- [ ] Create commits with structured messages
- [ ] Get commit diffs in structured format
- [ ] Build branch tree for visualization
- [ ] Error handling for git failures

---

#### Task 4: SDK Integration
**ID:** task-004
**Priority:** high
**Dependencies:** task-001

Implement SessionManager for Claude Agent SDK integration.

**Acceptance Criteria:**
- [ ] Create new SDK sessions
- [ ] Resume existing sessions
- [ ] Fork sessions for branching
- [ ] Register and manage hooks
- [ ] Capture session metadata
- [ ] Graceful error handling

---

### Phase 2: Planning

#### Task 5: Planning Core
**ID:** task-005
**Priority:** high
**Dependencies:** task-002, task-004

Implement planning phase orchestration with AI-driven spec and plan generation.

**Acceptance Criteria:**
- [ ] Planner orchestrates requirement gathering
- [ ] SpecGenerator creates specs/*.md using AI
- [ ] PlanParser parses IMPLEMENTATION_PLAN.md
- [ ] PlanValidator validates plan structure
- [ ] Transition to implementation phase

---

#### Task 6: Planning UI
**ID:** task-006
**Priority:** high
**Dependencies:** task-005

Implement planning phase TUI components (requirement gathering, spec review, plan review).

**Acceptance Criteria:**
- [ ] RequirementGatheringView for AI questions
- [ ] SpecReviewView for reviewing/editing specs
- [ ] PlanReviewView with drag-to-reorder tasks
- [ ] Approve button to start implementation

---

### Phase 3: Implementation

#### Task 7: Task Execution
**ID:** task-007
**Priority:** high
**Dependencies:** task-002, task-003, task-004

Implement task execution engine with checkpointing and hooks.

**Acceptance Criteria:**
- [ ] TaskExecutor runs single task with AI
- [ ] Checkpoint creation before execution
- [ ] Task completion detection via hooks
- [ ] Commit creation at task boundaries
- [ ] File change tracking during execution
- [ ] Error handling and recovery

---

#### Task 8: Commit Review
**ID:** task-008
**Priority:** high
**Dependencies:** task-003, task-007

Implement commit review workflow (approve/iterate/fork).

**Acceptance Criteria:**
- [ ] CommitReviewer presents diff for review
- [ ] Approve action marks task complete
- [ ] Iterate action continues session with feedback
- [ ] Fork action creates new branch
- [ ] CommentStore for inline diff comments

---

#### Task 9: Diff Viewer
**ID:** task-009
**Priority:** high
**Dependencies:** task-008

Implement diff viewer TUI component with navigation and commenting.

**Acceptance Criteria:**
- [ ] File-by-file diff display
- [ ] Line numbers for old/new files
- [ ] Syntax highlighting for code
- [ ] Navigation (j/k, PageUp/Down, g/G)
- [ ] Inline comment display
- [ ] Add comments to selected lines

---

### Phase 4: Branching

#### Task 10: Fork Management
**ID:** task-010
**Priority:** medium
**Dependencies:** task-003, task-004

Implement fork creation and management (create, switch, merge, abandon).

**Acceptance Criteria:**
- [ ] Create fork from commit (branch + worktree + session)
- [ ] Switch between active forks
- [ ] Merge fork back to main
- [ ] Delete/abandon fork

---

#### Task 11: Branch Visualization
**ID:** task-011
**Priority:** medium
**Dependencies:** task-010

Implement branch tree visualization with ASCII art.

**Acceptance Criteria:**
- [ ] BranchTreeView shows hierarchy
- [ ] ASCII art tree layout
- [ ] Branch status indicators
- [ ] Select and switch branches

---

### Phase 5: UI Polish

#### Task 12: Layout Components
**ID:** task-012
**Priority:** medium
**Dependencies:** task-002

Implement main TUI layout (header, sidebar, status bar, input).

**Acceptance Criteria:**
- [ ] Header shows project/phase/session
- [ ] Sidebar shows tasks/branches/progress
- [ ] StatusBar shows current state/cost/time
- [ ] InputPrompt for user input
- [ ] Contextual key hints
- [ ] Responsive to terminal size

---

#### Task 13: Task List View
**ID:** task-013
**Priority:** medium
**Dependencies:** task-012

Implement task list component for sidebar.

**Acceptance Criteria:**
- [ ] Show all tasks with status icons
- [ ] Highlight current task
- [ ] Show dependencies
- [ ] Task count progress

---

#### Task 14: Progress Indicators
**ID:** task-014
**Priority:** medium
**Dependencies:** task-012

Implement progress visualization (spinner, progress bar, task status).

**Acceptance Criteria:**
- [ ] ProgressIndicator for overall completion
- [ ] Spinner for active AI work
- [ ] Task status icons (✓→○⊗?)
- [ ] Real-time updates during execution

---

### Phase 6: Integration

#### Task 15: Hook Integration
**ID:** task-015
**Priority:** medium
**Dependencies:** task-004, task-007

Implement all hooks for task execution (TaskStart, FileChangeTracking, TaskCompletion, IterationPrompt).

**Acceptance Criteria:**
- [ ] TaskStart hook updates task status
- [ ] FileChangeTracking hook tracks changes
- [ ] TaskCompletion hook triggers review
- [ ] IterationPrompt hook handles feedback
- [ ] All hooks emit TUI events

---

#### Task 16: Event System
**ID:** task-016
**Priority:** medium
**Dependencies:** task-002

Implement event dispatcher for TUI updates.

**Acceptance Criteria:**
- [ ] EventDispatcher pub/sub system
- [ ] Events: task:started, task:progress, task:complete
- [ ] Components subscribe to relevant events
- [ ] Events trigger UI re-renders

---

#### Task 17: Error Handling
**ID:** task-017
**Priority:** medium
**Dependencies:** task-007, task-012

Implement error display and recovery.

**Acceptance Criteria:**
- [ ] ErrorOverlay for critical errors
- [ ] Inline errors for non-critical issues
- [ ] Recovery options for common errors
- [ ] Error logging to file

---

### Phase 7: Advanced Features

#### Task 18: Keyboard Navigation
**ID:** task-018
**Priority:** low
**Dependencies:** task-012

Implement comprehensive keyboard shortcuts (global, planning, implementation, review, vim mode).

**Acceptance Criteria:**
- [ ] Global shortcuts (Ctrl+C, ?, Tab)
- [ ] Planning shortcuts (n, e, d, Ctrl+A)
- [ ] Implementation shortcuts (Space, f, b)
- [ ] Review shortcuts (a, i, f, c)
- [ ] Vim mode option

---

#### Task 19: Notifications
**ID:** task-019
**Priority:** low
**Dependencies:** task-012

Implement notification system (toasts, confirm dialogs, actionable notifications).

**Acceptance Criteria:**
- [ ] Toast notifications for events
- [ ] Confirmation dialogs for destructive actions
- [ ] Auto-dismiss after duration
- [ ] Actionable notifications

---

#### Task 20: Help System
**ID:** task-020
**Priority:** low
**Dependencies:** task-018

Implement context-sensitive help and tutorial.

**Acceptance Criteria:**
- [ ] Help overlay shows current context shortcuts
- [ ] Tutorial mode for first-time users
- [ ] Inline tooltips
- [ ] Replayable tutorial

---

### Phase 8: Polish

#### Task 21: Configuration
**ID:** task-021
**Priority:** low
**Dependencies:** none

Implement user configuration system (~/.ralph/config.json).

**Acceptance Criteria:**
- [ ] Load config from ~/.ralph/config.json
- [ ] Theme selection
- [ ] Key binding selection
- [ ] Auto-save toggle
- [ ] Default branch strategy

---

#### Task 22: CLI Entry Point
**ID:** task-022
**Priority:** low
**Dependencies:** task-001

Implement command-line interface (init, open, status, help).

**Acceptance Criteria:**
- [ ] `ralph init` - Start new project
- [ ] `ralph open` - Open existing project
- [ ] `ralph status` - Show project status
- [ ] `ralph --help` - Show help

---

#### Task 23: Documentation
**ID:** task-023
**Priority:** low
**Dependencies:** all

Write comprehensive documentation.

**Acceptance Criteria:**
- [ ] README with installation and usage
- [ ] CONTRIBUTING.md for developers
- [ ] API documentation
- [ ] User guides (planning, implementation)
- [ ] Troubleshooting guide

---

## Task Summary

| Phase | Tasks | Priority | Estimated Complexity |
|-------|-------|----------|---------------------|
| Foundation | 4 (task-001 to task-004) | High | High |
| Planning | 2 (task-005 to task-006) | High | Medium |
| Implementation | 3 (task-007 to task-009) | High | High |
| Branching | 2 (task-010 to task-011) | Medium | Medium |
| UI Polish | 3 (task-012 to task-014) | Medium | Low |
| Integration | 3 (task-015 to task-017) | Medium | Medium |
| Advanced | 3 (task-018 to task-020) | Low | Low |
| Polish | 3 (task-021 to task-023) | Low | Low |

**Total Tasks:** 23

## Specification References

- [Overview](specs/overview.md)
- [Architecture](specs/architecture.md)
- [Planning Specification](specs/planning-spec.md)
- [Implementation Specification](specs/implementation-spec.md)
- [UI/UX Specification](specs/ui-spec.md)
- [Task Breakdown](specs/tasks.md)
