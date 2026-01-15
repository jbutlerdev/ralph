# UI/UX Specification

## Overview

The Ralph TUI is a terminal-based interface that provides visibility and control over the AI-driven development process. Built with [ink](https://github.com/vadimdemedes/ink) (React for CLI), it offers a responsive, keyboard-driven experience optimized for developers.

## Design Principles

1. **Keyboard-First**: All actions accessible via keyboard shortcuts
2. **Information-Dense**: Maximize screen real estate for content
3. **Clear Visual Hierarchy**: Use color and spacing to guide attention
4. **Responsive**: Update in real-time as AI works
5. **Non-Blocking**: UI remains responsive during long operations

## Layout

### Main Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: Ralph TUI - [Project Name]          Phase: [Planning]  │
├─────────────────┬───────────────────────────────────────────────┤
│                 │                                               │
│  Sidebar        │  Main Content Area                           │
│  (Plan/Status)  │  - Changes based on current view             │
│                 │                                               │
│  ├─ Tasks       │  Possible views:                             │
│  ├─ Progress    │  - PlanView                                  │
│  └─ Branches    │  - TaskList                                  │
│                 │  - DiffView                                  │
│                 │  - BranchTree                                │
│                 │                                               │
├─────────────────┴───────────────────────────────────────────────┤
│ Status Bar: [Current Task] | [Session ID] | [Cost: $0.00]     │
├─────────────────────────────────────────────────────────────────┤
│ Input Prompt: > [User input area]                              │
│           Key Hints: [A]pprove [I]terate [F]ork [?] Help      │
└─────────────────────────────────────────────────────────────────┘
```

### Components

#### Header

```typescript
interface HeaderProps {
  projectName: string
  phase: 'planning' | 'implementation' | 'review'
  sessionActive: boolean
}

// Displays:
// - Project name
// - Current phase
// - Session status indicator
// - Time elapsed in session
```

#### Sidebar

```typescript
interface SidebarProps {
  currentView: SidebarView
  tasks: Task[]
  branches: BranchInfo[]
  selectedTask: string | null
  onTaskSelect: (taskId: string) => void
}

type SidebarView = 'tasks' | 'branches' | 'progress'

// Task List View:
// - ✓ task-001: Database schema (completed)
// - → task-002: Auth API (in progress)
// - ○ task-003: User profile (pending)
// - ○ task-004: Post creation (blocked by task-003)

// Branch List View:
// - main (active)
//   └─ fork/173689-auth-refactor
//   └─ fork/173690-new-ui

// Progress View:
// - Overall progress: ████████░░ 80%
// - Tasks: 8/10 complete
// - Time elapsed: 2h 34m
// - Est. remaining: 45m
```

#### Main Content Area

**PlanView** - During planning phase:

```typescript
interface PlanViewProps {
  plan: ImplementationPlan
  selectedTask: Task | null
  onEditTask: (task: Task) => void
  onMoveTask: (taskId: string, direction: 'up' | 'down') => void
  onAddTask: () => void
  onDeleteTask: (taskId: string) => void
  onApprove: () => void
}

// Displays:
// - Plan overview
// - Task list (editable)
// - Dependency graph (visual)
// - Approve button
```

**DiffView** - During review phase:

```typescript
interface DiffViewProps {
  diff: DiffResult
  comments: Comment[]
  selectedLine: number | null
  onAddComment: (line: number, content: string) => void
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void
}

// Displays:
// - File list (left panel)
// - Diff content (right panel)
// - Line numbers
// - Syntax highlighting
// - Comment indicators
// - Navigation
```

**BranchTreeView** - Branch visualization:

```typescript
interface BranchTreeViewProps {
  branchTree: BranchNode
  selectedBranch: string | null
  onSelectBranch: (branchName: string) => void
  onMergeBranch: (branchName: string) => void
  onDeleteBranch: (branchName: string) => void
}

// Displays ASCII art tree:
// main ◯─────┬─ fork/173689-auth-refactor ○
//           │
//           └─ fork/173690-new-ui ○
```

#### Status Bar

```typescript
interface StatusBarProps {
  currentTask: Task | null
  sessionId: string
  totalCost: number
  currentPhase: Phase
  executing: boolean
}

// Displays:
// - Current task (or idle)
// - Session ID (shortened)
// - Total cost this session
// - Phase indicator
// - Execution spinner (if AI working)
```

#### Input Prompt

```typescript
interface InputPromptProps {
  placeholder: string
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  hints: KeyHint[]
  mode: 'command' | 'feedback' | 'normal'
}

interface KeyHint {
  key: string
  description: string
}

// Displays:
// - Input field
// - Key hints based on context
```

## Color Scheme

### Default Theme

```typescript
const theme = {
  colors: {
    // Semantic colors
    primary: '#6C5CE7',      // Purple - active elements
    success: '#00B894',      // Green - completed items
    warning: '#FDCB6E',      // Yellow - in progress
    danger: '#D63031',       // Red - errors/blocked
    info: '#0984E3',         // Blue - information

    // UI colors
    background: '#2D3436',   // Dark background
    foreground: '#DFE6E9',   // Light text
    muted: '#636E72',        // Dimmed text
    border: '#636E72',       // Borders

    // Diff colors
    diffAdded: '#00B894',    // Green for additions
    diffRemoved: '#D63031',  // Red for deletions
    diffContext: '#636E72',  // Gray for context
  }
}
```

### Syntax Highlighting (for code diffs)

```typescript
const syntaxTheme = {
  keyword: '#FF79C6',
  string: '#F1FA8C',
  number: '#BD93F9',
  comment: '#6272A4',
  function: '#50FA7B',
  variable: '#F8F8F2',
}
```

## Keyboard Shortcuts

### Global Shortcuts

```
Ctrl+C      - Quit Ralph TUI (with confirmation)
Ctrl+Q      - Quick quit (no confirmation, emergency only)
?           - Show help overlay
Tab         - Cycle focus between panels
Shift+Tab   - Reverse cycle focus
```

### Planning Phase

```
n           - Add new task
e           - Edit selected task
d           - Delete selected task
↑/k         - Move selection up
↓/j         - Move selection down
Ctrl+↑/K    - Move task up in priority
Ctrl+↓/J    - Move task down in priority
Enter       - Edit selected item
Ctrl+A      - Approve plan and start implementation
```

### Implementation Phase

```
Space       - Pause/resume execution
n           - Skip current task (requires confirmation)
r           - Retry current task
f           - Fork from current point
b           - Switch to different branch
```

### Review Phase (Diff View)

```
↑/k         - Scroll up
↓/j         - Scroll down
PageUp      - Scroll up one page
PageDown    - Scroll down one page
g           - Go to top
G           - Go to bottom
Tab         - Next file
Shift+Tab   - Previous file
c           - Add comment to selected line(s)
Enter       - View/edit selected comment
a           - Approve changes
i           - Iterate with feedback
f           - Fork from this commit
Ctrl+S      - Save and continue
```

### Branch Management

```
b           - Switch focus to branch view
Enter       - Switch to selected branch
m           - Merge selected branch into current
d           - Delete selected branch (requires confirmation)
```

## Interaction Patterns

### Task Selection Flow

```
1. User navigates to task list
2. User selects task with ↑/↓
3. User presses Enter to view details
4. Detail panel shows:
   - Task description
   - Acceptance criteria
   - Dependencies
   - Related commits
5. User can edit or execute task
```

### Review Flow

```
1. Task completes, diff appears
2. User scrolls through diff
3. User can:
   - Add comment: Select lines → Press 'c' → Type comment → Enter
   - Approve: Press 'a'
   - Iterate: Press 'i' → Type feedback → Enter
   - Fork: Press 'f' → Type direction → Enter
4. System acts on user choice
```

### Fork Flow

```
1. User presses 'f' at review screen
2. Prompt: "Describe the direction for this fork:"
3. User enters description
4. System creates branch/worktree
5. User sees confirmation and switch prompt
6. User can switch to new branch immediately
```

### Comment Flow

```
1. User selects line range with Shift+↑/↓
2. User presses 'c'
3. Prompt appears: "Enter comment:"
4. User types comment and presses Enter
5. Comment saved and displayed inline
6. Other comments can be added similarly
```

## Progress Indicators

### Spinner (for active AI work)

```
// When AI is thinking/executing
⠋ Executing task...
⠙ Executing task...
⠹ Executing task...
⠸ Executing task...
```

### Progress Bar

```
Overall Progress: ████████████░░░░░░░░ 60%

Task Breakdown:
✓✓✓✓✓✓░░░░░░
```

### Task Status Icons

```
✓  Completed
→  In Progress
○  Pending
⊗  Blocked
?  Needs Review
```

## Notification System

### Toast Notifications

```typescript
interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  duration?: number  // Auto-dismiss after ms
  actions?: NotificationAction[]
}

