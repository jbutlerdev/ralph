# Implementation Task List

## Overview

This document breaks down the implementation of Ralph TUI Orchestrator into prioritized, actionable tasks.

## Phase 1: Foundation (High Priority)

### Task 1: Project Setup
**ID:** task-001
**Priority:** high
**Dependencies:** none

Initialize the project structure and dependencies.

**Acceptance Criteria:**
- [ ] Node.js project initialized with TypeScript
- [ ] Dependencies installed: ink, zustand, @anthropic-ai/claude-agent-sdk, simple-git
- [ ] Directory structure created per architecture spec
- [ ] .gitignore configured for .ralph/, node_modules/
- [ ] tsconfig.json configured for ES2022 target
- [ ] package.json with scripts for dev/build/test

**Files to Create:**
- package.json
- tsconfig.json
- src/index.ts
- src/core/RalphSession.ts (stub)
- src/store/*.ts (stubs)

---

### Task 2: Store Implementation
**ID:** task-002
**Priority:** high
**Dependencies:** task-001

Implement Zustand stores for state management.

**Acceptance Criteria:**
- [ ] sessionStore with session/phase/execution state
- [ ] planStore with task list and progress tracking
- [ ] branchStore with git branch/worktree state
- [ ] uiStore with view/focus/mode state
- [ ] Stores can be subscribed to for updates
- [ ] Store actions are properly typed

**Files:**
- src/store/sessionStore.ts
- src/store/planStore.ts
- src/store/branchStore.ts
- src/store/uiStore.ts

---

### Task 3: Git Integration
**ID:** task-003
**Priority:** high
**Dependencies:** task-001

Implement BranchManager for git worktree operations.

**Acceptance Criteria:**
- [ ] Can create and list git worktrees
- [ ] Can create and delete branches
- [ ] Can create commits with structured messages
- [ ] Can get commit diffs in structured format
- [ ] Can build branch tree for visualization
- [ ] Error handling for git failures

**Files:**
- src/implementation/BranchManager.ts
- src/utils/git.ts

---

### Task 4: SDK Integration
**ID:** task-004
**Priority:** high
**Dependencies:** task-001

Implement SessionManager for Claude Agent SDK integration.

**Acceptance Criteria:**
- [ ] Can create new SDK sessions
- [ ] Can resume existing sessions
- [ ] Can fork sessions
- [ ] Can register and manage hooks
- [ ] Can capture session metadata
- [ ] Can handle SDK errors gracefully

**Files:**
- src/core/SessionManager.ts
- src/core/HookRegistry.ts

---

## Phase 2: Planning (High Priority)

### Task 5: Planning Core
**ID:** task-005
**Priority:** high
**Dependencies:** task-002, task-004

Implement planning phase orchestration.

**Acceptance Criteria:**
- [ ] Planner orchestrates requirement gathering
- [ ] SpecGenerator creates spec files using AI
- [ ] PlanParser parses IMPLEMENTATION_PLAN.md
- [ ] PlanValidator validates plan structure
- [ ] Can transition from planning to implementation

**Files:**
- src/planning/Planner.ts
- src/planning/SpecGenerator.ts
- src/planning/PlanParser.ts
- src/planning/PlanValidator.ts
- src/planning/RequirementCollector.ts

---

### Task 6: Planning UI
**ID:** task-006
**Priority:** high
**Dependencies:** task-005

Implement planning phase TUI components.

**Acceptance Criteria:**
- [ ] RequirementGatheringView for AI questions
- [ ] SpecReviewView for reviewing generated specs
- [ ] PlanReviewView for editing the plan
- [ ] Drag-to-reorder tasks
- [ ] Approve button to start implementation

**Files:**
- src/ui/components/RequirementGatheringView.tsx
- src/ui/components/SpecReviewView.tsx
- src/ui/components/PlanReviewView.tsx

---

## Phase 3: Implementation (High Priority)

### Task 7: Task Execution
**ID:** task-007
**Priority:** high
**Dependencies:** task-002, task-003, task-004

Implement task execution engine.

**Acceptance Criteria:**
- [ ] TaskExecutor runs single task with AI
- [ ] Creates checkpoint before execution
- [ ] Detects task completion via hooks
- [ ] Creates commit at task completion
- [ ] Tracks file changes during execution
- [ ] Handles execution errors

**Files:**
- src/implementation/TaskExecutor.ts
- src/utils/checkpoint.ts

---

### Task 8: Commit Review
**ID:** task-008
**Priority:** high
**Dependencies:** task-003, task-007

Implement commit review workflow.

**Acceptance Criteria:**
- [ ] CommitReviewer presents diff for review
- [ ] Can approve task (mark complete)
- [ ] Can iterate with feedback
- [ ] Can fork from commit
- [ ] Loads comments for commit

**Files:**
- src/implementation/CommitReviewer.ts
- src/implementation/CommentStore.ts

---

### Task 9: Diff Viewer
**ID:** task-009
**Priority:** high
**Dependencies:** task-008

Implement diff viewer TUI component.

**Acceptance Criteria:**
- [ ] Displays file-by-file diffs
- [ ] Line numbers for old/new files
- [ ] Syntax highlighting for code
- [ ] Navigation with j/k, PageUp/Down, g/G
- [ ] Shows inline comments
- [ ] Can add comments to lines

**Files:**
- src/ui/components/DiffView.tsx
- src/ui/components/CommentPrompt.tsx
- src/ui/hooks/useKeypresses.ts

---

## Phase 4: Branching (Medium Priority)

### Task 10: Fork Management
**ID:** task-010
**Priority:** medium
**Dependencies:** task-003, task-004

Implement fork creation and management.

**Acceptance Criteria:**
- [ ] Can create fork from commit
- [ ] Fork creates new branch and worktree
- [ ] Fork creates new session (via SDK)
- [ ] Can switch between forks
- [ ] Can merge fork back to main
- [ ] Can abandon/delete fork

**Files:**
- src/implementation/ForkManager.ts

---

### Task 11: Branch Visualization
**ID:** task-011
**Priority:** medium
**Dependencies:** task-010

Implement branch tree visualization.

**Acceptance Criteria:**
- [ ] BranchTreeView shows branch hierarchy
- [ ] ASCII art tree layout
- [ ] Shows branch status (active/merged/abandoned)
- [ ] Can select branches
- [ ] Shows commits per branch

**Files:**
- src/ui/components/BranchTreeView.tsx
- src/ui/components/BranchView.tsx

---

## Phase 5: UI Polish (Medium Priority)

### Task 12: Layout Components
**ID:** task-012
**Priority:** medium
**Dependencies:** task-002

Implement main TUI layout.

**Acceptance Criteria:**
- [ ] Header shows project/phase/session
- [ ] Sidebar shows tasks/branches/progress
- [ ] StatusBar shows current state
- [ ] InputPrompt handles user input
- [ ] Key hints shown contextually
- [ ] Responsive to terminal size

**Files:**
- src/ui/App.tsx
- src/ui/components/Header.tsx
- src/ui/components/Sidebar.tsx
- src/ui/components/StatusBar.tsx
- src/ui/components/InputPrompt.tsx

---

### Task 13: Task List View
**ID:** task-013
**Priority:** medium
**Dependencies:** task-012

Implement task list component for sidebar.

**Acceptance Criteria:**
- [ ] Shows all tasks with status icons
- [ ] Highlights current task
- [ ] Shows dependencies
- [ ] Can select tasks
- [ ] Shows task count progress

**Files:**
- src/ui/components/TaskList.tsx

---

### Task 14: Progress Indicators
**ID:** task-014
**Priority:** medium
**Dependencies:** task-012

Implement progress visualization.

**Acceptance Criteria:**
- [ ] ProgressIndicator shows overall completion
- [ ] Spinner for active AI work
- [ ] Task status icons (✓→○⊗?)
- [ ] Real-time updates during execution

**Files:**
- src/ui/components/ProgressIndicator.tsx

---

## Phase 6: Integration & Testing (Medium Priority)

### Task 15: Hook Integration
**ID:** task-015
**Priority:** medium
**Dependencies:** task-004, task-007

Implement all hooks for task execution.

**Acceptance Criteria:**
- [ ] TaskStart hook updates task status
- [ ] FileChangeTracking hook tracks changes
- [ ] TaskCompletion hook triggers review
- [ ] IterationPrompt hook handles feedback
- [ ] All hooks emit events to TUI

**Files:**
- src/core/hooks/taskStart.ts
- src/core/hooks/fileChangeTracking.ts
- src/core/hooks/taskCompletion.ts
- src/core/hooks/iterationPrompt.ts

---

### Task 16: Event System
**ID:** task-016
**Priority:** medium
**Dependencies:** task-002

Implement event dispatcher for TUI updates.

**Acceptance Criteria:**
- [ ] EventDispatcher pub/sub system
- [ ] Events: task:started, task:progress, task:complete, etc.
- [ ] Components subscribe to relevant events
- [ ] Events trigger UI re-renders
- [ ] Event history for debugging

**Files:**
- src/core/EventDispatcher.ts

---

### Task 17: Error Handling
**ID:** task-017
**Priority:** medium
**Dependencies:** task-007, task-012

Implement error display and recovery.

**Acceptance Criteria:**
- [ ] ErrorOverlay shows errors clearly
- [ ] Inline errors for non-critical issues
- [ ] Recovery options for common errors
- [ ] Error logging to file
- [ ] Graceful degradation

**Files:**
- src/ui/components/ErrorOverlay.tsx
- src/utils/logger.ts

---

## Phase 7: Advanced Features (Low Priority)

### Task 18: Keyboard Navigation
**ID:** task-018
**Priority:** low
**Dependencies:** task-012

Implement comprehensive keyboard shortcuts.

**Acceptance Criteria:**
- [ ] Global shortcuts (Ctrl+C, ?, Tab)
- [ ] Planning shortcuts (n, e, d, Ctrl+A)
- [ ] Implementation shortcuts (Space, f, b)
- [ ] Review shortcuts (a, i, f, c)
- [ ] Vim mode option

**Files:**
- src/ui/hooks/useKeypresses.ts (extended)
- src/constants/keys.ts

---

### Task 19: Notifications
**ID:** task-019
**Priority:** low
**Dependencies:** task-012

Implement notification system.

**Acceptance Criteria:**
- [ ] Toast notifications for events
- [ ] Confirmation dialogs
- [ ] Auto-dismiss after duration
- [ ] Actionable notifications
- [ ] Notification history

**Files:**
- src/ui/components/Notification.tsx
- src/ui/components/ConfirmDialog.tsx

---

### Task 20: Help System
**ID:** task-020
**Priority:** low
**Dependencies:** task-018

Implement context-sensitive help.

**Acceptance Criteria:**
- [ ] Help overlay shows current context shortcuts
- [ ] Tutorial mode for first-time users
- [ ] Inline tooltips for complex features
- [ ] Can be replayed

**Files:**
- src/ui/components/HelpOverlay.tsx
- src/ui/components/Tutorial.tsx

---

## Phase 8: Polish & Documentation (Low Priority)

### Task 21: Configuration
**ID:** task-021
**Priority:** low
**Dependencies:** none

Implement user configuration system.

**Acceptance Criteria:**
- [ ] Load config from ~/.ralph/config.json
- [ ] Theme selection
- [ ] Key binding selection
- [ ] Auto-save toggle
- [ ] Default branch strategy

**Files:**
- src/config/ConfigLoader.ts
- src/config/UserPreferences.ts

---

### Task 22: CLI Entry Point
**ID:** task-022
**Priority:** low
**Dependencies:** task-001

Implement command-line interface.

**Acceptance Criteria:**
- [ ] `ralph init` - Start new project
- [ ] `ralph open` - Open existing project
- [ ] `ralph status` - Show project status
- [ ] `ralph --help` - Show help
- [ ] Proper argument parsing

**Files:**
- src/index.ts (CLI)
- src/cli/commands.ts

---

### Task 23: Documentation
**ID:** task-023
**Priority:** low
**Dependencies:** all

Write comprehensive documentation.

**Acceptance Criteria:**
- [ ] README with installation and usage
- [ ] CONTRIBUTING.md for developers
- [ ] API documentation for core modules
- [ ] User guide for planning phase
- [ ] User guide for implementation phase
- [ ] Troubleshooting guide

**Files:**
- README.md
- CONTRIBUTING.md
- docs/*.md

---

## Task Dependencies

```
task-001 (Project Setup)
  ├─→ task-002 (Store Implementation)
  ├─→ task-003 (Git Integration)
  └─→ task-004 (SDK Integration)
       ├─→ task-005 (Planning Core)
       │    └─→ task-006 (Planning UI)
       │
       └─→ task-007 (Task Execution)
            └─→ task-008 (Commit Review)
                 └─→ task-009 (Diff Viewer)
            └─→ task-010 (Fork Management)
                 └─→ task-011 (Branch Visualization)

task-002 ──→ task-012 (Layout Components)
     │         ├─→ task-013 (Task List View)
     │         └─→ task-014 (Progress Indicators)
     │
     └─→ task-016 (Event System)
          └─→ task-015 (Hook Integration)
               └─→ task-017 (Error Handling)

task-012 ──→ task-018 (Keyboard Navigation)
     └─→ task-019 (Notifications)
     └─→ task-020 (Help System)

task-001 ──→ task-021 (Configuration)
task-all ──→ task-022 (CLI Entry Point)
task-all ──→ task-023 (Documentation)
```

## Estimated Complexity

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Foundation | 4 | 8-12 hours |
| Phase 2: Planning | 2 | 6-8 hours |
| Phase 3: Implementation | 3 | 10-14 hours |
| Phase 4: Branching | 2 | 8-10 hours |
| Phase 5: UI Polish | 3 | 6-8 hours |
| Phase 6: Integration | 3 | 6-8 hours |
| Phase 7: Advanced | 3 | 4-6 hours |
| Phase 8: Polish | 2 | 4-6 hours |
| **Total** | **22** | **52-72 hours** |

## Next Steps

1. Review and prioritize this task list
2. Adjust based on specific requirements
3. Begin with Phase 1 tasks in order
4. Mark tasks as complete in IMPLEMENTATION_PLAN.md as you progress
