# Claude Agent SDK (TypeScript) - Complete Guide

## Overview

The Claude Agent SDK (formerly Claude Code SDK) is Anthropic's official TypeScript library for building autonomous AI agents with Claude Code's capabilities. It enables developers to create agents that can understand codebases, edit files, run commands, and execute complex workflows programmatically.

**Package**: `@anthropic-ai/claude-agent-sdk`

**Latest Version**: v0.2.7 (as of Jan 2026)

**Requirements**: Node.js 18+

## Core Philosophy

The SDK operates on the principle of "giving Claude a computer"—providing agents with access to terminal commands, file operations, and code execution to work like humans do.

### The Agent Loop

Agents follow a continuous feedback cycle:
1. **Gather context** - Fetch and update information
2. **Take action** - Execute operations using available tools
3. **Verify work** - Evaluate and correct output
4. **Repeat** - Iterate until success

## Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

## Quick Start

### One-Shot Query

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'

const result = await query({
  prompt: 'What is 2 + 2?',
  options: { model: 'claude-sonnet-4-5-20250929' }
})

for await (const message of result) {
  if (message.type === 'result') {
    console.log(message.result)
  }
}
```

### Multi-Turn Session (V1 Interface)

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'

const response = query({
  prompt: 'Help me build a web application',
  options: { model: 'claude-sonnet-4-5-20250929' }
})

for await (const message of response) {
  console.log(message)
}
```

### Multi-Turn Session (V2 Interface - Preview)

The V2 interface removes the need for async generators with explicit `send()`/`stream()` patterns:

```typescript
import { unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk'

await using session = unstable_v2_createSession({
  model: 'claude-sonnet-4-5-20250929'
})

await session.send('Hello!')
for await (const msg of session.stream()) {
  if (msg.type === 'assistant') {
    const text = msg.message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
    console.log(text)
  }
}
```

<Note>
The V2 interface is an **unstable preview**. APIs may change before becoming stable. Some features like session forking are only available in V1.
</Note>

## Core Functions

### `query()`

The primary function for interacting with Claude Code. Creates an async generator that streams messages as they arrive.

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query
```

**Parameters:**
- `prompt`: The input prompt as a string or async iterable for streaming mode
- `options`: Optional configuration object (see Options below)

**Returns**: A `Query` object that extends `AsyncGenerator<SDKMessage>` with additional methods

### `tool()`

Creates a type-safe MCP tool definition for use with SDK MCP servers.

```typescript
function tool<Schema extends ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: z.infer<ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>
): SdkMcpToolDefinition<Schema>
```

### `createSdkMcpServer()`

Creates an MCP server instance that runs in the same process as your application.

```typescript
function createSdkMcpServer(options: {
  name: string;
  version?: string;
  tools?: Array<SdkMcpToolDefinition<any>>;
}): McpSdkServerConfigWithInstance
```

## Configuration Options

### Options Object

```typescript
interface Options {
  // Core Configuration
  abortController?: AbortController;
  model?: string;
  cwd?: string;
  env?: Dict<string>;
  executable?: 'bun' | 'deno' | 'node';
  executableArgs?: string[];
  pathToClaudeCodeExecutable?: string;

  // Tool & Permissions
  allowedTools?: string[];
  disallowedTools?: string[];
  canUseTool?: CanUseTool;
  permissionMode?: PermissionMode;
  allowDangerouslySkipPermissions?: boolean;
  permissionPromptToolName?: string;

  // Session Management
  continue?: boolean;
  resume?: string;
  forkSession?: boolean;
  maxTurns?: number;

  // Agent Configuration
  agents?: Record<string, AgentDefinition>;
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string };
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };

  // MCP Servers
  mcpServers?: Record<string, McpServerConfig>;
  strictMcpConfig?: boolean;

  // Features
  betas?: SdkBeta[];
  extraArgs?: Record<string, string | null>;
  enableFileCheckpointing?: boolean;
  includePartialMessages?: boolean;
  maxBudgetUsd?: number;
  maxThinkingTokens?: number;
  outputFormat?: { type: 'json_schema'; schema: JSONSchema };

  // Settings & Plugins
  settingSources?: SettingSource[];
  plugins?: SdkPluginConfig[];
  sandbox?: SandboxSettings;
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  stderr?: (data: string) => void;
}
```

### Permission Modes

```typescript
type PermissionMode =
  | 'default'           // Standard permission behavior
  | 'acceptEdits'       // Auto-accept file edits
  | 'bypassPermissions' // Bypass all permission checks
  | 'plan'              // Planning mode - no execution
