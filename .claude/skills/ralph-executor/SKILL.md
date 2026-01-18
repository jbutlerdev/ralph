---
name: ralph-executor
description: Execute Ralph Wiggum implementation plans by running the ralph-executor CLI tool or server API. This tool autonomously executes tasks from an IMPLEMENTATION_PLAN.md by spawning new Claude Code sessions for each task. Use when: running an implementation plan, resuming a paused session, or executing tasks from IMPLEMENTATION_PLAN.md.
allowed-tools: Bash, Read
user-invocable: true
---

# Ralph Executor

## CRITICAL: DO NOT IMPLEMENT CODE YOURSELF

When this skill is invoked, you must **EXECUTE the ralph-executor CLI tool or Server API**, NOT implement the tasks yourself. The CLI tool will handle spawning new Claude Code sessions for each task.

## Two Ways to Execute

### 1. CLI Mode (Direct Execution)

Use the Bash tool to run the `ralph-executor` command:

```bash
# Basic usage - run plan in current directory
ralph-executor run

# Run specific plan
ralph-executor run plans/web-ui/IMPLEMENTATION_PLAN.md

# With options
ralph-executor run --no-commit --auto-test --verbose
```

### 2. Server Mode (HTTP API)

**Start the server:**

```bash
# Start server (default port 3001)
ralph-executor server

# Start server with custom port and directory
ralph-executor server --port 4000 --directory /path/to/project

# Start server with auto-commit and auto-test
ralph-executor server --auto-commit --auto-test
```

**Post API requests to the server:**

```bash
# Start execution
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"plan": "plans/web-ui/IMPLEMENTATION_PLAN.md"}'

# Check execution status
curl http://localhost:3001/status/session-1738000000000

# List active sessions
curl http://localhost:3001/sessions
```

## Server API Endpoints

### POST /execute
Start execution of an implementation plan.

**Request Body:**
```json
{
  "plan": "plans/web-ui/IMPLEMENTATION_PLAN.md",  // Optional: path to plan
  "directory": "/path/to/project",                 // Optional: project root
  "noCommit": false,                               // Optional: disable auto-commit
  "autoTest": true,                                // Optional: run tests after tasks
  "dryRun": false,                                 // Optional: dry run only
  "maxRetries": 3,                                 // Optional: max retry attempts
  "maxParallel": 1                                 // Optional: max parallel tasks
}
```

**Response:**
```json
{
  "sessionId": "session-1738000000000",
  "status": "started",
  "plan": {
    "title": "Ralph Web UI",
    "totalTasks": 12
  },
  "message": "Execution started in background"
}
```

### GET /status/:sessionId
Get the status of an execution session.

**Response (running):**
```json
{
  "sessionId": "session-1738000000000",
  "status": "running",
  "message": "Execution in progress"
}
```

**Response (completed):**
```json
{
  "sessionId": "session-1738000000000",
  "status": "completed",
  "result": {
    "sessionId": "session-1738000000000",
    "completedTasks": ["task-001", "task-002"],
    "failedTasks": [],
    "totalTasks": 12,
    "duration": 1234567,
    "startTime": "2025-01-18T12:00:00.000Z",
    "endTime": "2025-01-18T13:30:00.000Z"
  }
}
```

**Response (failed):**
```json
{
  "sessionId": "session-1738000000000",
  "status": "failed",
  "error": "Error message here"
}
```

### GET /plans
List all available implementation plans.

**Response:**
```json
{
  "plans": [
    {
      "id": "web-ui",
      "path": "/path/to/plans/web-ui/IMPLEMENTATION_PLAN.md",
      "title": "Ralph Web UI",
      "totalTasks": 12
    }
  ]
}
```

### GET /plans/:planId
Get details of a specific plan.

**Response:**
```json
{
  "plan": {
    "metadata": {
      "title": "Ralph Web UI",
      "description": "...",
      "totalTasks": 12,
      "estimatedDuration": "5-7 days"
    },
    "tasks": [...]
  }
}
```

### GET /sessions
List all active execution sessions.

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "session-1738000000000",
      "status": "running"
    },
    {
      "sessionId": "session-1737000000000",
      "status": "completed"
    }
  ]
}
```

### DELETE /sessions/:sessionId
Delete a completed session from memory.

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-18T12:00:00.000Z",
  "activeSessions": 1,
  "projectRoot": "/path/to/project"
}
```

## When to Use CLI vs Server

