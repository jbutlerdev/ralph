# Ralph TUI Orchestrator - Architecture

## Technology Stack

### Core
- **Language**: TypeScript 5.x
- **Runtime**: Node.js 18+
- **TUI Framework**: [ink](https://github.com/vadimdemedes/ink) - React for CLIs
- **State Management**: Zustand (lightweight, simple)

### AI Integration
- **SDK**: `@anthropic-ai/claude-agent-sdk`
- **Model**: Claude Sonnet 4.5 (balanced speed/capability)
- **Features Used**:
  - Session resumption
  - Hooks (Stop, PostToolUse, UserPromptSubmit)
  - File checkpointing
  - Subagents for parallel exploration

### Git Operations
- **Core**: `simple-git` (TypeScript wrapper)
- **Worktrees**: Native git worktree commands via simple-git

### Diff/Review
- **Diff Generation**: `diff` package or git built-in
- **Diff Display**: Custom ink component with line-by-line view
- **Comments**: Store in `.ralph/comments/` directory indexed by commit hash

## Project Structure

```
ralph/
├── src/
│   ├── core/
│   │   ├── RalphSession.ts          # Main orchestrator
│   │   ├── SessionManager.ts        # SDK session lifecycle
│   │   ├── HookRegistry.ts          # Hook registration and dispatch
│   │   └── EventDispatcher.ts       # Pub/sub for TUI updates
│   │
│   ├── planning/
│   │   ├── Planner.ts               # Planning phase orchestrator
│   │   ├── SpecGenerator.ts         # AI-driven spec creation
│   │   ├── PlanParser.ts            # Parse IMPLEMENTATION_PLAN.md
│   │   └── PlanValidator.ts         # Validate plan structure
│   │
│   ├── implementation/
│   │   ├── TaskExecutor.ts          # Execute single task
│   │   ├── BranchManager.ts         # Git worktree management
│   │   ├── CommitReviewer.ts        # Commit review workflow
│   │   ├── DiffViewer.ts            # Diff display component
│   │   └── CommentStore.ts          # Inline comments on diffs
│   │
│   ├── ui/
│   │   ├── App.tsx                  # Root ink component
│   │   ├── components/
│   │   │   ├── PlanView.tsx         # Plan display and editing
│   │   │   ├── TaskList.tsx         # Task progress view
│   │   │   ├── DiffView.tsx         # Line-by-line diff viewer
│   │   │   ├── BranchView.tsx       # Branch tree visualization
│   │   │   ├── StatusBar.tsx        # Bottom status bar
│   │   │   ├── InputPrompt.tsx      # User input area
│   │   │   └── ProgressIndicator.tsx # Visual progress
│   │   ├── hooks/
│   │   │   ├── useSession.ts        # Session state hook
│   │   │   ├── usePlan.ts           # Plan state hook
│   │   │   ├── useBranches.ts       # Git branches hook
│   │   │   └── useKeypresses.ts     # Keyboard input handling
│   │   └── themes/
│   │       └── default.ts           # Color scheme and styling
│   │
│   ├── store/
│   │   ├── sessionStore.ts          # Session/agent state
│   │   ├── planStore.ts             # Plan/tasks state
│   │   ├── branchStore.ts           # Git branch state
│   │   └── uiStore.ts               # UI state (focus, mode)
│   │
│   ├── utils/
│   │   ├── git.ts                   # Git utility functions
│   │   ├── checkpoint.ts            # File checkpoint utilities
│   │   ├── logger.ts                # Structured logging
│   │   └── markdown.ts              # Markdown parsing/formatting
│   │
│   ├── constants/
│   │   ├── hooks.ts                 # Hook event names
│   │   ├── keys.ts                  # Keyboard shortcuts
│   │   └── paths.ts                 # File paths (.ralph/, specs/, etc.)
│   │
│   └── index.ts                     # CLI entry point
│
├── .ralph/                           # Runtime state (gitignored)
│   ├── sessions/                    # Session metadata
│   │   └── <session-id>.json
│   │
│   ├── checkpoints/                 # File checkpoint data
│   │   └── <checkpoint-id>.json
│   │
│   └── comments/                    # Diff comments
│       └── <commit-hash>.json
│
├── specs/                           # Requirements documents
│   ├── overview.md
│   ├── architecture.md
│   ├── planning-spec.md
│   ├── implementation-spec.md
│   └── ui-spec.md
│
├── IMPLEMENTATION_PLAN.md           # AI-generated plan (user-editable)
│
├── package.json
├── tsconfig.json
└── README.md
```

## Core Components

### RalphSession (Main Orchestrator)

```typescript
class RalphSession {
  // Phase management
  currentPhase: 'planning' | 'implementation' | 'review'

  // SDK integration
  sessionManager: SessionManager

  // Phase-specific orchestrators
  planner: Planner
  taskExecutor: TaskExecutor

  // Git management
  branchManager: BranchManager

  // Event dispatching
  events: EventDispatcher

  // Lifecycle
  async start()
  async transitionTo(phase: Phase)
  async shutdown()
}
```

### BranchManager (Git Worktree Operations)

```typescript
class BranchManager {
  git: SimpleGit

  // Worktree lifecycle
  async createWorktree(baseCommit: string, branchName: string): Promise<string>
  async removeWorktree(branchName: string): Promise<void>
  async listWorktrees(): Promise<Worktree[]>

  // Branch operations
  async createBranch(name: string, startPoint: string): Promise<void>
  async mergeBranch(source: string, target: string): Promise<void>
  async getBranchTree(): Promise<BranchNode[]>
}
```

### TaskExecutor (Task Execution Loop)

```typescript
class TaskExecutor {
  sessionManager: SessionManager

  // Execute a single task
  async executeTask(task: Task, sessionId: string): Promise<TaskResult>

  // Hook registration for task execution
  private registerPreTaskHooks(sessionId: string)
  private registerPostTaskHooks(sessionId: string)
  private registerCompletionHooks(sessionId: string)
}
```

### CommentStore (Diff Comments)

```typescript
interface Comment {
  id: string
  commitHash: string
  filePath: string
  lineRange: [number, number] | null
  content: string
  author: 'user' | 'ai'
  timestamp: Date
  resolved: boolean
}

class CommentStore {
  basePath: string

  async addComment(comment: Comment): Promise<void>
  async getComments(commitHash: string): Promise<Comment[]>
  async resolveComment(commentId: string): Promise<void>
}
```

## Data Flow

### Planning Phase Flow

```
User Input
  ↓
UserPromptSubmit Hook
  ↓
SpecGenerator (AI) → Creates specs/[topic].md
  ↓
Planner parses specs → Generates IMPLEMENTATION_PLAN.md
  ↓
User reviews and edits plan
  ↓
User approves → Transition to Implementation
```

### Implementation Phase Flow

```
Select next task from IMPLEMENTATION_PLAN.md
  ↓
BranchManager.createWorktree(taskCheckpoint)
  ↓
TaskExecutor.executeTask(sessionId, task)
  ↓
AI executes → Makes file changes
  ↓
PostToolUse Hook → Tracks changes
  ↓
Stop Hook → Task completion detected
  ↓
Commit changes with task message
  ↓
DiffViewer shows diff
  ↓
User: Approve | Iterate | Fork
  ↓
If Approve: Mark task complete, continue
If Iterate: Continue session with feedback
If Fork: Create new branch, switch context
```

### Fork/Branch Flow

```
User selects "Fork" at commit review
  ↓
BranchManager.createBranch('topic/fork-<n>', currentCommit)
  ↓
BranchManager.createWorktree(currentCommit, 'topic/fork-<n>')
  ↓
User provides direction for fork
  ↓
TaskExecutor continues in new worktree
  ↓
Parallel execution state maintained
  ↓
Later: User can merge fork or keep separate
```

## State Management

### sessionStore

```typescript
interface SessionState {
  sessionId: string | null
  phase: 'idle' | 'planning' | 'implementation' | 'review'
  currentTaskId: string | null
  isExecuting: boolean
  lastCheckpoint: string | null
  error: Error | null
}
```

### planStore

```typescript
interface PlanState {
  plan: ImplementationPlan | null
  tasks: Task[]
  currentTaskIndex: number
  completedTasks: string[]
  selectedTaskId: string | null
}

interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: number
  dependencies: string[]
  commitHash: string | null
  checkpointId: string | null
}
```

### branchStore

```typescript
interface BranchState {
  currentBranch: string
  branches: BranchInfo[]
  worktrees: WorktreeInfo[]
  branchTree: BranchNode[]
  selectedBranch: string | null
}

interface BranchInfo {
  name: string
  commitHash: string
  parent: string | null
  isMain: boolean
  status: 'active' | 'merged' | 'abandoned'
}
```

### uiStore

```typescript
interface UIState {
  currentView: 'plan' | 'tasks' | 'diff' | 'branches'
  focus: 'main' | 'sidebar' | 'input'
  mode: 'view' | 'edit' | 'review'
  selectedCommit: string | null
  keyHints: string[]
}
```

## Hook Integration

### PreTaskCommit Hook

```typescript
const preTaskCommitHook: HookCallback = async (input) => {
  if (input.hook_event_name === 'PostToolUse') {
    const toolInput = input.tool_input
    if (toolInput?.file_path) {
      // Track file change for task summary
      trackFileChange(toolInput.file_path)
    }
  }
  return {}
}
```

### TaskCompletion Hook

```typescript
const taskCompletionHook: HookCallback = async (input) => {
  if (input.hook_event_name === 'Stop') {
    // Task completed, trigger commit workflow
    const changes = await getUncommittedChanges()
    if (changes.length > 0) {
      await triggerCommitReview(changes)
    }
  }
  return {}
}
```

### ForkHook

```typescript
const forkHook: HookCallback = async (input) => {
  if (input.hook_event_name === 'UserPromptSubmit') {
    const prompt = input.user_input?.prompt || ''
    if (prompt.startsWith('//fork:')) {
      // Extract fork parameters
      const forkDirection = prompt.replace('//fork:', '').trim()
      return {
        systemMessage: `Forking branch for: ${forkDirection}. Create new branch and continue implementation in this direction.`
      }
    }
  }
  return {}
}
```

## Error Handling Strategy

1. **SDK Errors**: Retry with exponential backoff, notify user
2. **Git Errors**: Surface with context, offer manual resolution
3. **File Checkpoint Failures**: Log warning, continue (non-critical)
4. **Session Corruption**: Offer recovery from last known good checkpoint
5. **UI Errors**: Show error overlay, maintain state integrity

## Security Considerations

1. **Sandboxing**: Always use sandbox mode for autonomous execution
2. **Permission Bypass**: Only within controlled worktrees
3. **Secret Protection**: Never expose .env files or secrets
4. **Worktree Isolation**: Each worktree has isolated environment
5. **Commit Validation**: Validate all commits before acceptance
