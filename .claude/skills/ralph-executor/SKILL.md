---
name: ralph-executor
description: Execute Ralph Wiggum implementation plans via the Ralph Executor Server API. This skill communicates with a running Ralph server to execute tasks from an IMPLEMENTATION_PLAN.md. IMPORTANT: The server must already be running before using this skill.
allowed-tools: Bash, Read
user-invocable: true
---

# Ralph Executor

## CRITICAL: SERVER MUST BE RUNNING

This skill communicates with the Ralph Executor Server via HTTP API.

**IMPORTANT: The Ralph Executor Server MUST be running BEFORE using this skill.**
- This skill does NOT start the server
- The user must start the server themselves in a separate terminal

**To start the server (run this in a separate terminal):**
```bash
# Start server (default port 3001)
ralph server

# Or with custom options
ralph server --port 3001 --directory /path/to/project
```

## CRITICAL: DO NOT IMPLEMENT CODE YOURSELF

When this skill is invoked, you must **CALL THE SERVER API ENDPOINTS**, NOT implement tasks yourself. The server will handle spawning new Claude Code sessions for each task.

## How This Skill Works

1. **User starts server** in separate terminal: `ralph server`
2. **User invokes skill** with plan path: `/ralph-executor plans/web-ui/IMPLEMENTATION_PLAN.md`
3. **Skill connects to server** and posts `/execute` request
4. **Server auto-registers the plan** (if not already registered)
5. **Server spawns Claude sessions** to execute each task
6. **Skill polls for status** via `/status/:sessionId` endpoint
7. **Skill reports results** when execution completes

## IMPORTANT: Always Include the Plan Path

When invoking this skill, you **MUST** specify the path to the implementation plan:

**✅ CORRECT:**
- `/ralph-executor plans/web-ui/IMPLEMENTATION_PLAN.md`
- `/ralph-executor @plans/web-ui/IMPLEMENTATION_PLAN.md`

**❌ WRONG:**
- `/ralph-executor web-ui` (This will fail with "Plan not found in registry")
- `/ralph-executor` (No plan specified)

The server will **auto-register** the plan if it's not already in the registry, but only when you provide a file path that:
- Starts with `plans/` (e.g., `plans/web-ui/IMPLEMENTATION_PLAN.md`)
- Is an absolute path
- Contains a path separator (e.g., `web-ui/IMPLEMENTATION_PLAN.md`)
- Ends with `.md`

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
      "sessionId": "session-1738000000000",
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

## Your Responsibilities

1. **Check if server is running** via GET /health
2. **If server not running**, inform user they need to start it themselves:
   - "The Ralph Executor Server is not running. Please start it in a separate terminal with: `ralph server`"
   - DO NOT attempt to start the server yourself
3. **Read the plan file** to understand what will be executed
4. **Post API request** to `/execute` endpoint to start execution
5. **Monitor status** by polling `/status/:sessionId`
6. **Report results** to the user

## What NOT to Do

- ❌ DO NOT implement the tasks yourself
- ❌ DO NOT write code for the tasks in the plan
- ❌ DO NOT use Write/Edit tools to complete tasks
- ❌ DO NOT create files or make changes directly
- ❌ DO NOT try to start the server - this is the user's responsibility

## Example Workflow

```
User: /ralph-executor plans/web-ui/IMPLEMENTATION_PLAN.md

Assistant: I'll execute the implementation plan using the Ralph Executor server.

[Check server health...]
curl -s http://localhost:3001/health

[Read plan to understand it...]
Plan: Ralph Web UI
Total tasks: 12
Estimated duration: 5-7 days

[Trigger execution via API with full plan path]
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"plan": "plans/web-ui/IMPLEMENTATION_PLAN.md"}'

Response: {"sessionId": "session-1738000000000", ...}

[Monitor progress by polling status...]
while true; do
  curl -s http://localhost:3001/status/session-1738000000000 | jq .
  sleep 5
done

[Report final status to user when complete]
```

**Key Point:** Notice the full path `plans/web-ui/IMPLEMENTATION_PLAN.md` is used. Using just `web-ui` would fail with "Plan not found in registry" unless the plan was manually registered beforehand.

## Error Handling

### Server Not Running

If GET /health fails or returns connection refused:

```
The Ralph Executor Server is not running. Please start it in a separate terminal:

  ralph server --port 3001

After starting the server, invoke the ralph-executor skill again.
```

DO NOT attempt to start the server yourself.

### Execution Fails

If execution fails:
1. Check the error message
2. **If "Plan not found in registry"**: Make sure you specified the full path (e.g., `plans/web-ui/IMPLEMENTATION_PLAN.md`), not just a plan ID (e.g., `web-ui`)
3. Verify the plan file exists and is valid
4. Suggest the user checks server logs
5. Recommend retrying after fixing issues

**Common error - "Plan not found in registry":**
This error occurs when you pass a bare plan ID (like `web-ui`) that isn't registered. Always use the full file path:

```
❌ POST /execute {"plan": "web-ui"}           # Fails - not in registry
✅ POST /execute {"plan": "plans/web-ui/IMPLEMENTATION_PLAN.md"}  # Works - auto-registers
```

## Important Notes

- The Ralph server is typically started via: `ralph server` or `npm run server`
- Server runs on http://localhost:3001 by default
- Session state is stored in `.ralph/sessions/`
- Each task runs in an isolated Claude Code session (spawned by the server)
- This skill only communicates with the server via HTTP API

## What This Skill Does

- ✅ Connects to Ralph Executor Server via HTTP API
- ✅ Submits plans for execution via POST /execute
- ✅ Polls for execution status via GET /status/:sessionId
- ✅ Reports results to the user

## What This Skill Does NOT Do

- ❌ Start the server
- ❌ Run the server in the background
- ❌ Implement tasks from the plan
- ❌ Write code or make file changes