interface NotificationAction {
  label: string
  action: () => void
}

// Examples:
// - "Task completed successfully"
// - "Fork 'refactor-auth' created"
// - "Merge conflict detected"
// - "Test failure: 3 tests failing"
```

### Confirmation Dialogs

```typescript
interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  dangerous?: boolean  // Red styling for destructive actions
}

// Examples:
// - "Delete this task?"
// - "Merge fork into main?"
// - "Quit Ralph TUI?"
```

## Accessibility

### High Contrast Mode

Toggle with `Ctrl+H`:

```typescript
const highContrastTheme = {
  colors: {
    background: '#000000',
    foreground: '#FFFFFF',
    primary: '#FFFF00',
    success: '#00FF00',
    danger: '#FF0000',
    // ... all colors high contrast
  }
}
```

### Keyboard Navigation

All UI elements must be accessible via keyboard:
- Visible focus indicators
- Logical tab order
- No mouse-required interactions

### Screen Reader Support

- Use semantic labels
- Announce state changes
- Provide alternative text for visual elements

## Performance

### Rendering Optimizations

1. **Virtual Scrolling**: Only render visible lines in large diffs
2. **Debounced Input**: Debounce user input to prevent excessive re-renders
3. **Memoization**: Use React.memo for expensive components
4. **Lazy Loading**: Load diff content on-demand

### Async State Updates

```typescript
// Use ink's useStdoutDimensions for responsive layout
const { columns, rows } = useStdoutDimensions()

