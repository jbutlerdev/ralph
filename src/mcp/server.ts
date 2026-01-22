/**
 * Ralph MCP Server
 *
 * An MCP (Model Context Protocol) server that provides the task-complete tool
 * to Claude Code during Ralph execution. This allows the running AI to explicitly
 * signal task completion and trigger progression to the next task.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { handleTaskComplete } from './task-complete-tool.js';

/**
 * Get environment variables for session context
 */
function getSessionContext(): {
  sessionId: string | undefined;
  planPath: string | undefined;
  projectRoot: string | undefined;
  currentTaskId: string | undefined;
} {
  return {
    sessionId: process.env.RALPH_SESSION_ID,
    planPath: process.env.RALPH_PLAN_PATH,
    projectRoot: process.env.RALPH_PROJECT_ROOT,
    currentTaskId: process.env.RALPH_CURRENT_TASK_ID,
  };
}

/**
 * Definition of the task-complete tool
 */
const taskCompleteTool: Tool = {
  name: 'ralph_task_complete',
  description: `Mark the current Ralph task as complete.

This tool should be called when you have finished implementing a task. After calling this
tool, the Ralph executor will kill this Claude Code session and proceed to the next
task in the implementation plan.

IMPORTANT: Only call this tool when you have ACTUALLY COMPLETED the task by
making code changes. Do not call it if you have only planned or described
what should be done.`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

/**
 * Create and configure the Ralph MCP server
 */
export function createRalphMCPServer(): Server {
  const server = new Server(
    {
      name: 'ralph-executor',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register the task-complete tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    if (name === taskCompleteTool.name) {
      const context = getSessionContext();

      try {
        const result = await handleTaskComplete(context);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: errorMessage,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  });

  // List available tools
  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => {
      return {
        tools: [taskCompleteTool],
      };
    }
  );

  return server;
}

/**
 * Start the Ralph MCP server with stdio transport
 *
 * This function is the entry point when the server is spawned as a subprocess.
 * It reads from stdin and writes to stdout using the MCP protocol.
 */
export async function startRalphMCPServer(): Promise<void> {
  const server = createRalphMCPServer();
  const transport = new StdioServerTransport();

  // Log server startup for debugging
  const stderr = process.stderr;
  const context = getSessionContext();
  stderr.write(`[Ralph MCP] Server starting...\n`);
  stderr.write(`[Ralph MCP] Session ID: ${context.sessionId || 'not set'}\n`);
  stderr.write(`[Ralph MCP] Plan path: ${context.planPath || 'not set'}\n`);
  stderr.write(`[Ralph MCP] Project root: ${context.projectRoot || 'not set'}\n`);
  stderr.write(`[Ralph MCP] Current task: ${context.currentTaskId || 'not set'}\n`);

  await server.connect(transport);
  stderr.write(`[Ralph MCP] Server connected and listening on stdio\n`);
}

/**
 * Start the server if this file is executed directly
 */
// When invoked via `node dist/mcp/server.js`, this is the main entry point
// so we always start the server (no need for import.meta.url check)
startRalphMCPServer().catch((error) => {
  process.stderr.write(`[Ralph MCP] Fatal error: ${error}\n`);
  process.exit(1);
});
