---
name: ralph-executor
description: Execute Ralph implementation plans via the Ralph Server API. This skill communicates with a running Ralph server to execute tasks from an IMPLEMENTATION_PLAN.md. IMPORTANT - The server must already be running before using this skill.
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

# Or with npm
npm run server
```

## CRITICAL: DO NOT IMPLEMENT CODE YOURSELF

When this skill is invoked, you must **CALL THE SERVER API ENDPOINTS**, NOT implement tasks yourself. The server will handle spawning new Claude Code sessions for each task.

## How This Skill Works

1. **User starts server** in separate terminal: `ralph server`
2. **User invokes skill** with plan path: `/ralph-executor plans/my-plan/IMPLEMENTATION_PLAN.md`
3. **Skill checks server health** via GET /health
4. **Skill reads the plan** to understand what will be executed
5. **Skill posts execute request** to start execution
6. **Server spawns Claude sessions** to execute each task
7. **Skill polls for status** until execution completes
8. **Skill reports results** to the user

## Invocation

When invoking this skill, you **MUST** specify the path to the implementation plan:

**Correct usage:**
- `/ralph-executor plans/web-ui/IMPLEMENTATION_PLAN.md`
- `/ralph-executor plans/api-server/IMPLEMENTATION_PLAN.md`

**Incorrect usage:**
- `/ralph-executor web-ui` (bare plan ID may not work unless pre-registered)
- `/ralph-executor` (no plan specified)

## Execution Workflow

Follow these steps exactly when this skill is invoked:

### Step 1: Check Server Health

```bash
curl -s http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-22T12:00:00.000Z",
  "activeSessions": 0,
  "projectRoot": "/path/to/project"
}
```

**If the server is not running** (connection refused or no response), inform the user:

> The Ralph Executor Server is not running. Please start it in a separate terminal:
>
> ```bash
> ralph server
> ```
>
> After starting the server, invoke the ralph-executor skill again.

**DO NOT attempt to start the server yourself.**

### Step 2: Read and Display Plan Summary

Read the plan file to understand what will be executed:

```bash
# Read the plan file
cat plans/web-ui/IMPLEMENTATION_PLAN.md
```

Display to the user:
- Project name
- Total number of tasks
- High-priority tasks
- Estimated scope

### Step 3: Execute the Plan

Make a POST request to start execution:

```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"plan": "plans/web-ui/IMPLEMENTATION_PLAN.md"}'
```

**Request body options:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `plan` | string | required | Path to IMPLEMENTATION_PLAN.md |
| `directory` | string | plan directory | Project root directory |
| `noCommit` | boolean | false | Disable automatic git commits |
| `autoTest` | boolean | false | Run tests after task completion |
| `requireAcceptanceCriteria` | boolean | false | Fail tasks if acceptance criteria not met |
| `dryRun` | boolean | false | Dry run only (no actual execution) |
| `maxRetries` | number | 3 | Maximum retry attempts per task |
| `maxParallel` | number | 1 | Maximum parallel task execution |

**Response:**

```json
{
  "sessionId": "session-1737550000000",
  "status": "started",
  "plan": {
    "title": "Web UI Implementation",
    "totalTasks": 8
  },
  "projectRoot": "/path/to/project",
  "message": "Execution started in background"
}
```

Save the `sessionId` for status polling.

### Step 4: Poll for Status

Poll the status endpoint until execution completes:

```bash
curl -s http://localhost:3001/status/session-1737550000000
```

**Status responses:**

Running:
```json
{
  "sessionId": "session-1737550000000",
  "status": "running",
  "message": "Execution in progress"
}
```

Completed:
```json
{
  "sessionId": "session-1737550000000",
  "status": "completed",
  "result": {
    "sessionId": "session-1737550000000",
    "completedTasks": ["task-001", "task-002", "task-003"],
    "failedTasks": [],
    "totalTasks": 3,
    "duration": 125000,
    "startTime": "2025-01-22T12:00:00.000Z",
    "endTime": "2025-01-22T12:02:05.000Z"
  }
}
```

Failed:
```json
{
  "sessionId": "session-1737550000000",
  "status": "failed",
  "error": "Task task-002 failed: Build errors in src/components/App.tsx"
}
```

**Polling strategy:**
- Poll every 10-15 seconds
- Continue until status is "completed" or "failed"
- Report progress to user periodically

### Step 5: Report Results

When execution completes, report to the user:

- Total tasks executed
- Completed tasks
- Failed tasks (if any)
- Total duration
- Next steps (if failures occurred)

## API Reference

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-22T12:00:00.000Z",
  "activeSessions": 1,
  "projectRoot": "/path/to/project"
}
```