// Use useEffect for side effects
useEffect(() => {
  const interval = setInterval(() => {
    // Update progress, etc.
  }, 1000)

  return () => clearInterval(interval)
}, [])
```

## Error Display

### Error Overlay

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  ERROR                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Task execution failed: Max turns exceeded                  │
│                                                             │
│ The task "Implement authentication" required more          │
│ turns than the maximum allowed (100). This may indicate    │
│ the task is too complex and should be broken down.         │
│                                                             │
│ Options:                                                    │
│   [B] Break down task into smaller tasks                   │
│   [R] Retry with increased max turns                       │
│   [S] Skip this task for now                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Inline Error Messages

For non-critical errors, show inline with context:

```
task-003: User profile API [⊗ BLOCKED]
  └─ Error: Dependency 'task-002' not complete
```

## Help System

### Context-Sensitive Help

Press `?` to see help for current context:

```
Help: Review Phase (Diff View)

Navigation:
  ↑/k     - Move up
  ↓/j     - Move down
  PageUp  - Page up
  g/G     - Go to top/bottom

Actions:
  a       - Approve and continue
  i       - Iterate with feedback
  f       - Fork from this commit
  c       - Add comment

Press ? or Esc to close
```

### Tutorial Mode

First-time users see guided tour:

1. Welcome screen explains Ralph
2. Interactive tutorial of basic flows
3. Can be replayed with `Ctrl+?`

## Configuration

### User Preferences

```typescript
interface UserPreferences {
  theme: 'default' | 'high-contrast' | 'custom'
  keyBindings: 'default' | 'vim' | 'emacs'
  autoSave: boolean
  confirmDestructive: boolean
  maxParallelTasks: number
  defaultBranchStrategy: 'fork' | 'direct'
}
```

### Config File

Stored in `~/.ralph/config.json`:

```json
{
  "theme": "default",
  "keyBindings": "vim",
  "autoSave": true,
  "confirmDestructive": true,
  "maxParallelTasks": 3
}
```

## Responsive Design

### Small Terminal (< 80 columns)

- Hide sidebar
- Show tabs for different views
- Simplified status bar

### Medium Terminal (80-120 columns)

- Show collapsible sidebar
- Full-featured diff view
- Normal status bar

### Large Terminal (> 120 columns)

- Always-visible sidebar
- Side-by-side diff view
- Extended status bar with more info

## View Transitions

Smooth animations between views using ink's built-in transitions:

```typescript
// Fade transition
import { render } from 'ink'
const { rerender } = render(<OldView />)

// Later
rerender(<NewView />)  // Smooth transition
```

## Input Modes

### Normal Mode

- Arrow keys navigate
- Most commands available
- Standard keyboard shortcuts

### Vim Mode

- h/j/k/l for navigation
- : for command palette
- Vim-style motion keys

### Command Palette Mode

Press `:` to open command palette:

```
> _
  Recent commands:
    :task-execute
    :branch-create refactor-auth
    :diff-review
```

## Session State Display

Always show:
- Current session ID (truncated)
- Phase indicator
- Active task (if any)
- Total cost
- Time elapsed

Example:

```
[Planning] abc-123... | $2.34 | 45m elapsed
```
