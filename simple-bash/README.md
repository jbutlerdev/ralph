# Ralph Simple Bash Version

A lightweight CLI implementation of the Ralph Wiggum technique using pure bash. This provides a minimal alternative to the full TypeScript server for teams who want a simpler setup.

## When to Use the Simple Bash Version

Choose the simple bash version when:

- **Quick prototyping** - You want to try the Ralph Wiggum technique without setting up Node.js/TypeScript
- **Minimal dependencies** - You prefer to avoid the full server stack
- **Learning Ralph** - You're new to the methodology and want to understand the basics
- **Simple projects** - Your project doesn't need the web UI or advanced features

Choose the **full TypeScript server** when:

- **Web UI needed** - You want the dashboard for visual progress tracking
- **Multiple users** - Team members need to access execution via HTTP API
- **Advanced features** - You need real-time status, session management, checkpointing
- **Production use** - You need robust error handling and monitoring

## Quick Start

```bash
# Navigate to the simple-bash directory
cd simple-bash

# Make the script executable
chmod +x ralph-sh

# Initialize a new project
./ralph-sh init my-project

# Add tasks to your plan
./ralph-sh plan "Set up project structure"
./ralph-sh plan "Implement user authentication"
./ralph-sh plan "Add dashboard UI"

# Check status
./ralph-sh status

# Run the next task (this creates a prompt for Claude)
./ralph-sh run

# In your Claude Code session, read the prompt and execute
cat .ralph/prompts/task-001.txt

# After completing the work, mark as done
./ralph-sh done

# Commit your changes
./ralph-sh commit "[task-001] Set up project structure"

# Create exploration branch for trying something new
./ralph-sh branch feature-experiment
```

## Commands

| Command | Description |
|---------|-------------|
| `./ralph-sh init <name>` | Initialize a new Ralph project |
| `./ralph-sh plan <task>` | Add a task to the plan |
| `./ralph-sh run` | Start the next pending task |
| `./ralph-sh done` | Mark current task as complete |
| `./ralph-sh status` | Show progress and task status |
| `./ralph-sh branch <name>` | Create a new exploration branch |
| `./ralph-sh commit <msg>` | Commit current changes |
| `./ralph-sh log` | Show execution history |
| `./ralph-sh help` | Show help message |

## The Ralph Wiggum Technique

The core philosophy remains the same:

1. **Plan** - Write down what needs to be done
2. **Run** - Execute one task at a time with AI
3. **Review** - Check the diff and commit at boundaries
4. **Iterate** - Re-run with feedback or fork for exploration

### Why It Works

- **Repetition**: Running the same AI prompt repeatedly until tasks are complete
- **Git-backed branching**: Safe exploration with easy rollbacks
- **Structured review**: Commit boundaries provide natural review points
- **Autonomy**: The AI can work independently within task scope

## File Structure

```
simple-bash/
├── ralph-sh          # Main CLI script
├── SKILL.md          # Spec & Plan Generator skill (copied for reference)
└── README.md         # This file

# Created on init:
.ralph/
├── sessions/         # Session data (future use)
├── checkpoints/     # File checkpoints
├── prompts/         # Task prompts for Claude
└── execution.log   # Execution history

plans/
└── IMPLEMENTATION_PLAN.md   # Your task plan
```

## Integration with Claude Code

The simple bash version works by creating prompt files that Claude Code can read:

1. `./ralph-sh run` creates `.ralph/prompts/task-XXX.txt`
2. Open that file to see the task details and acceptance criteria
3. Complete the work following TDD principles
4. Run `./ralph-sh done` to mark the task complete
5. Review with `git diff` and commit

## Using with the Spec Plan Generator

The simple-bash directory includes the **Spec & Plan Generator** skill (`SKILL.md`) for reference. This skill generates comprehensive `spec.md` and `plan.md` documents before implementation begins.

To use:

1. Read `SKILL.md` to understand the skill format
2. Use Claude Code with the skill to generate your spec and plan
3. Convert the output to `IMPLEMENTATION_PLAN.md` format
4. Use `ralph-sh` to execute tasks one by one

## Differences from Full Version

| Feature | Simple Bash | Full Server |
|---------|-------------|-------------|
| Setup complexity | Just copy the script | npm install, build, run |
| Web dashboard | ❌ | ✅ |
| HTTP API | ❌ | ✅ |
| Session management | Basic (git-based) | Advanced (JSON + git) |
| Real-time status | ❌ | ✅ |
| Dependencies | bash + git | Node.js, Express, TypeScript |
| Platform | Unix/Linux/macOS | Cross-platform |

## Troubleshooting

**"No plan found"**
- Run `./ralph-sh init` first to create the plan file

**Git errors**
- Ensure you're in a git repository: `git init` if needed
- Check you have no uncommitted changes

**Task not marked complete**
- Make sure to run `./ralph-sh done` after finishing work

## License

MIT - Same as the main Ralph project.