```

### Setting Sources

Controls which filesystem-based configuration sources the SDK loads:

```typescript
type SettingSource = 'user' | 'project' | 'local';

// user: ~/.claude/settings.json
// project: .claude/settings.json
// local: .claude/settings.local.json
```

<Note>
When `settingSources` is omitted, the SDK does not load any filesystem settings by default.
</Note>

## Session Management

### Getting Session ID

```typescript
let sessionId: string | undefined

const response = query({
  prompt: "Help me build a web application",
  options: { model: "claude-sonnet-4-5" }
})

for await (const message of response) {
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id
    console.log(`Session started with ID: ${sessionId}`)
  }
}
```

### Resuming Sessions

```typescript
const resumedResponse = query({
  prompt: "Continue where we left off",
  options: {
    resume: sessionId,  // Session ID from previous conversation
    model: "claude-sonnet-4-5"
  }
})
```

### Forking Sessions

Create a new session branch from a resume point:

```typescript
const forkedResponse = query({
  prompt: "Now let's redesign this as a GraphQL API instead",
  options: {
    resume: sessionId,
    forkSession: true,  // Creates new session ID
    model: "claude-sonnet-4-5"
  }
})
```

**When to fork:**
- Explore different approaches from same starting point
- Test changes without affecting original session
- Maintain separate conversation paths for experiments

## Built-in Tools

The SDK provides comprehensive tools for file operations, code analysis, and system interactions:

### File Operations

- **Read** - Read files (text, images, PDFs, Jupyter notebooks)
- **Write** - Write files (overwrites if exists)
- **Edit** - Exact string replacements in files
- **Glob** - Fast file pattern matching

### Code Analysis

- **Grep** - Powerful search tool built on ripgrep
- **Task** - Launch specialized subagents for complex tasks
- **TodoWrite** - Create and manage task lists

### Execution

- **Bash** - Execute bash commands with timeout support
- **KillBash** - Kill running background shells
- **BashOutput** - Retrieve output from background shells

### Web & External

- **WebFetch** - Fetch and process web content
- **WebSearch** - Search the web
- **ListMcpResources** - List MCP server resources
- **ReadMcpResource** - Read MCP server resources

### Jupyter Notebooks

- **NotebookEdit** - Edit cells in Jupyter notebooks

### User Interaction

- **AskUserQuestion** - Ask clarifying questions during execution
- **ExitPlanMode** - Exit planning mode for plan approval

## Hooks - Intercept and Control Agent Behavior

Hooks let you intercept agent execution at key points to add validation, logging, security controls, or custom logic.

### Available Hook Events

| Event | Description | Use Cases |
|-------|-------------|------------|
| `PreToolUse` | Before tool executes | Block dangerous operations, validate inputs |
| `PostToolUse` | After tool executes | Log actions, audit trails |
| `PostToolUseFailure` | When tool fails | Handle errors, retry logic |
| `UserPromptSubmit` | When user submits prompt | Inject context, modify prompts |
| `SessionStart` | When session initializes | Initialize logging, telemetry |
| `SessionEnd` | When session terminates | Cleanup resources, save state |
| `Stop` | When agent execution stops | Save session state |
| `SubagentStart` | When subagent spawns | Track parallel tasks |
| `SubagentStop` | When subagent completes | Aggregate results |
| `PreCompact` | Before conversation compaction | Archive transcript |
| `PermissionRequest` | When permission dialog displays | Custom permission handling |
| `Notification` | When agent sends status message | Send updates to external services |

### Hook Configuration

```typescript
import { query, HookCallback } from "@anthropic-ai/claude-agent-sdk";

const protectEnvFiles: HookCallback = async (input, toolUseID, { signal }) => {
  const filePath = input.tool_input?.file_path as string;
  const fileName = filePath?.split('/').pop();

  if (fileName === '.env') {
    return {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: 'deny',
        permissionDecisionReason: 'Cannot modify .env files'
      }
    };
  }

  return {};
};

