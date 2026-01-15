# Implementation Phase Specification

## Overview

The Implementation Phase is where AI agents execute the tasks defined in the implementation plan. This phase emphasizes autonomous execution with human review at task boundaries.

## Goals

1. Execute tasks from IMPLEMENTATION_PLAN.md sequentially
2. Create git commits at task boundaries for review
3. Support branching and exploration of alternatives
4. Maintain clear audit trail of all changes

## Core Loop

```
For each task in IMPLEMENTATION_PLAN.md:
  1. Select task (all dependencies satisfied)
  2. Create checkpoint (or restore from existing)
  3. Execute task with AI agent
  4. Detect completion (via hook)
  5. Create commit with task message
  6. Present diff for review
  7. User action:
     - Approve: Mark complete, continue
     - Iterate: Continue session with feedback
     - Fork: Create branch, explore alternative
  8. Repeat until all tasks complete
```

## Components

### TaskExecutor

Orchestrates the execution of a single task.

```typescript
interface TaskExecutionOptions {
  task: Task
  sessionId: string
  worktreePath: string
  onProgress: (update: ProgressUpdate) => void
  onComplete: (result: TaskResult) => void
}

class TaskExecutor {
  sessionManager: SessionManager
  branchManager: BranchManager
  hooks: HookRegistry

  // Execute a single task
  async execute(options: TaskExecutionOptions): Promise<TaskResult>

  // Execution lifecycle
  private async prepareWorktree(task: Task): Promise<string>
  private async startAgentSession(task: Task): Promise<string>
  private async monitorProgress(sessionId: string): Promise<void>
  private async detectCompletion(sessionId: string): Promise<boolean>
  private async createCommit(task: Task): Promise<string>
}

interface TaskResult {
  success: boolean
  commitHash: string
  filesChanged: string[]
  summary: string
  error?: Error
}
```

### BranchManager

Manages git worktrees for parallel exploration.

```typescript
class BranchManager {
  git: SimpleGit
  projectRoot: string
  worktreeRoot: string  // .ralph/worktrees/

  // Worktree lifecycle
  async createWorktree(baseCommit: string, branchName: string): Promise<Worktree>
  async removeWorktree(branchName: string): Promise<void>
  async getWorktree(branchName: string): Promise<Worktree | null>
  async listWorktrees(): Promise<Worktree[]>

  // Branch operations
  async createBranch(name: string, startPoint: string): Promise<void>
  async deleteBranch(name: string, force?: boolean): Promise<void>
  async getCurrentBranch(): Promise<string>
  async switchBranch(branchName: string): Promise<void>
  async mergeBranch(source: string, target: string): Promise<MergeResult>

  // Commit operations
  async createCommit(message: string, files?: string[]): Promise<string>
  async getCommitDiff(commitHash: string): Promise<DiffResult>
  async getCommitInfo(commitHash: string): Promise<CommitInfo>

  // Branch tree for visualization
  async buildBranchTree(): Promise<BranchNode>
}

interface Worktree {
  name: string
  path: string
  branch: string
  commit: string
  basedOn: string  // Original commit/worktree
  createdAt: Date
}

interface BranchNode {
  name: string
  commit: string
  parent: BranchNode | null
  children: BranchNode[]
  status: 'active' | 'merged' | 'abandoned'
}
```

### CommitReviewer

Manages the review workflow for completed tasks.

```typescript
class CommitReviewer {
  branchManager: BranchManager
  commentStore: CommentStore

  // Present commit for review
  async presentCommit(commitHash: string): Promise<ReviewContext>

  // Handle user decision
  async handleDecision(
    commitHash: string,
    decision: 'approve' | 'iterate' | 'fork',
    feedback?: string
  ): Promise<DecisionResult>

  // Iteration: continue session with feedback
  async iterate(commitHash: string, feedback: string): Promise<string>

  // Fork: create new branch from commit
  async fork(commitHash: string, direction: string): Promise<ForkResult>
}

interface ReviewContext {
  commitHash: string
  task: Task
  diff: DiffResult
  files: FileChange[]
  comments: Comment[]
  summary: string
}

interface ForkResult {
  newBranchName: string
  newWorktreePath: string
  sessionId: string
}
```

### DiffViewer

TUI component for displaying and interacting with diffs.

```typescript
interface DiffViewerProps {
  diff: DiffResult
  comments: Comment[]
  selectedLine: number | null
  onAddComment: (line: number, content: string) => void
  onNavigate: (direction: 'up' | 'down') => void
}

interface DiffResult {
  files: FileDiff[]
  summary: {
    filesChanged: number
    insertions: number
    deletions: number
  }
}

interface FileDiff {
  path: string
  oldPath?: string  // For renames
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  hunks: DiffHunk[]
}

interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

interface DiffLine {
  type: 'context' | 'added' | 'removed'
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
  comments?: Comment[]
}
```

