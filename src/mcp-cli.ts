#!/usr/bin/env node
/**
 * Ralph MCP Server CLI Wrapper
 *
 * This is a standalone binary that wraps the MCP server to:
 * 1. Find the path of the running ralph binary
 * 2. Read environment variables for session context
 * 3. Spawn the MCP server with proper environment
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';

async function main(): Promise<void> {
  const sessionId = process.env.RALPH_SESSION_ID || '';
  const planPath = process.env.RALPH_PLAN_PATH || '';
  const projectRoot = process.env.RALPH_PROJECT_ROOT || process.cwd();
  const currentTaskId = process.env.RALPH_CURRENT_TASK_ID || '';

  // Find the MCP server path relative to the running binary
  // The binary is at dist/mcp-cli.js, and MCP server at dist/mcp/server.js
  const binDir = path.dirname(path.dirname(new URL(import.meta.url).pathname));
  const mcpServerPath = path.join(binDir, 'dist', 'mcp', 'server.js');

  // Check if MCP server exists
  try {
    await fs.access(mcpServerPath);
  } catch {
    console.error('[MCP CLI] MCP server not found at:', mcpServerPath);
    console.error('[MCP CLI] Please run: npm run build');
    process.exit(1);
  }

  // Prepare environment for MCP server
  const mcpEnv: Record<string, string> = {
    RALPH_SESSION_ID: sessionId,
    RALPH_PLAN_PATH: planPath,
    RALPH_PROJECT_ROOT: projectRoot,
    RALPH_CURRENT_TASK_ID: currentTaskId,
  };

  // Spawn MCP server
  const mcpServer = spawn('node', [mcpServerPath], {
    env: {
      ...process.env,
      ...mcpEnv,
    },
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  mcpServer.on('error', (err) => {
    console.error('[MCP CLI] MCP server error:', err);
    process.exit(1);
  });

  mcpServer.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[MCP CLI] MCP server exited with code ${code}`);
      process.exit(code);
    }
  });
}

main().catch((err) => {
  console.error('[MCP CLI] Fatal error:', err);
  process.exit(1);
});
