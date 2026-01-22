#!/usr/bin/env node

/**
 * Ralph Executor Server
 *
 * HTTP API server for autonomous execution of Ralph implementation plans.
 * Provides REST endpoints for triggering plan execution, checking status,
 * and managing execution sessions.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { RalphExecutor, RalphExecutorOptions } from './executor.js';
import { loadPlan, planFromMarkdown } from './plan-generator.js';
import type { RalphPlan } from './types/index.js';
import { getRegistry, initRegistry } from './registry.js';
import { getPlanRuntimeStatus, getTasksRuntimeStatus } from './status.js';
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
  projectRoot?: string;
  // Registry is always enabled
  autoCommit?: boolean;
  autoTest?: boolean;
  requireAcceptanceCriteria?: boolean;
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
  requireAcceptanceCriteria?: boolean;
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
      const registry = getRegistry();
      const registeredPlans = await registry.listPlans();

      const plans = await Promise.all(
        registeredPlans.map(async (rp) => {
          // Get runtime status for this plan
          let runtimeStatus = {
            totalTasks: rp.totalTasks || 0,
            completedTasks: 0,
            inProgressTasks: 0,
            blockedTasks: 0,
            pendingTasks: 0,
            failedTasks: 0,
            progress: 0,
          };
          let projectName = rp.title || rp.planId;
          let description = '';

          try {
            const planContent = await fs.readFile(rp.planPath, 'utf-8');
            const plan = planFromMarkdown(planContent, rp.projectRoot);
            runtimeStatus = await getPlanRuntimeStatus(plan, rp.projectRoot);
            // Use the parsed plan's projectName (read from **Project:** field or derived from directory)
            projectName = plan.projectName;
            description = plan.description || '';
          } catch {
            // Plan file may be invalid or unreadable, use default zeros
          }

          return {
            id: rp.planId,
            path: rp.planPath,
            projectRoot: rp.projectRoot,
            title: projectName,
            description,
            totalTasks: rp.totalTasks || 0,
            completedTasks: runtimeStatus.completedTasks,
            inProgressTasks: runtimeStatus.inProgressTasks,
            blockedTasks: runtimeStatus.blockedTasks,
            pendingTasks: runtimeStatus.pendingTasks,
            failedTasks: runtimeStatus.failedTasks,
            progress: runtimeStatus.progress,
            registeredAt: rp.registeredAt,
            lastAccessed: rp.lastAccessed,
          };
        })
      );

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

      const registry = getRegistry();
      const registeredPlan = await registry.getPlan(id);

      if (!registeredPlan) {
        return res.status(404).json({
          error: 'Plan not found',
          planId: id,
          message: `Plan ${id} is not registered`,
        });
      }

      const planPath = registeredPlan.planPath;

      // Read and parse the plan
      const planContent = await fs.readFile(planPath, 'utf-8');
      const plan = planFromMarkdown(planContent, registeredPlan.projectRoot);

      // Get runtime status
      const runtimeStatus = await getPlanRuntimeStatus(plan, registeredPlan.projectRoot);

      // Get task-level runtime status
      const taskStatusMap = await getTasksRuntimeStatus(plan, registeredPlan.projectRoot);

      // Attach runtime status to each task
      const tasksWithStatus = plan.tasks.map(task => {
        const statusInfo = taskStatusMap.get(task.id);
        return {
          ...task,
          runtimeStatus: statusInfo?.status || 'pending',
        };
      });

      res.json({
        plan: {
          ...plan,
          tasks: tasksWithStatus,
          runtimeStatus,
          projectRoot: registeredPlan.projectRoot,
        },
      });
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

      if (!body.plan) {
        return res.status(400).json({
          error: 'Plan is required',
          message: 'Must specify a plan ID or path',
        });
      }

      let planPath: string;
      let projectRoot: string;
      const registry = getRegistry();

      // Helper function to check if a path looks like a file path (vs a plan ID)
      const looksLikeFilePath = (p: string): boolean => {
        return path.isAbsolute(p) ||
               p.startsWith('plans/') ||
               p.endsWith('.md') ||
               p.includes(path.sep);
      };

      // Try to look up in registry first (for plan IDs like "web-ui")
      const registeredPlan = await registry.getPlan(body.plan);

      if (registeredPlan) {
        // Found in registry - use it
        planPath = registeredPlan.planPath;
        projectRoot = body.directory || registeredPlan.projectRoot;
      } else if (looksLikeFilePath(body.plan)) {
        // Not in registry, but looks like a file path - try auto-registration
        planPath = body.plan;
        projectRoot = body.directory || path.dirname(planPath);

        // Auto-register the plan
        try {
          // Generate a plan ID from the path (e.g., "plans/web-ui/IMPLEMENTATION_PLAN.md" -> "web-ui")
          const pathParts = planPath.split(path.sep);
          let planId: string;

          if (path.isAbsolute(planPath)) {
            // For absolute paths, use the parent directory name
            planId = pathParts[pathParts.length - 2];
          } else if (pathParts[0] === 'plans' && pathParts.length >= 2) {
            // For plans/ paths, use the directory after plans/
            planId = pathParts[1];
          } else {
            // Fallback: use the filename without extension
            planId = pathParts[pathParts.length - 1].replace(/\.md$/, '');
          }

          const resolvedProjectRoot = path.resolve(projectRoot);
          const resolvedPlanPath = path.isAbsolute(planPath)
            ? planPath
            : path.resolve(resolvedProjectRoot, planPath);

          // Verify the plan file exists before registering
          try {
            await fs.access(resolvedPlanPath);
            await registry.registerPlan(planId, resolvedProjectRoot, resolvedPlanPath);
            console.log(`Auto-registered plan: ${planId} -> ${resolvedPlanPath}`);
          } catch (accessError) {
            // Plan file doesn't exist - don't try to register
            return res.status(404).json({
              error: 'Plan file not found',
              planPath: resolvedPlanPath,
              message: `Plan file does not exist: ${resolvedPlanPath}`,
            });
          }
        } catch (error) {
          // Don't fail execution if auto-registration fails
          console.warn(`Failed to auto-register plan: ${error}`);
        }
      } else {
        // Not in registry and doesn't look like a file path - it's an unknown plan ID
        return res.status(404).json({
          error: 'Plan not found in registry',
          planId: body.plan,
          message: `Plan ${body.plan} is not registered. Use 'ralph register' to add it, or provide a file path (e.g., plans/web-ui/IMPLEMENTATION_PLAN.md).`,
        });
      }

      // Create executor options
      const options: RalphExecutorOptions = {
        planPath,
        projectRoot,
        autoCommit: !body.noCommit && config.autoCommit,
        autoTest: body.autoTest || config.autoTest,
        requireAcceptanceCriteria: body.requireAcceptanceCriteria || config.requireAcceptanceCriteria,
        maxRetries: body.maxRetries || config.maxRetries || 3,
        maxParallelTasks: body.maxParallel || config.maxParallel || 1,
      };

      // Load the plan first to get info
      const planContent = await fs.readFile(planPath, 'utf-8');
      const plan = planFromMarkdown(planContent, projectRoot);

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
        projectRoot,
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

  // Restart execution of a plan
  app.post('/plans/:planId/restart', async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;
      const id = typeof planId === 'string' ? planId : planId[0];
      const body = req.body as ExecutionRequest;

      const registry = getRegistry();
      const registeredPlan = await registry.getPlan(id);

      if (!registeredPlan) {
        return res.status(404).json({
          error: 'Plan not found in registry',
          planId: id,
          message: `Plan ${id} is not registered. Use 'ralph register' to add it.`,
        });
      }

      const planPath = registeredPlan.planPath;
      const projectRoot = body.directory || registeredPlan.projectRoot;

      // Create executor options
      const options: RalphExecutorOptions = {
        planPath,
        projectRoot,
        autoCommit: !body.noCommit && config.autoCommit,
        autoTest: body.autoTest || config.autoTest,
        requireAcceptanceCriteria: body.requireAcceptanceCriteria || config.requireAcceptanceCriteria,
        maxRetries: body.maxRetries || config.maxRetries || 3,
        maxParallelTasks: body.maxParallel || config.maxParallel || 1,
      };

      // Load the plan first to get info
      const planContent = await fs.readFile(planPath, 'utf-8');
      const plan = planFromMarkdown(planContent, projectRoot);

      // Create session ID
      const sessionId = `session-${Date.now()}`;

      // Create executor
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
        projectRoot,
        message: 'Execution restarted in background',
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
        error: 'Failed to restart execution',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Global error handler - must be after all routes
  // This ensures all errors return JSON instead of HTML
  app.use((err: Error, req: Request, res: Response, next: unknown) => {
    console.error('Unhandled error:', err);
    // Ensure JSON response for all errors
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  // 404 handler - must be after the error handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  return app;
}

/**
 * Start the server
 */