for await (const message of query({
  prompt: "Update the database configuration",
  options: {
    hooks: {
      // Register hook for PreToolUse events
      // Matcher filters to only Write and Edit tool calls
      PreToolUse: [
        { matcher: 'Write|Edit', hooks: [protectEnvFiles] }
      ]
    }
  }
})) {
  console.log(message);
}
```

### Permission Decisions

Hooks can control tool execution:

```typescript
// Block a tool
return {
  hookSpecificOutput: {
    hookEventName: input.hook_event_name,
    permissionDecision: 'deny',
    permissionDecisionReason: 'Dangerous command blocked'
  }
};

// Allow a tool
return {
  hookSpecificOutput: {
    hookEventName: input.hook_event_name,
    permissionDecision: 'allow',
    permissionDecisionReason: 'Auto-approved read-only operation'
  }
};

// Modify tool input
return {
  hookSpecificOutput: {
    hookEventName: input.hook_event_name,
    permissionDecision: 'allow',
    updatedInput: {
      ...input.tool_input,
      file_path: `/sandbox${originalPath}`
    }
  }
};
```

### Hook Chaining

Multiple hooks execute in order:

```typescript
const options = {
  hooks: {
    PreToolUse: [
      { hooks: [rateLimiter] },        // First: check rate limits
      { hooks: [authorizationCheck] }, // Second: verify permissions
      { hooks: [inputSanitizer] },     // Third: sanitize inputs
      { hooks: [auditLogger] }        // Last: log the action
    ]
  }
}
```

## File Checkpointing

Track file changes during agent sessions and restore files to any previous state.

### Enabling Checkpointing

```typescript
const opts = {
  enableFileCheckpointing: true,
  permissionMode: "acceptEdits",
  extraArgs: { 'replay-user-messages': null },  // Required for checkpoint UUIDs
  env: { ...process.env, CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: '1' }
};
```

### Capturing Checkpoints

```typescript
let checkpointId: string | undefined;
let sessionId: string | undefined;

for await (const message of response) {
  if (message.type === 'user' && message.uuid && !checkpointId) {
    checkpointId = message.uuid;  // First user message = restore point
  }
  if ('session_id' in message && !sessionId) {
    sessionId = message.session_id;
  }
}
```

### Rewinding Files

```typescript
// Resume session and rewind
const rewindQuery = query({
  prompt: "",  // Empty prompt to open connection
  options: { ...opts, resume: sessionId }
});

for await (const msg of rewindQuery) {
  await rewindQuery.rewindFiles(checkpointId);
  break;
}
```

**Use cases for checkpointing:**
- Undo unwanted changes by restoring to known good state
- Explore alternatives by restoring and trying different approach
- Recover from errors when agent makes incorrect modifications

<Warning>
Only changes made through Write, Edit, and NotebookEdit tools are tracked. Changes via Bash commands are not captured.
</Warning>

## Subagents

Define specialized subagents that can be launched for specific tasks:

```typescript
const options = {
  agents: {
    codeReviewer: {
      description: 'Review code for bugs and style issues',
      tools: ['Read', 'Grep', 'Glob'],
      prompt: 'You are a code reviewer. Check for bugs, security issues, and style violations.',
      model: 'sonnet'
    },
    testWriter: {
      description: 'Write comprehensive tests',
      prompt: 'Write tests covering edge cases and error conditions',
      model: 'haiku'
    }
  }
};
```

## Sandbox Configuration

Configure sandbox behavior for secure command execution:

```typescript
const options = {
  sandbox: {
    enabled: true,
    autoAllowBashIfSandboxed: true,
    excludedCommands: ['docker'],
    network: {
      allowLocalBinding: true,
      allowUnixSockets: ['/var/run/docker.sock']
    }
  }
};
```

## MCP Servers

Configure Model Context Protocol servers for external integrations:

```typescript
const options = {
  mcpServers: {
    // Stdio server
    filesystem: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/files']
    },

    // SSE server
    customApi: {
      type: 'sse',
      url: 'https://api.example.com/sse'
    },

    // HTTP server
    restApi: {
      type: 'http',
      url: 'https://api.example.com/mcp'
    }
  }
};
```

## Message Types

### SDKMessage

Union type of all possible messages:

```typescript
type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage;
```

### Result Message

```typescript
interface SDKResultMessage {
  type: 'result';
  subtype: 'success' | 'error_max_turns' | 'error_during_execution';
  uuid: UUID;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result?: string;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: { [modelName: string]: ModelUsage };
  permission_denials: SDKPermissionDenial[];
  errors?: string[];
}
```

## Advanced Features

### Structured Outputs

Define output format for agent results:

```typescript
const options = {
  outputFormat: {
    type: 'json_schema',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        details: { type: 'array', items: { type: 'string' } }
      },
      required: ['success', 'message']
    }
  }
};
```

### Beta Features

Enable experimental features:

```typescript
const options = {
  betas: ['context-1m-2025-08-07']  // 1M token context window
};
```

### Custom Plugins

Load plugins from local paths:

```typescript
const options = {
  plugins: [
    { type: 'local', path: './my-plugin' }
  ]
};
```

## Use Cases for Ralph Wiggum Technique

The SDK provides several features that are particularly important for implementing the Ralph Wiggum technique:

### 1. Session Resumption

**Why important for Ralph:** Ralph runs the same prompt repeatedly in a loop. Each iteration needs to resume the session to maintain context and build on previous work.

```typescript
// Loop pattern for Ralph
let sessionId: string | undefined;

