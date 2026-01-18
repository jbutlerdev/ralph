#!/usr/bin/env node

/**
 * Ralph Executor Server
 *
 * HTTP API server for autonomous execution of Ralph implementation plans.
 * Provides REST endpoints for triggering plan execution, checking status,
 * and managing execution sessions.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { RalphExecutor, RalphExecutorOptions } from './ralph-executor.skill.js';
import { RalphPlan, loadPlan } from '../ralph-plan-generator/ralph-plan-generator.skill.js';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Execution result summary
 */
export interface ExecutionResult {
  sessionId: string;
  completedTasks: string[];
  failedTasks: string[];
  totalTasks: number;
  duration: number;
  startTime: string;
  endTime: string;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  projectRoot: string;
  autoCommit?: boolean;
  autoTest?: boolean;
  maxRetries?: number;
  maxParallel?: number;
}

/**
 * Execution request payload
 */
export interface ExecutionRequest {
  plan?: string;
  directory?: string;
  resume?: boolean;
  noCommit?: boolean;
  autoTest?: boolean;
  dryRun?: boolean;
  maxRetries?: number;
  maxParallel?: number;
}

/**
 * Active execution sessions
 */
interface ActiveSession {
  executor: RalphExecutor;
  result?: ExecutionResult;
  error?: string;
  startTime: number;
}

const activeSessions = new Map<string, ActiveSession>();

/**
 * Create and configure Express app
 */