**Use CLI Mode when:**
- Running execution directly from terminal
- Quick one-off execution
- Testing and debugging
- User explicitly invokes `/ralph-executor` command

**Use Server Mode when:**
- Invoking from within Claude Code (to avoid nested sessions)
- Need to monitor execution progress via HTTP
- Multiple execution sessions needed
- Integrating with other tools/services

## Server CLI Options

```
-p, --port <number>       Server port (default: 3001)
-h, --host <string>       Server host (default: 0.0.0.0)
-d, --directory <path>    Project root directory (default: current directory)
--auto-commit             Enable automatic git commits
--auto-test               Run tests after task completion
```

## When to Use

- User explicitly invokes `/ralph-executor` command
- User provides an IMPLEMENTATION_PLAN.md file
- User wants to run autonomous execution of tasks
- User wants to resume a paused execution session

## Your Responsibilities

1. **Read the plan file** to understand what will be executed
2. **Start the server** (if not already running) using `ralph-executor server`
3. **Post API request** to `/execute` endpoint to start execution
4. **Monitor status** by polling `/status/:sessionId`
5. **Report results** to the user

## What NOT to Do

- ❌ DO NOT implement the tasks yourself
- ❌ DO NOT write code for the tasks in the plan
- ❌ DO NOT use Write/Edit tools to complete tasks
- ❌ DO NOT create files or make changes directly

## Example Workflow (Server Mode)

```bash
# User invokes: /ralph-executor @plans/web-ui/IMPLEMENTATION_PLAN.md

# Step 1: Read the plan to understand it
cat plans/web-ui/IMPLEMENTATION_PLAN.md

# Step 2: Start the server (if not already running)
# In a separate terminal or background:
ralph-executor server --directory /data/jbutler/git/jbutlerdev/ralph

# Step 3: Trigger execution via API
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"plan": "plans/web-ui/IMPLEMENTATION_PLAN.md"}'

# Response: {"sessionId": "session-1738000000000", ...}

# Step 4: Poll for status
while true; do
  curl -s http://localhost:3001/status/session-1738000000000 | jq .
  sleep 5
done

# Step 5: Report final status to user when complete
```

## CLI Options (for run command)

```
-p, --plan <path>         Path to implementation plan (default: ./IMPLEMENTATION_PLAN.md)
-d, --directory <path>    Project root directory (default: current directory)
-r, --resume              Resume from previous session
--no-commit               Disable automatic git commits
--auto-test               Run tests after each task completion
--test-command <cmd>      Test command to run (default: npm run test:run)
--dry-run                 Dry run - show what would be executed without actually running
-v, --verbose             Verbose output
--max-retries <n>         Maximum retry attempts for failed tasks (default: 3)
--max-parallel <n>        Maximum parallel tasks (default: 1)
--model <name>            Claude model to use (default: claude-sonnet-4-5)
```

## Status Commands

```bash
# List all available plans
ralph-executor list

# Show execution status
ralph-executor status

# Show status for specific plan
ralph-executor status plans/web-ui/IMPLEMENTATION_PLAN.md
```

## Understanding the Output

The CLI/Server will output:
- Plan validation results
- Task execution progress
- Completion status for each task
- Acceptance criteria verification
- Git commit information (if auto-commit enabled)
- Final execution summary

## Error Handling

If execution fails:
1. Check the error message
2. Verify the plan file exists and is valid
3. Check if dependencies are installed
4. Suggest running with `--verbose` for more details
5. Suggest running with `--dry-run` to preview execution

## Example Session

```
User: /ralph-executor @plans/web-ui/IMPLEMENTATION_PLAN.md

Assistant: I'll execute the implementation plan using the Ralph Executor server.

[Reading plan...]
Plan: Ralph Web UI
Total tasks: 12
Estimated duration: 5-7 days

[Starting server and posting execution request...]
Server running at http://localhost:3001
POST /execute -> {"sessionId": "session-1738000000000", ...}

[Monitoring progress...]
=== Executing task-001: Initialize Web UI project with Next.js ===
Priority: high
Complexity: 2

[The server spawns new Claude sessions for each task...]
```

## Important Notes

- The `ralph-executor` command is located at: `.claude/skills/ralph-executor/dist/cli.js`
- Make sure the skill has been built (`npm run build` in the skill directory)
- The CLI requires Node.js and the `claude` command to be available
- Session state is stored in `.ralph/sessions/`
- Each task runs in an isolated Claude Code session
- Server mode is recommended when invoking from within Claude Code to avoid nested sessions
