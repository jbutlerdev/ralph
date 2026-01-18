#!/usr/bin/env node
/**
 * Ralph Executor CLI
 *
 * A standalone CLI executable for running Ralph implementation plans.
 * This script parses command-line arguments and invokes the RalphExecutor
 * to autonomously execute tasks using Claude Code.
 */
import { program } from 'commander';
import { runRalphExecution } from './ralph-executor.skill.js';
import { loadPlan, listAllPlans } from '../ralph-plan-generator/ralph-plan-generator.skill.js';
import * as path from 'path';
import * as fs from 'fs/promises';
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
        .option('--test-command <cmd>', 'Test command to run (default: npm run test:run)', 'npm run test:run')
        .option('--dry-run', 'Dry run - show what would be executed without actually running')
        .option('-v, --verbose', 'Verbose output')
        .option('--max-retries <n>', 'Maximum retry attempts for failed tasks', '3')
        .option('--max-parallel <n>', 'Maximum parallel tasks (default: 1)', '1')
        .option('--model <name>', 'Claude model to use', 'claude-sonnet-4-5')
        .action(async (planArg, options) => {
        try {
            await executePlan(planArg, options);
        }
        catch (error) {
            console.error(`Error: ${error}`);
            process.exit(1);
        }
    });
    program
        .command('list')
        .description('List all available plans in the plans directory')
        .action(async () => {
        try {
            await listPlans();
        }
        catch (error) {
            console.error(`Error: ${error}`);
            process.exit(1);
        }
    });
    program
        .command('status [plan]')
        .description('Show status of an execution session')
        .option('-d, --directory <path>', 'Project root directory (default: current directory)')
        .action(async (planArg, options) => {
        try {
            await showStatus(planArg, options);
        }
        catch (error) {
            console.error(`Error: ${error}`);
            process.exit(1);
        }
    });
    await program.parseAsync(process.argv);
}
/**
 * Execute a Ralph implementation plan
 */
async function executePlan(planArg, options) {
    const projectRoot = path.resolve(options.directory || process.cwd());
    // Resolve plan path
    let planPath = options.plan;
    if (planArg) {
        // Check if it's a plan name (in plans/) or a direct path
        if (planArg.includes('/') || planArg.endsWith('.md')) {
            planPath = path.resolve(projectRoot, planArg);
        }
        else {
            // Assume it's a plan name in plans/ directory
            planPath = path.join(projectRoot, 'plans', planArg, 'IMPLEMENTATION_PLAN.md');
        }
    }
    else if (!planPath) {
        // Default to IMPLEMENTATION_PLAN.md in current or project directory
        planPath = path.join(projectRoot, 'IMPLEMENTATION_PLAN.md');
    }
    // Verify plan exists
    try {
        await fs.access(planPath);
    }
    catch {
        console.error(`Plan not found: ${planPath}`);
        console.error('\nAvailable plans:');
        await listPlans();
        process.exit(1);
    }
    // Load and validate the plan
    console.log(`Loading plan: ${planPath}`);
    const planContent = await fs.readFile(planPath, 'utf-8');
    const { planFromMarkdown, validateRalphPlan } = await import('../ralph-plan-generator/ralph-plan-generator.skill.js');
    const plan = planFromMarkdown(planContent);
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
        const { sortTasksByDependencies } = await import('../ralph-plan-generator/ralph-plan-generator.skill.js');
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
    const executorOptions = {
        projectRoot,
        planPath,
        resume: options.resume || false,
        autoCommit: options['no-commit'] !== true,
        autoTest: options['auto-test'] || false,
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
        }
        catch (error) {
            console.log(`  - ${planName} (failed to load)`);
        }
    }
}
/**
 * Show execution status
 */
async function showStatus(planArg, options) {
    const projectRoot = path.resolve(options.directory || process.cwd());
    const stateDir = path.join(projectRoot, '.ralph', 'sessions');
    try {
        await fs.access(stateDir);
    }
    catch {
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
//# sourceMappingURL=cli.js.map