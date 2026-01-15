# Ralph TUI Orchestrator

A Terminal User Interface (TUI) for orchestrating the Ralph Wiggum technique—an autonomous AI-driven development methodology powered by Claude.

## What is Ralph?

Ralph Wiggum is a development methodology that transforms AI from a pair programmer into a relentless worker. The core philosophy: **keep running the same prompt over and over until the task is complete.**

This TUI provides the tooling to harness that power with structure, visibility, and control.

## Features

- **Planning Mode**: Collaborate with AI to create specs and implementation plans
- **Implementation Mode**: Execute tasks autonomously with commit-at-boundary reviews
- **Branching & Exploration**: Fork from any commit to explore alternative implementations
- **Diff Reviews**: Line-by-line review with inline comments
- **Git-Native**: All state managed via git worktrees for true parallelism

## Quick Start

```bash
# Install
npm install -g @ralph/tui

# Start a new project
ralph init my-project
cd my-project

# Open existing project
ralph open
```

## How It Works

### 1. Planning Phase

```
You describe what you want to build
  ↓
AI asks clarifying questions
  ↓
AI generates specs/[topic].md files
  ↓
You review and refine specs
  ↓
AI generates IMPLEMENTATION_PLAN.md
  ↓
You review, reorder, and approve the plan
```

### 2. Implementation Phase

```
AI selects next task from plan
  ↓
Creates checkpoint, executes task
  ↓
Creates commit at completion
  ↓
You review the diff
  ↓
Choose: Approve | Iterate | Fork
  ↓
Repeat until all tasks complete
```

### 3. Forking

At any review point, you can:
- **Approve**: Accept changes and continue
- **Iterate**: Provide feedback, AI continues in same branch
- **Fork**: Create new branch to explore alternative approach

Forks are full git branches with their own worktrees and AI sessions.

## Project Structure

```
my-project/
├── specs/                    # Requirement specifications
│   ├── database.md
│   ├── authentication.md
│   └── api.md
├── IMPLEMENTATION_PLAN.md    # AI-generated task list
└── .ralph/                   # Runtime state (gitignored)
    ├── sessions/             # Session metadata
    ├── checkpoints/          # File checkpoints
    └── comments/             # Diff comments
```

## Keyboard Shortcuts

### Global
- `Ctrl+C` - Quit (with confirmation)
- `?` - Show help
- `Tab` - Cycle focus

### Planning
- `n` - New task
- `e` - Edit task
- `Ctrl+A` - Approve plan

### Implementation
- `Space` - Pause/resume
- `f` - Fork current work

### Review
- `j/k` - Navigate diff
- `a` - Approve
- `i` - Iterate with feedback
- `f` - Fork from this commit
- `c` - Add comment

## Configuration

Create `~/.ralph/config.json`:

```json
{
  "theme": "default",
  "keyBindings": "vim",
  "autoSave": true,
  "maxParallelTasks": 3
}
```

## Architecture

Built with:
- **ink** - React for CLIs
- **zustand** - State management
- **@anthropic-ai/claude-agent-sdk** - Claude integration
- **simple-git** - Git worktree management

See [specs/](specs/) for detailed architecture documentation.

## Development

```bash
git clone <repo>
cd ralph
npm install
npm run dev
```

## Documentation

- [Overview](specs/overview.md)
- [Architecture](specs/architecture.md)
- [Planning Spec](specs/planning-spec.md)
- [Implementation Spec](specs/implementation-spec.md)
- [UI Spec](specs/ui-spec.md)
- [Task List](specs/tasks.md)

## Philosophy

> "Move from one-shot perfection to iteration over perfection."

Ralph embraces that AI will make mistakes. The technique provides:
- Continuous course correction through iteration
- Clear boundaries for review and intervention
- Git-backed safety net for exploration
- Eventual consistency through persistent refinement

## License

MIT