// First iteration
const firstResponse = query({ prompt: taskPrompt, options: {} });
for await (const msg of firstResponse) {
  if (msg.type === 'system' && msg.subtype === 'init') {
    sessionId = msg.session_id;
  }
}

// Subsequent iterations resume the session
for (let i = 0; i < maxIterations; i++) {
  const response = query({
    prompt: taskPrompt,
    options: { resume: sessionId }
  });
  // Process response...
}
```

### 2. Hooks for Stop Detection

**Why important for Ralph:** Ralph needs a way to detect when the task is complete and stop the loop. Hooks can intercept agent execution and determine completion criteria.

```typescript
let shouldStop = false;

const stopHook: HookCallback = async (input, toolUseID, { signal }) => {
  if (input.hook_event_name === 'Stop') {
    // Check completion criteria
    const isComplete = await checkCompletionCriteria();
    shouldStop = isComplete;
  }
  return {};
};

// Use Stop hook in Ralph loop
for await (const message of query({
  prompt: taskPrompt,
  options: {
    hooks: { Stop: [{ hooks: [stopHook] }] },
    resume: sessionId
  }
})) {
  if (shouldStop) break;
}
```

### 3. File Checkpointing

**Why important for Ralph:** When Ralph takes wrong directions, you need to restore files to a known good state. Checkpointing enables undo and recovery.

```typescript
const safeCheckpoint = string | undefined;

// Capture checkpoint before each iteration
for await (const message of query({
  prompt: taskPrompt,
  options: {
    enableFileCheckpointing: true,
    extraArgs: { 'replay-user-messages': null }
  }
})) {
  if (message.type === 'user' && message.uuid) {
    safeCheckpoint = message.uuid;
  }

  // If things go wrong, rewind
  if (needsRollback && safeCheckpoint) {
    await response.rewindFiles(safeCheckpoint);
    break;
  }
}
```

### 4. Hooks for Backpressure

**Why important for Ralph:** Ralph relies on backpressure (tests, type checks, lints) to reject invalid work. Hooks can enforce these constraints.

```typescript
const enforceBackpressure: HookCallback = async (input, toolUseID, { signal }) => {
  if (input.hook_event_name === 'PostToolUse') {
    const postInput = input as PostToolUseHookInput;

    // Run tests after file modifications
    if (postInput.tool_name === 'Write' || postInput.tool_name === 'Edit') {
      const testsPassed = await runTests();
      if (!testsPassed) {
        return {
          systemMessage: 'Tests failed. Fix the implementation to make tests pass.',
          hookSpecificOutput: {
            hookEventName: input.hook_event_name,
            permissionDecision: 'deny',
            permissionDecisionReason: 'Tests must pass'
          }
        };
      }
    }
  }
  return {};
};
```

### 5. Subagents for Parallel Work

**Why important for Ralph:** Ralph can use subagents to explore different aspects of the codebase in parallel, speeding up context gathering and analysis.

```typescript
const options = {
  agents: {
    planner: {
      description: 'Generate implementation plans',
      prompt: 'Analyze requirements and create a prioritized task list',
      model: 'sonnet'
    },
    implementer: {
      description: 'Implement code changes',
      tools: ['Read', 'Write', 'Edit', 'Bash'],
      prompt: 'Implement the changes according to the plan',
      model: 'opus'
    }
  }
};
```

### 6. Permission Bypass for Autonomy

**Why important for Ralph:** Ralph needs to run autonomously without stopping for permission prompts. Use `permissionMode: 'bypassPermissions'` with `allowDangerouslySkipPermissions: true`.

```typescript
const options = {
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
  sandbox: { enabled: true }  // Always sandbox when bypassing
};
```

### 7. Stop Conditions for Safety

**Why important for Ralph:** Prevent infinite loops and control costs by setting maximum iterations, token limits, or budget caps.

```typescript
const options = {
  maxTurns: 100,           // Maximum conversation turns
  maxBudgetUsd: 50.00,     // Maximum cost in USD
};
```

### 8. Hooks for Progress Tracking

**Why important for Ralph:** Ralph needs to track what work has been done to avoid repeating mistakes and measure progress.

```typescript
const progressLog: string[] = [];

