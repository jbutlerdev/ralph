# Implementation Plan

## Overview
Add a task-complete tool to the Ralph executor that allows the running Claude Code instance to signal task completion, update plan status, and trigger progression to the next task. This improves the autonomous execution loop by allowing the AI to explicitly mark when it has completed a task, rather than relying on fixed timeout or completion detection heuristics.

## Tasks

### Task 1: Create MCP server infrastructure
**ID:** task-001
**Priority:** high
**Dependencies:** task-000

**Description:**
Create the MCP (Model Context Protocol) server infrastructure that will expose the task-complete tool to the running Claude Code instance. The server will use stdio transport and implement the MCP protocol to expose a single tool for marking tasks as complete. This server will be spawned by the executor before running Claude Code and will communicate over stdin/stdout.

**Acceptance Criteria:**
- [ ] `src/mcp/server.ts` exists with MCP server implementation
- [ ] Server exports `startRalphMCPServer()` function that returns a ChildProcess
- [ ] Server uses @modelcontextprotocol/sdk types
- [ ] Server implements stdio transport
- [ ] Server exposes `ralph_task_complete` tool with proper schema
- [ ] Server handles incoming tool calls and writes responses to stdout
- [ ] TypeScript types are exported for tool parameters

**Complexity:** 4
**Tags:** ["mcp", "server", "infrastructure"]

---

### Task 2: Implement task-complete tool logic
**ID:** task-002
**Priority:** high
**Dependencies:** task-001

**Description:**
Implement the core logic for the task-complete tool. When called, the tool should: (1) read the current session state, (2) mark the current task as completed, (3) optionally write completion metadata to a shared state file, and (4) signal completion back to the executor. The tool should accept optional parameters like completion notes, acceptance criteria status, and files changed.

**Acceptance Criteria:**
- [ ] `src/mcp/task-complete-tool.ts` exists with tool handler implementation
- [ ] Tool accepts: `taskId`, `notes`, `acceptanceCriteria`, `filesChanged` parameters
- [ ] Tool reads session state from `.ralph/sessions/{sessionId}.json`
- [ ] Tool updates session.completedTasks Set with current task ID
- [ ] Tool writes completion metadata to session file
- [ ] Tool returns success response with updated session state
- [ ] Tool handles error cases (invalid task ID, session not found)

**Complexity:** 4
**Tags:** ["mcp", "tool", "logic"]

---

### Task 3: Integrate MCP server with executor
**ID:** task-003
**Priority:** high
**Dependencies:** task-001, task-002

**Description:**
Modify the RalphExecutor class to spawn the MCP server before invoking Claude Code CLI. The server process should be passed to the Claude Code subprocess via environment variables or MCP configuration. The executor needs to track the server process and clean it up after task completion.

**Acceptance Criteria:**
- [ ] `src/executor.ts` modified to import and use MCP server
- [ ] `RalphExecutor` class has `mcpServerProcess?: ChildProcess` property
- [ ] `executeWithClaude()` starts MCP server before spawning Claude Code
- [ ] MCP server is passed to Claude Code via `RALPH_MCP_SERVER` env variable
- [ ] MCP server is terminated in finally block after Claude Code exits
- [ ] Error handling includes MCP server cleanup

**Complexity:** 3
**Tags:** ["executor", "integration", "mcp"]

---

### Task 4: Update prompt generation to include tool documentation
**ID:** task-004
**Priority:** high
**Dependencies:** task-001

**Description:**
Modify the `buildTaskPrompt()` method in the executor to include documentation about the task-complete tool. The prompt should instruct Claude Code to call the tool when it has completed the task, explaining what parameters to provide and what the tool does.

**Acceptance Criteria:**
- [ ] `buildTaskPrompt()` includes section on available tools
- [ ] Tool documentation includes name, description, and parameters
- [ ] Prompt instructs AI to call tool after completing implementation
- [ ] Prompt explains what happens after tool is called (task marked complete)
- [ ] Instructions include example tool call

