# Ralph Simple Bash Version

A lightweight CLI implementation of the Ralph Wiggum technique using pure bash. This provides a minimal alternative to the full TypeScript server for teams who want a simpler setup.

## Installation

The simple bash version requires two things:

### 1. Ralph-sh Script

The `ralph-sh` script is installed globally at `/usr/local/bin/ralph-sh`. If you don't have it:

```bash
curl -o /usr/local/bin/ralph-sh https://raw.githubusercontent.com/jbutlerdev/ralph/main/simple-bash/ralph-sh
chmod +x /usr/local/bin/ralph-sh
```

Or copy from this directory after cloning the repo.

### 2. Spec Plan Generator Skill (Optional)

To use the Spec & Plan Generator skill with Claude Code/pi, copy it to your skills directory:

```bash
# Create the skills directory if it doesn't exist
mkdir -p ~/.pi/agent/skills

# Copy the skill folder
cp -r simple-bash/spec-plan-generator ~/.pi/agent/skills/
```

The skill will then be available in Claude Code as `spec-plan-generator`.

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
# Ensure you have spec.md and plan.md files in your project
# (use the spec-plan-generator skill to create these)

# Run Ralph - it will execute tasks in a loop until complete
ralph-sh plan.md spec.md

# Or limit the number of loops
ralph-sh plan.md spec.md 5  # max 5 iterations
```

## How It Works

The script:

1. Reads your `plan.md` (tasks with checkboxes) and `spec.md` (requirements)
2. Runs `pi` (Claude Code) with a task prompt
3. After each task completes, checks off the checkbox in plan.md
4. Loops until all tasks are done
5. Generates a SUMMARY.md with an overview of what was built

### Task Prompt

The script sends this prompt to pi for each task:

> Read the spec in spec.md and the plan in plan.md. Complete the next unchecked task and ONLY the next unchecked task in the plan. After completing the task, check off its checkbox in the plan file to track progress. Do not move on to other tasks. After completing the task, append a brief entry to progress.md noting any decisions made, trade-offs, issues encountered, or other important context.

### Summary Prompt

After all tasks complete:

> Read the spec, the plan, and progress.md. Write a SUMMARY.md file that includes: overview, files changed, decisions/trade-offs, and final outcome.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NOTIFY_URL` | http://mule.botnet:8081/message | Webhook for notifications |
| `PROJECT_NAME` | basename of current dir | Project identifier |
| `TASK_TIMEOUT` | 2400 | Timeout per task in seconds |
| `PI_PROVIDER` | minimax | AI provider to use |
| `PI_MODEL` | minimax-m2.5-highspeed | AI model to use |

## The Ralph Wiggum Technique

The core philosophy remains the same:

1. **Plan** - Write down what needs to be done in plan.md
2. **Spec** - Define requirements in spec.md
3. **Run** - Execute tasks one at a time with AI
4. **Review** - Check progress.md for context
5. **Iterate** - Re-run with feedback or fork for exploration

### Why It Works

- **Repetition**: Running the same AI prompt repeatedly until tasks are complete
- **Git-backed branching**: Safe exploration with easy rollbacks
- **Structured review**: Commit boundaries provide natural review points
- **Autonomy**: The AI can work independently within task scope

## File Structure

```
simple-bash/
├── ralph-sh              # Reference to /usr/local/bin/ralph-sh
├── spec-plan-generator/  # Spec & Plan Generator skill
│   └── SKILL.md
└── README.md             # This file
```

## Integration with Claude Code

### Using the Spec Plan Generator

1. Copy the skill to your pi skills directory:
   ```bash
   cp -r simple-bash/spec-plan-generator ~/.pi/agent/skills/
   ```

2. In Claude Code, invoke the skill:
   ```
   Use the spec-plan-generator skill to create a spec and plan for my project.
   ```

3. The skill will generate:
   - `spec.md` - Comprehensive product specification
   - `plan.md` - Phased development plan with checkboxes

4. Run Ralph to execute:
   ```bash
   ralph-sh plan.md spec.md
   ```

## Differences from Full Version

| Feature | Simple Bash | Full Server |
|---------|-------------|-------------|
| Setup complexity | Just the script | npm install, build, run |
| Web dashboard | ❌ | ✅ |
| HTTP API | ❌ | ✅ |
| Session management | Basic (progress.md) | Advanced (JSON + git) |
| Real-time status | ❌ | ✅ |
| Dependencies | bash + pi | Node.js, Express, TypeScript |
| Platform | Unix/Linux/macOS | Cross-platform |

## Troubleshooting

**"plan file not found"**
- Ensure you're in a directory with plan.md and spec.md

**"ralph-sh not found"**
- Make sure /usr/local/bin is in your PATH, or copy the script locally

**Tasks not being checked off**
- The script expects `- [ ]` format for unchecked items in plan.md

**Lock file errors**
- Remove stale lock: `rm /tmp/ralph-sh-*.lock`

## License

MIT - Same as the main Ralph project.
