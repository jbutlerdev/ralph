---
description: Install Ralph skills to user-level commands
argument-hint: [--force]
allowed-tools: [Bash, Read, Write, Edit]
---

# Install Ralph Skills

Installs the two Ralph project skills (ralph-plan-generator and ralph-executor) to the user-level Claude commands directory for global availability across all projects.

## Usage

```
/install-ralph
/install-ralph --force  # Overwrite existing skills
```

## How It Works

This command copies the following skills from the current project to `~/.claude/skills/`:

1. **ralph-plan-generator** - Generates structured implementation plans for Ralph Wiggum autonomous development loops
2. **ralph-executor** - Provides access to the Ralph Executor server API for plan execution

## Installation Process

When invoked, this command will:

1. Verify the project skills exist in `.claude/skills/ralph-plan-generator/` and `.claude/skills/ralph-executor/`
2. Create the user-level skills directory at `~/.claude/skills/` if it doesn't exist
3. Copy the skill directories recursively:
   - `.claude/skills/ralph-plan-generator/` → `~/.claude/skills/ralph-plan-generator/`
   - `.claude/skills/ralph-executor/` → `~/.claude/skills/ralph-executor/`
4. Report success with installation summary

## Options

- **--force**: Overwrite existing user-level skills without prompting

## Post-Installation

After installation, the skills will be available globally in any Claude Code session:

- Use the `ralph-plan-generator` skill to create implementation plans
- Use the `ralph-executor` skill to execute plans on the Ralph server

## Notes

- This command does not build the TypeScript skills; you must run `npm run build` in the project first
- The user-level skills are located at `~/.claude/skills/` (outside this project)
- To update skills, run this command again with `--force`