export async function startServer(config: ServerConfig): Promise<void> {
  // Initialize registry
  await initRegistry();
  console.log('Registry initialized');

  const app = createApp(config);

  return new Promise((resolve) => {
    app.listen(config.port, config.host, () => {
      console.log(`\n=== Ralph Executor Server ===`);
      console.log(`Server running at http://${config.host}:${config.port}`);
      console.log(`Registry mode: enabled (plans from multiple projects)`);
      console.log(`\nAPI Endpoints:`);
      console.log(`  GET  /health                     - Health check`);
      console.log(`  GET  /plans                      - List available plans`);
      console.log(`  GET  /plans/:planId              - Get plan details`);
      console.log(`  POST /execute                    - Start execution`);
      console.log(`  POST /plans/:planId/restart      - Restart execution`);
      console.log(`  GET  /status/:sessionId          - Get execution status`);
      console.log(`  GET  /sessions                   - List active sessions`);
      console.log(`  DELETE /sessions/:sessionId      - Delete session`);
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
    } else if (arg === '--require-acceptance-criteria') {
      config.requireAcceptanceCriteria = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Ralph Executor Server

Usage:
  node dist/server.js [options]

Options:
  --port <number>       Server port (default: 3001)
  --host <string>       Server host (default: 0.0.0.0)
  --directory <path>    Fallback project root for absolute paths
  --auto-commit         Enable automatic git commits
  --auto-test           Run tests after task completion
  --require-acceptance-criteria  Fail tasks when acceptance criteria are not verified
  --help, -h            Show this help message

Registry Mode:
  The server always uses ~/.ralph/registry.json to manage plans from multiple projects.
  Use 'ralph register' to add plans to the registry.

API Usage:
  # List available plans
  curl http://localhost:3001/plans

  # Get plan details
  curl http://localhost:3001/plans/web-ui

  # Start execution (registry mode - use plan ID)
  curl -X POST http://localhost:3001/execute \\
    -H "Content-Type: application/json" \\
    -d '{"plan": "web-ui", "requireAcceptanceCriteria": true}'

  # Start execution (legacy mode - use plan path)
  curl -X POST http://localhost:3001/execute \\
    -H "Content-Type: application/json" \\
    -d '{"plan": "plans/web-ui/IMPLEMENTATION_PLAN.md", "requireAcceptanceCriteria": true}'

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