### CommentStore

Stores and retrieves inline comments on diffs.

```typescript
interface Comment {
  id: string
  commitHash: string
  filePath: string
  lineRange: [number, number] | null  // null = whole commit
  content: string
  author: 'user' | 'ai'
  timestamp: Date
  resolved: boolean
  replies?: Comment[]
}

class CommentStore {
  storagePath: string  // .ralph/comments/

  async addComment(comment: Comment): Promise<void>
  async getComments(commitHash: string): Promise<Comment[]>
  async resolveComment(commentId: string): Promise<void>
  async updateComment(commentId: string, content: string): Promise<void>
}
```

## Hook Integration

### TaskStart Hook

```typescript
const taskStartHook: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name === 'UserPromptSubmit') {
    // Update task status to in_progress
    await updateTaskStatus(currentTaskId, 'in_progress')

    // Send notification to TUI
    eventBus.emit('task:started', { taskId: currentTaskId })
  }
  return {}
}
```

### FileChangeTracking Hook

```typescript
const fileChangeTrackingHook: HookCallback = async (input) => {
  if (input.hook_event_name === 'PostToolUse') {
    const toolName = input.tool_name

    if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit') {
      const filePath = input.tool_input.file_path

      // Track changed file for task summary
      await trackChangedFile(currentTaskId, {
        path: filePath,
        tool: toolName,
        timestamp: new Date()
      })
    }
  }
  return {}
}
```

### TaskCompletion Hook

```typescript
const taskCompletionHook: HookCallback = async (input) => {
  if (input.hook_event_name === 'Stop') {
    // Task completed, prepare for review
    const changedFiles = await getChangedFilesForTask(currentTaskId)

    if (changedFiles.length > 0) {
      // Create commit
      const commitHash = await createTaskCommit(currentTaskId, changedFiles)

      // Trigger review workflow
      await triggerReview(currentTaskId, commitHash)
    } else {
      // No changes made, mark as complete without review
      await markTaskComplete(currentTaskId)
    }
  }
  return {}
}
```

### IterationPrompt Hook

```typescript
const iterationPromptHook: HookCallback = async (input) => {
  if (input.hook_event_name === 'UserPromptSubmit') {
    const prompt = input.user_input?.prompt || ''

    // Check if user is providing iteration feedback
    if (prompt.startsWith('//iterate:')) {
      const feedback = prompt.replace('//iterate:', '').trim()

      return {
        systemMessage: `The user provided feedback on your implementation:
"${feedback}"

Please address this feedback and continue working on the current task.`
      }
    }
  }
  return {}
}
```

## Forking Workflow

### Creating a Fork

```typescript
async function createFork(
  baseCommit: string,
  direction: string,
  baseSessionId: string
): Promise<ForkResult> {
  // 1. Create new branch
  const forkBranchName = `fork/${Date.now()}-${slugify(direction)}`
  await branchManager.createBranch(forkBranchName, baseCommit)

  // 2. Create worktree for fork
  const worktreePath = await branchManager.createWorktree(baseCommit, forkBranchName)

  // 3. Fork the session
  const forkedSession = query({
    prompt: direction,
    options: {
      resume: baseSessionId,
      forkSession: true,
      cwd: worktreePath
    }
  })

  // 4. Get new session ID
  let newSessionId: string
  for await (const msg of forkedSession) {
    if (msg.type === 'system' && msg.subtype === 'init') {
      newSessionId = msg.session_id
      break
    }
  }

  return {
    newBranchName: forkBranchName,
    newWorktreePath: worktreePath,
    sessionId: newSessionId
  }
}
```

### Managing Forks

The TUI displays all active forks in a branch tree view:

```
main (task-005 complete) ━━━ fork/1736891234-refactor-auth
                          ┗━━━━ fork/1736892456-new-database
```

User can:
- Switch context to a fork to continue work there
- Compare forks side-by-side
- Merge a fork back into main
- Abandon a fork (delete worktree)

## Review Workflow

### Review State Machine

```
[Task Complete]
  ↓
[Show Diff]
  ↓
User navigates diff, optionally adds comments
  ↓
User chooses action:
  ├─ Approve → [Mark Complete] → [Next Task]
  ├─ Iterate → [Resume Session] → [Show Updated Diff]
  └─ Fork → [Create Branch] → [Switch to Fork]
```

### Review UI Components

**DiffView Component:**
- Line-by-line diff display
- Syntax highlighting (if available)
- Line numbers for old/new files
- Comment indicators on commented lines
- Navigation: j/k (down/up), G (go to line)