const trackProgress: HookCallback = async (input, toolUseID, { signal }) => {
  if (input.hook_event_name === 'PostToolUse') {
    const postInput = input as PostToolUseHookInput;
    progressLog.push(`${postInput.tool_name}: ${JSON.stringify(postInput.tool_input)}`);
  }
  return {};
};
```

### 9. Hooks for Compaction Management

**Why important for Ralph:** Long-running Ralph sessions need context compaction to avoid running out of context. Hooks can control when and how compaction happens.

```typescript
const preCompactHook: HookCallback = async (input, toolUseID, { signal }) => {
  if (input.hook_event_name === 'PreCompact') {
    console.log('Compacting conversation...');
    // Could save full transcript before compaction
  }
  return {};
};
```

### 10. Integration with Ralph-Loop-Agent

**Why important for Ralph:** Vercel's `ralph-loop-agent` package wraps the AI SDK with a built-in loop mechanism specifically for the Ralph Wiggum technique.

```typescript
// Using ralph-loop-agent package
import { RalphLoopAgent } from '@vercel-labs/ralph-loop-agent';

const agent = new RalphLoopAgent({
  model: 'anthropic/claude-opus-4.5',
  instructions: 'You are a helpful coding assistant.',
  stopWhen: iterationCountIs(10),
  verifyCompletion: async ({ result }) => ({
    complete: result.text.includes('DONE'),
    reason: 'Task completed successfully',
  }),
});
```

## Best Practices

### Security

1. **Always sandbox when bypassing permissions**
2. **Use hooks to validate file paths and commands**
3. **Never expose private credentials in prompts**
4. **Use environment variables for sensitive data**

### Performance

1. **Use `continue: true` for multi-turn conversations**
2. **Enable context compaction for long-running sessions**
3. **Use subagents for parallel exploration**
4. **Set appropriate `maxTurns` and `maxBudgetUsd` limits**

### Reliability

1. **Enable file checkpointing for recovery**
2. **Use hooks for comprehensive logging**
3. **Set conservative stop conditions initially**
4. **Monitor usage during long-running tasks**

### Ralph-Specific

1. **Capture session ID for resumption**
2. **Implement stop hooks for completion detection**
3. **Use backpressure hooks for test enforcement**
4. **Track progress to avoid repeating mistakes**
5. **Always sandbox autonomous runs**

## Troubleshooting

### Hook Not Firing

- Verify hook event name is correct and case-sensitive
- Check matcher pattern matches tool name
- Ensure hook is under correct event type
- Hooks may not fire when agent hits `maxTurns` limit

### Matcher Not Filtering

- Matchers only match tool names, not file paths
- Filter by file path inside your callback function
- Use regex patterns to match multiple tools

### Session Hooks Not Available

- `SessionStart`, `SessionEnd`, `Notification` hooks are TypeScript-only
- Python SDK does not support these events

### File Checkpointing Issues

- Ensure `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING` environment variable is set
- Verify `extraArgs: { 'replay-user-messages': null }` is set
- Resume session before calling `rewindFiles()`

## Resources

- **GitHub Repository**: https://github.com/anthropics/claude-agent-sdk-typescript
- **Official Documentation**: https://platform.claude.com/docs/en/agent-sdk
- **Discord Community**: https://anthropic.com/discord
- **Issue Tracker**: https://github.com/anthropics/claude-agent-sdk-typescript/issues

## Related Tools

- **ralph-loop-agent**: https://github.com/vercel-labs/ralph-loop-agent - Continuous autonomous loops for AI SDK
- **Claude Code CLI**: `npm install -g @anthropic-ai/claude-code` - Command-line interface
- **Python SDK**: `pip install claude-agent-sdk` - Python version of the SDK
