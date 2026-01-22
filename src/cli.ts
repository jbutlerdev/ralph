#!/usr/bin/env node

/**
 * Ralph Executor CLI
 *
 * A standalone CLI executable for running Ralph implementation plans.
 * This script parses command-line arguments and invokes the RalphExecutor
 * to autonomously execute tasks using Claude Code.
 *
 * Can also run in server mode to provide an HTTP API for remote execution.
 */

import { program } from 'commander';
import { RalphExecutor, runRalphExecution, RalphExecutorOptions } from './executor.js';
import { loadPlan, listAllPlans, planFromMarkdown, validateRalphPlan, sortTasksByDependencies } from './plan-generator.js';
import { initRegistry } from './registry.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import { startServer, ServerConfig } from './server.js';

interface CliOptions {
  plan?: string;
  directory?: string;
  resume?: boolean;
  'no-commit'?: boolean;
  'auto-test'?: boolean;
  'require-acceptance-criteria'?: boolean;
  'test-command'?: string;
  dryRun?: boolean;
  verbose?: boolean;
  'max-retries'?: number;
  'max-parallel'?: number;
  model?: string;
  list?: boolean;
}

/**
 * Main CLI entry point
 */
async function main() {
  program
    .name('ralph-executor')
    .description('Autonomous execution of Ralph implementation plans')
    .version('1.0.0');

  program
    .command('run [plan]')
    .description('Execute a Ralph implementation plan')
    .option('-p, --plan <path>', 'Path to implementation plan (default: ./IMPLEMENTATION_PLAN.md)')
    .option('-d, --directory <path>', 'Project root directory (default: current directory)')
    .option('-r, --resume', 'Resume from previous session')
    .option('--no-commit', 'Disable automatic git commits')
    .option('--auto-test', 'Run tests after each task completion')
    .option('--require-acceptance-criteria', 'Fail tasks when acceptance criteria are not verified')
    .option('--test-command <cmd>', 'Test command to run (default: npm run test:run)', 'npm run test:run')
    .option('--dry-run', 'Dry run - show what would be executed without actually running')
    .option('-v, --verbose', 'Verbose output')
    .option('--max-retries <n>', 'Maximum retry attempts for failed tasks', '3')
    .option('--max-parallel <n>', 'Maximum parallel tasks (default: 1)', '1')
    .option('--model <name>', 'Claude model to use', 'claude-sonnet-4-5')
    .action(async (planArg: string | undefined, options: CliOptions) => {
      try {
        await executePlan(planArg, options);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMsg}`);
        process.exit(1);
      }
    });

  program
    .command('list')
    .description('List all available plans in the plans directory')
    .action(async () => {
      try {
        await listPlans();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMsg}`);
        process.exit(1);
      }
    });

  program
    .command('status [plan]')
    .description('Show status of an execution session')
    .option('-d, --directory <path>', 'Project root directory (default: current directory)')
    .action(async (planArg: string | undefined, options: CliOptions) => {
      try {
        await showStatus(planArg, options);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMsg}`);
        process.exit(1);
      }
    });

  program
    .command('server')
    .description('Start Ralph Executor HTTP API server')
    .option('-p, --port <number>', 'Server port (default: 3001)', '3001')
    .option('-h, --host <string>', 'Server host (default: 0.0.0.0)', '0.0.0.0')
    .option('-d, --directory <path>', 'Fallback project root for absolute paths')
    .option('--no-commit', 'Disable automatic git commits')
    .option('--auto-test', 'Run tests after task completion')
    .option('--require-acceptance-criteria', 'Fail tasks when acceptance criteria are not verified')
    .action(async (options: CliOptions & { port?: string; host?: string }) => {
      try {
        const config: ServerConfig = {
          port: Number(options.port) || 3001,
          host: options.host || '0.0.0.0',
          projectRoot: options.directory ? path.resolve(options.directory) : undefined,
          autoCommit: !options['no-commit'],
          autoTest: options['auto-test'] || false,
          requireAcceptanceCriteria: options['require-acceptance-criteria'] || false,
        };
        await startServer(config);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMsg}`);
        process.exit(1);
      }
    });

  // Registry commands
  program
    .command('register')
    .description('Register a plan in the plan registry')
    .argument('<planId>', 'Unique identifier for this plan')
    .argument('<planPath>', 'Path to the plan file')
    .option('-d, --directory <path>', 'Project root directory', process.cwd())
    .option('-f, --force', 'Overwrite existing registration')
    .action(async (planId: string, planPath: string, options: { directory?: string; force?: boolean }) => {
      try {
        const registry = await initRegistry();
        const projectRoot = path.resolve(options.directory || process.cwd());

        const registeredPlan = await registry.registerPlan(
          planId,
          projectRoot,
          planPath,
          { overwrite: options.force }
        );

        console.log(`Plan registered successfully:`);
        console.log(`  ID: ${registeredPlan.planId}`);
        console.log(`  Project root: ${registeredPlan.projectRoot}`);
        console.log(`  Plan path: ${registeredPlan.planPath}`);
        if (registeredPlan.title) {
          console.log(`  Title: ${registeredPlan.title}`);
        }
        if (registeredPlan.totalTasks) {
          console.log(`  Tasks: ${registeredPlan.totalTasks}`);
        }
      } catch (error) {
        console.error(`Error registering plan: ${error}`);
        process.exit(1);
      }
    });

  program
    .command('unregister')
    .description('Unregister a plan from the plan registry')
    .argument('<planId>', 'Plan ID to unregister')
    .action(async (planId: string) => {
      try {
        const registry = await initRegistry();
        await registry.unregisterPlan(planId);
        console.log(`Plan ${planId} unregistered successfully`);
      } catch (error) {
        console.error(`Error unregistering plan: ${error}`);
        process.exit(1);
      }
    });

  program
    .command('registry-list')
    .description('List all registered plans')
    .action(async () => {
      try {
        const registry = await initRegistry();
        const plans = await registry.listPlans();

        if (plans.length === 0) {
          console.log('No plans registered.');
          return;
        }

        console.log('Registered plans:\n');
        for (const plan of plans) {
          console.log(`  ${plan.planId}:`);
          console.log(`    Title: ${plan.title || 'N/A'}`);
          console.log(`    Project: ${plan.projectRoot}`);
          console.log(`    Plan: ${plan.planPath}`);
          if (plan.totalTasks) {
            console.log(`    Tasks: ${plan.totalTasks}`);
          }
          console.log(`    Registered: ${plan.registeredAt}`);
          if (plan.lastAccessed) {
            console.log(`    Last accessed: ${plan.lastAccessed}`);
          }
          console.log();
        }
      } catch (error) {
        console.error(`Error listing plans: ${error}`);
        process.exit(1);
      }
    });

  program
    .command('registry-stats')
    .description('Show registry statistics')
    .action(async () => {
      try {
        const registry = await initRegistry();
        const stats = await registry.getStats();

        console.log('Registry statistics:');
        console.log(`  Total plans: ${stats.totalPlans}`);
        console.log(`  Total projects: ${stats.totalProjects}`);
        console.log(`  Registry file: ${stats.registryPath}`);
      } catch (error) {
        console.error(`Error getting stats: ${error}`);
        process.exit(1);
      }
    });

  program
    .command('registry-clear')
    .description('Clear all plans from the registry')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (options: { yes?: boolean }) => {
      try {
        const registry = await initRegistry();
        const plans = await registry.listPlans();

        if (plans.length === 0) {
          console.log('Registry is already empty.');
          return;
        }

        if (!options.yes) {
          console.log(`This will remove ${plans.length} plan(s) from the registry.`);
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question('Are you sure? (yes/no): ', resolve);
          });
          rl.close();

          if (answer.toLowerCase() !== 'yes') {
            console.log('Aborted.');
            return;
          }
        }

        await registry.clear();
        console.log('Registry cleared successfully');
      } catch (error) {
        console.error(`Error clearing registry: ${error}`);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

/**
 * Execute a Ralph implementation plan
 */
async function executePlan(planArg: string | undefined, options: CliOptions) {
  const projectRoot = path.resolve(options.directory || process.cwd());

  // Resolve plan path
  let planPath = options.plan;

  if (planArg) {
    // Check if it's a plan name (in plans/) or a direct path
    if (planArg.includes('/') || planArg.endsWith('.md')) {
      planPath = path.resolve(projectRoot, planArg);
    } else {
      // Assume it's a plan name in plans/ directory
      planPath = path.join(projectRoot, 'plans', planArg, 'IMPLEMENTATION_PLAN.md');
    }
  } else if (!planPath) {
    // Default to IMPLEMENTATION_PLAN.md in current or project directory
    planPath = path.join(projectRoot, 'IMPLEMENTATION_PLAN.md');
  }

  // Verify plan exists
  try {
    await fs.access(planPath);
  } catch {
    console.error(`Plan not found: ${planPath}`);
    console.error('\nAvailable plans:');
    await listPlans();
    process.exit(1);
  }

  // Load and validate the plan
  console.log(`Loading plan: ${planPath}`);
  const planContent = await fs.readFile(planPath, 'utf-8');

  const plan = planFromMarkdown(planContent, projectRoot);

  const validation = validateRalphPlan(plan);
  if (!validation.valid) {
    console.error('Invalid plan:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  if (validation.warnings.length > 0) {
    console.warn('\nPlan warnings:');
    for (const warning of validation.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  console.log(`\nPlan: ${plan.projectName}`);
  console.log(`Total tasks: ${plan.totalTasks}`);
  console.log(`Estimated duration: ${plan.estimatedDuration || 'unknown'}`);

  if (options.dryRun) {
    console.log('\n[Dry run] Tasks that would be executed:');
    const sortedTasks = sortTasksByDependencies(plan.tasks);

    for (const task of sortedTasks) {
      console.log(`  ${task.id}: ${task.title}`);
      if (task.dependencies.length > 0) {
        console.log(`    Depends on: ${task.dependencies.join(', ')}`);
      }
    }
    return;
  }

  // Build executor options
  const executorOptions: RalphExecutorOptions = {
    projectRoot,
    planPath,
    resume: options.resume || false,
    autoCommit: options['no-commit'] !== true,
    autoTest: options['auto-test'] || false,
    requireAcceptanceCriteria: options['require-acceptance-criteria'] || false,
    testCommand: options['test-command'],
    maxRetries: Number(options['max-retries'] || 3),
    maxParallelTasks: Number(options['max-parallel'] || 1),
    claudeOptions: {
      model: options.model || 'claude-sonnet-4-5',
    },
    hooks: options.verbose ? {
      onTaskStart: async (task) => {
        console.log(`\n[${task.id}] Starting: ${task.title}`);
      },
      onTaskComplete: async (task, result) => {
        console.log(`\n[${task.id}] Completed: ${result.filesChanged} files changed`);
      },
      onProgress: async (progress) => {
        process.stdout.write(`\rProgress: ${progress}%`);
      },
    } : undefined,
  };

  // Execute the plan
  console.log('\n=== Starting Execution ===\n');
  const session = await runRalphExecution(executorOptions);

  console.log('\n=== Execution Summary ===');
  console.log(`Session ID: ${session.sessionId}`);
  console.log(`Tasks completed: ${session.completedTasks.size}/${plan.totalTasks}`);

  if (session.failedTasks.size > 0) {
    console.log(`\nFailed tasks: ${session.failedTasks.size}`);
    for (const taskId of session.failedTasks) {
      console.log(`  - ${taskId}`);
    }
  }
}

/**
 * List all available plans
 */
async function listPlans() {
  const plans = await listAllPlans();

  if (plans.length === 0) {
    console.log('No plans found.');
    return;
  }

  console.log('Available plans:');
  for (const planName of plans) {
    try {
      const plan = await loadPlan(planName);
      console.log(`  - ${planName}: ${plan.projectName}`);
      console.log(`    Tasks: ${plan.totalTasks} | Duration: ${plan.estimatedDuration || 'unknown'}`);
    } catch (error) {
      console.log(`  - ${planName} (failed to load)`);
    }
  }
}

/**
 * Show execution status
 */
async function showStatus(planArg: string | undefined, options: CliOptions) {
  const projectRoot = path.resolve(options.directory || process.cwd());
  const stateDir = path.join(projectRoot, '.ralph', 'sessions');

  try {
    await fs.access(stateDir);
  } catch {
    console.log('No execution sessions found.');
    return;
  }

  const sessions = await fs.readdir(stateDir);
  const sessionFiles = sessions
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  if (sessionFiles.length === 0) {
    console.log('No execution sessions found.');
    return;
  }

  console.log('Execution sessions:\n');

  for (const sessionFile of sessionFiles) {
    const sessionPath = path.join(stateDir, sessionFile);
    const content = await fs.readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content);

    const completed = session.completedTasks?.length || 0;
    const failed = session.failedTasks?.length || 0;

    console.log(`Session: ${session.sessionId}`);
    console.log(`  Plan: ${session.planPath}`);
    console.log(`  Status: ${completed}/${session.totalTasks || '?'} tasks completed`);
    if (failed > 0) {
      console.log(`  Failed: ${failed} tasks`);
    }
    console.log(`  Started: ${session.startedAt}`);
    console.log(`  Last activity: ${session.lastActivity}`);
    console.log();
  }
}

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