**CommentPrompt Component:**
- Input field for adding comments
- Select line range first, then add comment
- Comments show in diff at relevant lines

**ActionMenu Component:**
```
Review Options:
  [A] Approve - Accept changes and continue
  [I] Iterate - Provide feedback for revision
  [F] Fork - Create alternative implementation
  [C] Add Comment - Add comment to selected lines
```

### Commit Message Format

Commits created at task boundaries follow this format:

```
feat(task-001): Implement user authentication

- POST /auth/register endpoint
- POST /auth/login endpoint
- JWT token generation
- Password hashing with bcrypt

Acceptance Criteria:
✓ Users can register with email/password
✓ Users can login with email/password
✓ JWT tokens generated correctly
✓ Passwords hashed with bcrypt

Files changed:
- src/api/auth.ts (added)
- src/middleware/auth.ts (added)
- src/services/user.ts (modified)

Task ID: task-001
Session: abc-123-def
Checkpoint: chk-456-ghi
```

## Checkpoint Management

### Creating Checkpoints

Before each task execution:

```typescript
async function createCheckpoint(worktreePath: string): Promise<string> {
  const checkpointId = `chk-${Date.now()}`

  // Capture file state
  const files = await getAllTrackedFiles(worktreePath)
  const fileStates = await Promise.all(
    files.map(async (file) => ({
      path: file,
      content: await readFile(path.join(worktreePath, file))
    }))
  )

  // Store checkpoint
  const checkpointData = {
    id: checkpointId,
    timestamp: new Date(),
    files: fileStates
  }

  await writeJson(
    path.join('.ralph/checkpoints', `${checkpointId}.json`),
    checkpointData
  )

  return checkpointId
}
```

### Restoring Checkpoints

If a task goes wrong, restore from checkpoint:

```typescript
async function restoreCheckpoint(
  checkpointId: string,
  worktreePath: string
): Promise<void> {
  const checkpointPath = path.join('.ralph/checkpoints', `${checkpointId}.json`)
  const checkpoint = await readJson(checkpointPath)

  for (const file of checkpoint.files) {
    const filePath = path.join(worktreePath, file.path)
    await writeFile(filePath, file.content)
  }
}
```

### Rewinding with SDK

```typescript
async function rewindToCheckpoint(
  sessionId: string,
  checkpointId: string
): Promise<void> {
  const query = await resumeSession(sessionId)

  for await (const msg of query) {
    // Rewind files to checkpoint
    await query.rewindFiles(checkpointId)
    break
  }
}
```

## Error Handling

### Task Execution Failures

```typescript
try {
  result = await taskExecutor.execute(task)
} catch (error) {
  if (error instanceof MaxTurnsReachedError) {
    // Task too complex, needs breakdown
    await suggestTaskBreakdown(task)
  } else if (error instanceof TestFailureError) {
    // Tests failing, show test output
    await showTestFailure(error.testOutput)
  } else {
    // Unknown error, log and offer manual intervention
    await logError(error)
    await offerManualIntervention(task)
  }
}
```

### Merge Conflicts (when merging forks)

```typescript
async function handleMergeConflict(
  sourceBranch: string,
  targetBranch: string
): Promise<void> {
  // Show conflict files
  const conflicts = await branchManager.getMergeConflicts(sourceBranch, targetBranch)

  // Offer options:
  // 1. Resolve in worktree
  // 2. Abort merge
  // 3. Use strategy (ours/theirs)

  const choice = await presentConflictResolution(conflicts)

  if (choice === 'resolve') {
    await openMergeTool(targetBranch)
  } else if (choice === 'abort') {
    await branchManager.abortMerge(targetBranch)
  }
}
```

## Progress Tracking

### Task Status Updates

```typescript
interface ProgressUpdate {
  taskId: string
  status: 'in_progress' | 'testing' | 'reviewing' | 'complete' | 'failed'
  message: string
  timestamp: Date
}

// Emit updates to TUI
eventBus.emit('task:progress', {
  taskId: 'task-001',
  status: 'testing',
  message: 'Running test suite...',
  timestamp: new Date()
})
```

### Overall Progress

```typescript
function calculateProgress(plan: ImplementationPlan): number {
  const totalTasks = plan.tasks.length
  const completedTasks = plan.tasks.filter(t => t.status === 'completed').length

  return (completedTasks / totalTasks) * 100
}
```

## Success Criteria

- All tasks completed and approved
- All commits pushed to git
- All temporary worktrees cleaned up
- Final diff summary generated
- Session archived

## Hooks Used

- **UserPromptSubmit**: Task start, iteration prompts, fork commands
- **PostToolUse**: File change tracking
- **Stop**: Task completion detection
- **PreCompact**: Save conversation history before compaction