function createApp(config: ServerConfig): express.Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      activeSessions: activeSessions.size,
      projectRoot: config.projectRoot,
    });
  });

  // List available plans
  app.get('/plans', async (req: Request, res: Response) => {
    try {
      const plansDir = path.join(config.projectRoot, 'plans');

      // Check if plans directory exists
      try {
        await fs.access(plansDir);
      } catch {
        // Directory doesn't exist, return empty list
        return res.json({ plans: [] });
      }

      const { planFromMarkdown } = await import('../ralph-plan-generator/ralph-plan-generator.skill.js');
      const entries = await fs.readdir(plansDir, { withFileTypes: true });

      const plans: Array<{
        id: string;
        path: string;
        title: string;
        totalTasks: number;
      }> = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const planPath = path.join(plansDir, entry.name, 'IMPLEMENTATION_PLAN.md');
          try {
            const planContent = await fs.readFile(planPath, 'utf-8');
            const plan = planFromMarkdown(planContent);
            plans.push({
              id: entry.name,
              path: planPath,
              title: plan.projectName,
              totalTasks: plan.totalTasks,
            });
          } catch {
            // Skip invalid plans
          }
        }
      }

      // Also check for root IMPLEMENTATION_PLAN.md
      const rootPlanPath = path.join(config.projectRoot, 'IMPLEMENTATION_PLAN.md');
      try {
        const rootPlanContent = await fs.readFile(rootPlanPath, 'utf-8');
        const rootPlan = planFromMarkdown(rootPlanContent);
        plans.push({
          id: 'root',
          path: rootPlanPath,
          title: rootPlan.projectName,
          totalTasks: rootPlan.totalTasks,
        });
      } catch {
        // No root plan, skip
      }

      res.json({ plans });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to list plans',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get plan details
  app.get('/plans/:planId', async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;
      const id = typeof planId === 'string' ? planId : planId[0];

      // Find the plan file
      let planPath: string;
      if (id === 'root') {
        planPath = path.join(config.projectRoot, 'IMPLEMENTATION_PLAN.md');
      } else {
        planPath = path.join(config.projectRoot, 'plans', id, 'IMPLEMENTATION_PLAN.md');
      }

      // Read and parse the plan directly
      const planContent = await fs.readFile(planPath, 'utf-8');
      const { planFromMarkdown } = await import('../ralph-plan-generator/ralph-plan-generator.skill.js');
      const plan = planFromMarkdown(planContent);
      res.json({ plan });
    } catch (error) {
      res.status(404).json({
        error: 'Plan not found',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Start execution
  app.post('/execute', async (req: Request, res: Response) => {
    try {
      const body = req.body as ExecutionRequest;

      // Determine plan path
      let planPath = body.plan || path.join(config.projectRoot, 'IMPLEMENTATION_PLAN.md');
      if (!path.isAbsolute(planPath)) {
        planPath = path.join(config.projectRoot, planPath);
      }

      // Determine project root
      const projectRoot = body.directory || config.projectRoot;

      // Create executor options
      const options: RalphExecutorOptions = {
        planPath,
        projectRoot,
        autoCommit: !body.noCommit && config.autoCommit,
        autoTest: body.autoTest || config.autoTest,
        maxRetries: body.maxRetries || config.maxRetries || 3,
        maxParallelTasks: body.maxParallel || config.maxParallel || 1,
      };

      // Load the plan first to get info
      const planContent = await fs.readFile(planPath, 'utf-8');
      const { planFromMarkdown } = await import('../ralph-plan-generator/ralph-plan-generator.skill.js');
      const plan = planFromMarkdown(planContent);

      // Create session ID
      const sessionId = `session-${Date.now()}`;

      // Create executor (constructor takes only options)
      const executor = new RalphExecutor(options);

      // Store session
      activeSessions.set(sessionId, {
        executor,
        startTime: Date.now(),
      });

      // Return session info immediately, execute in background
      res.json({
        sessionId,
        status: 'started',
        plan: {
          title: plan.projectName,
          totalTasks: plan.totalTasks,
        },
        message: 'Execution started in background',
      });

      // Execute in background
      executor.run().then((session) => {
        const activeSession = activeSessions.get(sessionId);
        if (!activeSession) return;

        const endTime = Date.now();
        activeSession.result = {
          sessionId,
          completedTasks: Array.from(session.completedTasks),
          failedTasks: Array.from(session.failedTasks),
          totalTasks: session.completedTasks.size + session.failedTasks.size,
          duration: endTime - activeSession.startTime,
          startTime: new Date(activeSession.startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        };
      }).catch((error) => {
        const activeSession = activeSessions.get(sessionId);
        if (activeSession) {
          activeSession.error = error instanceof Error ? error.message : String(error);
        }
      });

    } catch (error) {
      res.status(400).json({
        error: 'Failed to start execution',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get execution status
  app.get('/status/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const id = typeof sessionId === 'string' ? sessionId : sessionId[0];

    const session = activeSessions.get(id);

    if (!session) {
      res.status(404).json({
        error: 'Session not found',
        sessionId: id,
      });
      return;
    }

    if (session.error) {
      res.json({
        sessionId: id,
        status: 'failed',
        error: session.error,
      });
      return;
    }

    if (session.result) {
      res.json({
        sessionId: id,
        status: 'completed',
        result: session.result,
      });
      return;
    }

    // Still running
    res.json({
      sessionId: id,
      status: 'running',
      message: 'Execution in progress',
    });
  });

  // List active sessions
  app.get('/sessions', (req: Request, res: Response) => {
    const sessions: Array<{
      sessionId: string;
      status: string;
      error?: string;
    }> = [];

    for (const [sessionId, session] of activeSessions.entries()) {
      if (session.result) {
        sessions.push({ sessionId, status: 'completed' });
      } else if (session.error) {
        sessions.push({ sessionId, status: 'failed', error: session.error });
      } else {
        sessions.push({ sessionId, status: 'running' });
      }
    }

    res.json({ sessions });
  });

  // Delete session
  app.delete('/sessions/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const id = typeof sessionId === 'string' ? sessionId : sessionId[0];

    if (activeSessions.delete(id)) {
      res.json({
        sessionId: id,
        status: 'deleted',
        message: 'Session removed',
      });
    } else {
      res.status(404).json({
        error: 'Session not found',
        sessionId: id,
      });
    }
  });

  return app;
}

/**
 * Start the server
 */
export async function startServer(config: ServerConfig): Promise<void> {
  const app = createApp(config);

  return new Promise((resolve) => {
    app.listen(config.port, config.host, () => {
      console.log(`\n=== Ralph Executor Server ===`);
      console.log(`Server running at http://${config.host}:${config.port}`);
      console.log(`Project root: ${config.projectRoot}`);
      console.log(`\nAPI Endpoints:`);
      console.log(`  GET  /health              - Health check`);
      console.log(`  GET  /plans               - List available plans`);
      console.log(`  GET  /plans/:planId       - Get plan details`);
      console.log(`  POST /execute             - Start execution`);
      console.log(`  GET  /status/:sessionId   - Get execution status`);
      console.log(`  GET  /sessions            - List active sessions`);
      console.log(`  DELETE /sessions/:sessionId - Delete session`);
      console.log(`\nPress Ctrl+C to stop\n`);
      resolve();
    });
  });
}

/**
 * CLI entry point for server mode
 */
export async function main() {
  const args = process.argv.slice(2);

  // Parse simple CLI args
  const config: ServerConfig = {
    port: 3001,
    host: '0.0.0.0',
    projectRoot: process.cwd(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port' && args[i + 1]) {
      config.port = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--host' && args[i + 1]) {
      config.host = args[i + 1];
      i++;
    } else if (arg === '--directory' && args[i + 1]) {
      config.projectRoot = args[i + 1];
      i++;
    } else if (arg === '--auto-commit') {
      config.autoCommit = true;
    } else if (arg === '--auto-test') {
      config.autoTest = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Ralph Executor Server

Usage:
  node dist/server.js [options]

Options:
  --port <number>       Server port (default: 3001)
  --host <string>       Server host (default: 0.0.0.0)
  --directory <path>    Project root directory (default: current directory)
  --auto-commit         Enable automatic git commits
  --auto-test           Run tests after task completion
  --help, -h            Show this help message

API Usage:
  # List available plans
  curl http://localhost:3001/plans

  # Get plan details
  curl http://localhost:3001/plans/web-ui

  # Start execution
  curl -X POST http://localhost:3001/execute \\
    -H "Content-Type: application/json" \\
    -d '{"plan": "plans/web-ui/IMPLEMENTATION_PLAN.md"}'

  # Check execution status
  curl http://localhost:3001/status/session-1234567890

  # List active sessions
  curl http://localhost:3001/sessions
      `);
      process.exit(0);
    }
  }

  await startServer(config);
}

// Run if called directly
if (process.argv[1]?.endsWith('server.js')) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
