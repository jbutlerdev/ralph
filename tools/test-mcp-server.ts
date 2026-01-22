#!/usr/bin/env node
/**
 * Test script for Ralph MCP Server
 *
 * This script manually tests the MCP server by spawning it as a subprocess
 * and sending tool calls via stdin.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function createTestSession(projectRoot: string): Promise<string> {
  const sessionsDir = path.join(projectRoot, '.ralph', 'sessions');
  await fs.mkdir(sessionsDir, { recursive: true });

  const sessionId = `test-session-${Date.now()}`;
  const sessionPath = path.join(sessionsDir, `${sessionId}.json`);

  const sessionData = {
    sessionId,
    planPath: 'IMPLEMENTATION_PLAN.md',
    completedTasks: [],
    skippedTasks: [],
    failedTasks: [],
    currentTaskId: 'task-001',
    taskHistory: [
      {
        taskId: 'task-001',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        attempts: 1,
      },
    ],
    startedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };

  await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
  return sessionId;
}

async function cleanupTestSession(projectRoot: string, sessionId: string): Promise<void> {
  const sessionPath = path.join(projectRoot, '.ralph', 'sessions', `${sessionId}.json`);
  try {
    await fs.unlink(sessionPath);
  } catch {
    // Ignore if file doesn't exist
  }
}

function sendRequest(server: ReturnType<typeof spawn>, request: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = Math.floor(Math.random() * 1000000);

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      ...request,
    });

    let buffer = '';

    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 5000);

    const handler = (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);
          if (response.id === requestId) {
            clearTimeout(timeout);
            server.stdout?.off('data', handler);
            resolve(response);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    server.stdout?.on('data', handler);
    server.stdin?.write(message + '\n');
  });
}

async function testMCPServer(): Promise<void> {
  const projectRoot = process.cwd();
  const mcpServerPath = path.join(projectRoot, 'dist', 'mcp', 'server.js');

  console.log(`${colors.blue}[Test] Starting MCP Server test...${colors.reset}\n`);

  // Check if server file exists
  try {
    await fs.access(mcpServerPath);
  } catch {
    console.error(`${colors.red}[Error] MCP server not found at ${mcpServerPath}${colors.reset}`);
    console.error(`${colors.yellow}Please run 'npm run build' first.${colors.reset}\n`);
    process.exit(1);
  }

  // Create test session
  console.log(`${colors.blue}[Test] Creating test session...${colors.reset}`);
  const sessionId = await createTestSession(projectRoot);
  console.log(`${colors.green}[Test] Session created: ${sessionId}${colors.reset}\n`);

  // Spawn MCP server
  console.log(`${colors.blue}[Test] Spawning MCP server...${colors.reset}`);
  const server = spawn('node', [mcpServerPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      RALPH_SESSION_ID: sessionId,
      RALPH_PLAN_PATH: 'IMPLEMENTATION_PLAN.md',
      RALPH_PROJECT_ROOT: projectRoot,
      RALPH_CURRENT_TASK_ID: 'task-001',
    },
  });

  // Capture stderr for debugging
  server.stderr?.on('data', (data) => {
    process.stderr.write(`[MCP stderr] ${data}`);
  });

  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Test 1: List tools
    console.log(`${colors.blue}[Test 1] Listing available tools...${colors.reset}`);
    const listResponse = await sendRequest(server, {
      method: 'tools/list',
      params: {},
    });

    if (listResponse.result?.tools) {
      console.log(`${colors.green}[Test 1] PASSED${colors.reset}`);
      console.log(`  Available tools: ${listResponse.result.tools.map((t: any) => t.name).join(', ')}\n`);
    } else {
      throw new Error('No tools returned');
    }

    // Test 2: Call task_complete tool
    console.log(`${colors.blue}[Test 2] Calling ralph_task_complete tool...${colors.reset}`);
    const callResponse = await sendRequest(server, {
      method: 'tools/call',
      params: {
        name: 'ralph_task_complete',
        arguments: {},
      },
    });

    if (callResponse.result) {
      console.log(`${colors.green}[Test 2] PASSED${colors.reset}`);
      const result = JSON.parse(callResponse.result.content[0].text);
      console.log(`  Result: ${result.message}\n`);
    } else {
      throw new Error('Tool call failed');
    }

    // Test 3: Verify session was updated
    console.log(`${colors.blue}[Test 3] Verifying session state update...${colors.reset}`);
    const sessionPath = path.join(projectRoot, '.ralph', 'sessions', `${sessionId}.json`);
    const sessionContent = await fs.readFile(sessionPath, 'utf-8');
    const sessionData = JSON.parse(sessionContent);

    if (sessionData.completedTasks.includes('task-001')) {
      console.log(`${colors.green}[Test 3] PASSED${colors.reset}`);
      console.log(`  Task 'task-001' marked as complete\n`);
    } else {
      throw new Error('Task not marked as complete in session');
    }

    console.log(`${colors.green}${colors.blue}All tests passed!${colors.reset}\n`);

  } catch (error) {
    console.error(`${colors.red}[Test FAILED]${colors.reset}`, error);
    process.exit(1);
  } finally {
    // Cleanup
    server.kill();
    await cleanupTestSession(projectRoot, sessionId);
  }
}

// Run tests
testMCPServer().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