**Complexity:** 2
**Tags:** ["prompt", "documentation", "executor"]

---

### Task 5: Add MCP configuration to Claude Code invocation
**ID:** task-005
**Priority:** high
**Dependencies:** task-001

**Description:**
Configure the Claude Code CLI invocation to recognize and connect to the Ralph MCP server. This involves setting up the proper environment variables or MCP configuration that Claude Code reads to discover available MCP servers.

**Acceptance Criteria:**
- [ ] Claude Code CLI receives MCP configuration via environment variable
- [ ] Configuration includes stdio command for Ralph MCP server
- [ ] Server is registered as "ralph-executor" in MCP config
- [ ] Tool is accessible to Claude Code as `ralph-executor:task_complete`
- [ ] Configuration uses absolute path to MCP server script

**Complexity:** 3
**Tags:** ["mcp", "config", "claude-code"]

---

### Task 6: Update plan file status on task completion
**ID:** task-006
**Priority:** medium
**Dependencies:** task-002

**Description:**
Implement logic to update the IMPLEMENTATION_PLAN.md file when a task is marked complete via the tool. The task's status field should be changed from "To Do" to "Implemented", and the file should be saved back to disk. This provides a persistent record of progress in the plan file itself.

**Acceptance Criteria:**
- [ ] Tool handler reads plan file from session.planPath
- [ ] Task status in plan is updated to "Implemented"
- [ ] Plan file is written back to disk with updated status
- [ ] File updates are atomic (write to temp, then rename)
- [ ] Errors during plan update are logged but don't fail tool call

**Complexity:** 3
**Tags:** ["plan", "persistence", "status"]

---

### Task 7: Add type definitions for MCP tools
**ID:** task-007
**Priority:** medium
**Dependencies:** task-001

**Description:**
Create TypeScript type definitions for the MCP tool parameters and responses. This ensures type safety across the MCP server implementation and provides intellisense for any consumers of these types.

**Acceptance Criteria:**
- [ ] `src/types/mcp.ts` exists with tool type definitions
- [ ] `TaskCompleteParams` interface defined with all parameters
- [ ] `TaskCompleteResult` interface defined for response
- [ ] Types export from `src/types/index.ts`
- [ ] JSDoc comments on all type definitions

**Complexity:** 2
**Tags:** ["typescript", "types", "mcp"]

---

### Task 8: Add MCP server package dependencies
**ID:** task-008
**Priority:** high
**Dependencies:** task-001

**Description:**
Add the required MCP SDK dependencies to package.json. The project needs @modelcontextprotocol/sdk for implementing the MCP server protocol.

**Acceptance Criteria:**
- [ ] package.json includes @modelcontextprotocol/sdk dependency
- [ ] Version pinned to latest stable (e.g., ^0.6.0)
- [ ] `npm install` run successfully
- [ ] Dependencies added to package-lock.json
- [ ] No peer dependency warnings

**Complexity:** 1
**Tags:** ["dependencies", "npm", "mcp"]

---

### Task 9: Create MCP server build script
**ID:** task-009
**Priority:** medium
**Dependencies:** task-001, task-008

**Description:**
Create a build script for compiling the MCP server TypeScript code to JavaScript. The server needs to be compiled before it can be executed by the Claude Code CLI.

**Acceptance Criteria:**
- [ ] tsconfig.json includes src/mcp in compilation
- [ ] Build script compiles MCP server to dist/mcp/
- [ ] npm script `build:mcp` added
- [ ] Compiled files can be executed with node
- [ ] Source maps are generated for debugging

**Complexity:** 2
**Tags:** ["build", "typescript", "mcp"]

---

### Task 10: Test MCP server with manual invocation
**ID:** task-010
**Priority:** medium
**Dependencies:** task-001, task-002, task-009

**Description:**
Create a test script that manually invokes the MCP server with a sample task-complete call. This verifies that the server starts correctly, receives tool calls, and returns appropriate responses.