### GET /plans

List all available/registered plans.

**Response:**
```json
{
  "plans": [
    {
      "id": "web-ui",
      "path": "/path/to/plans/web-ui/IMPLEMENTATION_PLAN.md",
      "projectRoot": "/path/to/project",
      "title": "Web UI Implementation",
      "totalTasks": 8,
      "completedTasks": 3,
      "inProgressTasks": 1,
      "pendingTasks": 4,
      "failedTasks": 0,
      "progress": 37
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
    "projectName": "Web UI Implementation",
    "description": "Build the web dashboard",
    "totalTasks": 8,
    "tasks": [
      {
        "id": "task-001",
        "title": "Setup project structure",
        "priority": "high",
        "dependencies": ["task-000"],
        "runtimeStatus": "completed"
      }
    ],
    "runtimeStatus": {
      "totalTasks": 8,
      "completedTasks": 3,
      "inProgressTasks": 1,
      "pendingTasks": 4,
      "failedTasks": 0,
      "progress": 37
    }
  }
}
```

### POST /execute

Start execution of an implementation plan.

**Request:**
```json
{
  "plan": "plans/web-ui/IMPLEMENTATION_PLAN.md",
  "requireAcceptanceCriteria": true
}
```

**Response:**
```json
{
  "sessionId": "session-1737550000000",
  "status": "started",
  "plan": {
    "title": "Web UI Implementation",
    "totalTasks": 8
  },
  "message": "Execution started in background"
}
```

### GET /status/:sessionId

Get execution status for a session.

**Response (running):**
```json
{
  "sessionId": "session-1737550000000",
  "status": "running",
  "message": "Execution in progress"
}
```

**Response (completed):**
```json
{
  "sessionId": "session-1737550000000",
  "status": "completed",
  "result": {
    "completedTasks": ["task-001", "task-002"],
    "failedTasks": [],
    "totalTasks": 2,
    "duration": 60000,
    "startTime": "2025-01-22T12:00:00.000Z",
    "endTime": "2025-01-22T12:01:00.000Z"
  }
}
```

### GET /sessions

List all active execution sessions.

**Response:**
```json
{
  "sessions": [
    {"sessionId": "session-1737550000000", "status": "running"},
    {"sessionId": "session-1737540000000", "status": "completed"}
  ]
}
```

### DELETE /sessions/:sessionId

Delete a completed session from memory.

**Response:**
```json
{
  "sessionId": "session-1737550000000",
  "status": "deleted",
  "message": "Session removed"
}
```

### POST /plans/:planId/restart

Restart execution of a registered plan.

**Request:**
```json
{
  "requireAcceptanceCriteria": true
}
```

**Response:** Same as POST /execute

## Error Handling

### Server Not Running

If GET /health fails or returns connection refused:

> The Ralph Executor Server is not running. Please start it in a separate terminal:
>
> ```bash
> ralph server
> ```
>
> After starting the server, invoke the ralph-executor skill again.

**DO NOT attempt to start the server yourself.**

### Plan Not Found

If the plan file doesn't exist:

> Plan file not found: plans/web-ui/IMPLEMENTATION_PLAN.md
>
> Please verify the plan path and try again. Use the ralph-plan-generator skill to create a new plan if needed.

### Execution Failure

If execution fails, report:
- The error message
- Which task failed
- Suggest checking server logs: `Check the terminal running 'ralph server' for detailed logs`
- Recommend fixing the issue and retrying

## What This Skill Does

- ✅ Checks if Ralph server is running
- ✅ Reads and summarizes the plan
- ✅ Submits plans for execution via POST /execute
- ✅ Polls for execution status via GET /status/:sessionId
- ✅ Reports results to the user

## What This Skill Does NOT Do

- ❌ Start the server
- ❌ Implement tasks from the plan
- ❌ Write code or make file changes
- ❌ Run the server in the background

## Example Session

```
User: /ralph-executor plans/web-ui/IMPLEMENTATION_PLAN.md