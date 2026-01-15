# Ralph TUI Orchestrator - Project Overview

## Vision

A Terminal User Interface (TUI) application that orchestrates the Ralph Wiggum technique - an autonomous AI-driven development methodology. The TUI provides structure, visibility, and control over AI-powered software development loops.

## Problem Statement

The Ralph Wiggum technique is powerful but lacks tooling for:
- Structured plan and spec development
- Managing multiple exploration branches
- Reviewing and iterating on AI-generated code
- Visualizing progress and context

## Solution

A TypeScript TUI that:
1. **Orchestrates Planning Phase**: Guide users and AI through requirements gathering and spec creation
2. **Manages Implementation**: Execute tasks with git-backed branching for exploration
3. **Facilitates Review**: Present diffs, collect feedback, and iterate
4. **Provides Visibility**: Show progress, context, and branch state at all times

## Core User Journey

```
1. User starts Ralph TUI
   ↓
2. Planning Mode: Collaborate with AI to create specs/IMPLEMENTATION_PLAN.md
   ↓
3. Review Plan: User reviews and adjusts the plan
   ↓
4. Implementation Mode: AI executes tasks one-by-one
   ↓
5. At each task completion:
   - AI creates commit
   - TUI shows diff for review
   - User options: Approve | Iterate | Fork Branch
   ↓
6. Loop until all tasks complete
```

## Key Differentiators

1. **Git-Native**: Uses git worktrees for true parallel exploration
2. **Review-First**: Designed around thoughtful review, not blind acceptance
3. **Branching as Exploration**: Forks are first-class citizens, not afterthoughts
4. **Context-Rich**: Always shows plan state, progress, and current focus

## Success Criteria

- User can create a project spec with AI assistance in < 30 minutes
- User can review and approve/reject/iterate on task commits
- User can fork branches to explore alternative implementations
- All branches are managed via git worktrees with proper isolation
- TUI remains responsive during long-running AI operations