**Acceptance Criteria:**
- [ ] `tools/test-mcp-server.ts` test script exists
- [ ] Script spawns MCP server process
- [ ] Script sends tool call via stdin
- [ ] Script receives and validates response via stdout
- [ ] Test covers success case (valid task completion)
- [ ] Test covers error case (invalid task ID)
- [ ] npm script `test:mcp` runs the test

**Complexity:** 3
**Tags:** ["testing", "mcp", "integration"]

---

### Task 11: Update .mcp.json configuration
**ID:** task-011
**Priority:** medium
**Dependencies:** task-009

**Description:**
Update the project's .mcp.json file to include the Ralph executor MCP server configuration. This allows the server to be discovered when running Claude Code in the project directory.

**Acceptance Criteria:**
- [ ] .mcp.json includes ralph-executor server entry
- [ ] Configuration uses stdio transport
- [ ] Command points to compiled server: node dist/mcp/server.js
- [ ] Environment variable RALPH_SESSION_ID is passed through
- [ ] Server works when running `claude` in project directory

**Complexity:** 2
**Tags:** ["config", "mcp", "claude-code"]

---

### Task 12: Update executor to pass session context to MCP server
**ID:** task-012
**Priority:** high
**Dependencies:** task-003

**Description:**
Modify the executor to pass session context (session ID, plan path, current task ID) to the MCP server via environment variables. The MCP server needs this context to properly update the correct session file.

**Acceptance Criteria:**
- [ ] RALPH_SESSION_ID environment variable set to current session ID
- [ ] RALPH_PLAN_PATH environment variable set to plan path
- [ ] RALPH_PROJECT_ROOT environment variable set to project root
- [ ] RALPH_CURRENT_TASK_ID environment variable set to current task ID
- [ ] Environment variables are available to MCP server process

**Complexity:** 2
**Tags:** ["executor", "env", "context"]

---

### Task 13: Add error handling and recovery
**ID:** task-013
**Priority:** medium
**Dependencies:** task-003

**Description:**
Add comprehensive error handling for MCP server failures. If the MCP server crashes or fails to start, the executor should log the error but continue with fallback behavior (timeout-based completion detection).

**Acceptance Criteria:**
- [ ] Executor catches MCP server spawn errors
- [ ] Error logged when MCP server fails to start
- [ ] Executor continues if MCP server unavailable
- [ ] Cleanup runs even if Claude Code subprocess fails
- [ ] Timeout-based completion remains as fallback

**Complexity:** 3
**Tags:** ["error-handling", "robustness", "mcp"]

---

### Task 14: Update documentation
**ID:** task-014
**Priority:** low
**Dependencies:** task-001, task-003

**Description:**
Update CLAUDE.md and README.md to document the new MCP server and task-complete tool. Include architecture diagrams, usage instructions, and troubleshooting tips.

**Acceptance Criteria:**
- [ ] CLAUDE.md includes MCP server section
- [ ] Architecture diagram showing executor/MCP/Claude Code flow
- [ ] Tool documentation in CLAUDE.md
- [ ] README.md mentions task-complete feature
- [ ] Troubleshooting section for common MCP issues

**Complexity:** 2
**Tags:** ["documentation", "mcp"]

---

### Task 15: Create example demonstrating tool usage
**ID:** task-015
**Priority:** low
**Dependencies:** task-003, task-004

**Description:**
Create a simple example plan and demo that shows the task-complete tool in action. This helps validate the implementation and provides a reference for users.

**Acceptance Criteria:**
- [ ] `examples/task-complete-demo/` directory exists
- [ ] Example IMPLEMENTATION_PLAN.md with 1-2 simple tasks
- [ ] Demo script runs executor on example plan
- [ ] Demo shows task completion in action
- [ ] README in examples/ explains the demo

**Complexity:** 2
**Tags:** ["example", "demo", "documentation"]

---
