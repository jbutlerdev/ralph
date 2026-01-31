/**
 * Ralph Executor Skill
 *
 * This skill orchestrates the autonomous execution of a Ralph Wiggum implementation plan.
 * It uses the Claude Code CLI to run independent sessions for each task, managing
 * dependencies, checkpoints, and state persistence.
 *
 * Execution approach inspired by claudeception - uses CLI subprocess with
 * --output-format stream-json for proper log capture and real-time visibility.
 */

import * as fs from 'fs/promises';
import { createWriteStream, type WriteStream } from 'fs';
import * as path from 'path';
import { execa, type ResultPromise } from 'execa';
import type {
  RalphTask,
  RalphPlan,
  ExecutionResult,
  ServerConfig,
  RalphExecutorOptions,
  TaskExecution,
  TaskResult,
  RalphExecutionSession,
} from './types/index.js';
import { getNextTask, planFromMarkdown, planToMarkdown, validateRalphPlan } from './plan-generator.js';
import { logEvents, parseStreamJsonLine, type LogEvent, type StatsEvent, type PlanStatusEvent } from './log-events.js';

// Re-export types for the skill to use
export type {
  RalphTask,
  RalphPlan,
  ExecutionResult,
  ServerConfig,
  RalphExecutorOptions,
  TaskExecution,
  TaskResult,
  RalphExecutionSession,
};

/**
 * Server API client options
 */
export interface ServerClientOptions {
  /**
   * Server host (default: localhost)
   */
  host?: string;

  /**
   * Server port (default: 3001)
   */
  port?: number;

  /**
   * Project root directory
   */
  projectRoot: string;

  /**
   * Path to the implementation plan (relative to project root or absolute)
   */
  planPath?: string;

  /**
   * Additional options for execution
   */
  noCommit?: boolean;
  autoTest?: boolean;
  dryRun?: boolean;
  maxRetries?: number;
  maxParallel?: number;
}

/**
 * The Ralph Executor - orchestrates autonomous execution of implementation plans
 */
export class RalphExecutor {
  private options: RalphExecutorOptions;
  private session: RalphExecutionSession;
  private plan: any; // RalphPlan from plan-generator

  constructor(options: RalphExecutorOptions) {
    this.options = {
      maxRetries: 3,
      maxParallelTasks: 1,
      autoCommit: true,
      autoTest: false,
      requireAcceptanceCriteria: false,
      testCommand: 'npm run test:run',
      stateDir: '.ralph/sessions',
      resume: false,
      skipCompletedTasks: false,
      ...options,
    };

    this.options.projectRoot = path.resolve(this.options.projectRoot);
    this.options.planPath = this.options.planPath || path.join(this.options.projectRoot, 'IMPLEMENTATION_PLAN.md');
    this.options.stateDir = path.resolve(this.options.projectRoot, this.options.stateDir || '.ralph/sessions');

    this.session = this.createSession();
  }

  /**
   * Create a new execution session
   */
  private createSession(): RalphExecutionSession {
    const sessionId = this.options.resume
      ? `resume-${Date.now()}`
      : `session-${Date.now()}`;

    return {
      sessionId,
      planPath: this.options.planPath!,
      completedTasks: new Set(),
      skippedTasks: new Set(),
      failedTasks: new Set(),
      currentTaskId: null,
      taskHistory: [],
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
  }

  /**
   * Load the implementation plan
   */
  private async loadPlan(): Promise<void> {
    const planContent = await fs.readFile(this.options.planPath!, 'utf-8');

    // Import the plan-generator utilities
    this.plan = planFromMarkdown(planContent);

    // Validate the plan
    const validation = validateRalphPlan(this.plan);

    if (!validation.valid) {
      throw new Error(`Invalid implementation plan:\n${validation.errors.join('\n')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn(`Plan warnings:\n${validation.warnings.join('\n')}`);
    }
  }

  /**
   * Save session state to disk
   */
  private async saveSession(): Promise<void> {
    const stateDir = this.options.stateDir!;
    await fs.mkdir(stateDir, { recursive: true });

    const sessionPath = path.join(stateDir, `${this.session.sessionId}.json`);

    const serializableSession = {
      ...this.session,
      completedTasks: Array.from(this.session.completedTasks),
      skippedTasks: Array.from(this.session.skippedTasks),
      failedTasks: Array.from(this.session.failedTasks),
    };

    await fs.writeFile(sessionPath, JSON.stringify(serializableSession, null, 2), 'utf-8');
  }

  /**
   * Load a previous session state
   */
  private async loadSession(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.options.stateDir!, `${sessionId}.json`);

    const content = await fs.readFile(sessionPath, 'utf-8');
    const loaded = JSON.parse(content);

    this.session = {
      ...loaded,
      completedTasks: new Set(loaded.completedTasks),
      skippedTasks: new Set(loaded.skippedTasks),
      failedTasks: new Set(loaded.failedTasks),
    };
  }

  /**
   * Get the next task to execute
   */
  private getNextTask(): RalphTask | null {
    return getNextTask(this.plan, this.session.completedTasks);
  }

  /**
   * Get the plan ID from the plan path
   */
  private getPlanId(): string {
    // Extract plan ID from path (e.g., "plans/web-ui/IMPLEMENTATION_PLAN.md" -> "web-ui")
    const planPath = this.options.planPath || '';
    const pathParts = planPath.split(path.sep);

    // Look for 'plans' directory and get the next part
    const plansIndex = pathParts.indexOf('plans');
    if (plansIndex >= 0 && pathParts.length > plansIndex + 1) {
      return pathParts[plansIndex + 1];
    }

    // Fallback: use parent directory name or filename
    if (pathParts.length >= 2) {
      return pathParts[pathParts.length - 2];
    }

    return 'unknown';
  }

  /**
   * Emit a plan status event
   */
  private emitPlanStatusEvent(
    type: PlanStatusEvent['type'],
    taskId?: string,
    error?: string
  ): void {
    const progress = this.plan ? this.calculateProgress() : 0;

    logEvents.emitPlanStatus({
      planId: this.getPlanId(),
      sessionId: this.session.sessionId,
      timestamp: new Date().toISOString(),
      type,
      taskId,
      progress,
      completedTasks: this.session.completedTasks.size,
      failedTasks: this.session.failedTasks.size,
      inProgressTasks: this.session.currentTaskId ? 1 : 0,
    });
  }

  /**
   * Execute a single task using Claude Code SDK
   */
  private async executeTask(task: RalphTask): Promise<TaskResult> {
    const taskExecution: TaskExecution = {
      taskId: task.id,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      attempts: 1,
    };

    this.session.taskHistory.push(taskExecution);
    this.session.currentTaskId = task.id;
    await this.saveSession();

    // Call task start hook
    if (this.options.hooks?.onTaskStart) {
      await this.options.hooks.onTaskStart(task, this.session);
    }

    // Emit task started event for real-time dashboard updates
    this.emitPlanStatusEvent('task.started', task.id);

    const startTime = Date.now();
    let result: TaskResult;

    try {
      // Build the task prompt
      const prompt = this.buildTaskPrompt(task);

      // Execute using Claude Code SDK
      result = await this.executeWithClaude(task, prompt);

      // Update execution state
      taskExecution.completedAt = new Date().toISOString();
      taskExecution.duration = Date.now() - startTime;
      taskExecution.result = result;

      // Update plan file with completed acceptance criteria
      await this.updatePlanFile(task, result);

      // Check acceptance criteria - task is only complete if ALL criteria pass
      const allCriteriaPassed = result.acceptanceCriteriaFailed.length === 0;

      if (!allCriteriaPassed) {
        // Acceptance criteria not fully met - fail the task regardless of strict mode
        throw new Error(
          `Acceptance criteria not met (${result.acceptanceCriteriaPassed.length}/${task.acceptanceCriteria.length} passed):\n${result.acceptanceCriteriaFailed.map(f => `  - ${f}`).join('\n')}`
        );
      }

      // All criteria passed - mark task as completed and add to completedTasks
      taskExecution.status = 'completed';
      this.session.completedTasks.add(task.id);
      this.session.lastActivity = new Date().toISOString();

      // Call task complete hook
      if (this.options.hooks?.onTaskComplete) {
        await this.options.hooks.onTaskComplete(task, result, this.session);
      }

      // Emit task completed event for real-time dashboard updates
      this.emitPlanStatusEvent('task.completed', task.id);

      // Auto-commit if enabled
      if (this.options.autoCommit) {
        await this.commitTask(task, result);
      }

      // Auto-test if enabled
      if (this.options.autoTest) {
        await this.runTests(task);
      }

    } catch (error) {
      taskExecution.status = 'failed';
      taskExecution.completedAt = new Date().toISOString();
      taskExecution.duration = Date.now() - startTime;
      taskExecution.error = error instanceof Error ? error.message : String(error);

      this.session.failedTasks.add(task.id);
      this.session.lastActivity = new Date().toISOString();

      // Call task fail hook
      if (this.options.hooks?.onTaskFail) {
        await this.options.hooks.onTaskFail(task, error as Error, this.session);
      }

      // Emit task failed event for real-time dashboard updates
      this.emitPlanStatusEvent('task.failed', task.id, error instanceof Error ? error.message : String(error));

      throw error;
    }

    await this.saveSession();
    return result;
  }

  /**
   * Build the prompt for a task execution
   */
  private buildTaskPrompt(task: RalphTask): string {
    let prompt = `# Task Execution - IMPLEMENT THIS TASK\n\n`;

    // Project context from the plan
    prompt += `## Project Context\n\n`;
    prompt += `**Project:** ${this.plan.projectName}\n\n`;
    prompt += `**Overview:**\n${this.plan.overview}\n\n`;

    prompt += `You are an autonomous AI assistant. You MUST IMPLEMENT the following task by writing, modifying, or deleting code files.\n\n`;
    prompt += `Do NOT just describe what should be done - you MUST actually make the code changes.\n\n`;

    prompt += `**Task ID:** ${task.id}\n`;
    prompt += `**Title:** ${task.title}\n`;
    prompt += `**Status:** ${task.status}\n`;
    prompt += `**Priority:** ${task.priority}\n\n`;

    if (task.dependencies.length > 0) {
      prompt += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
      prompt += `(These tasks have been completed and their changes are already in the codebase)\n\n`;
    }

    prompt += `## Task Description\n\n`;
    prompt += `${task.description}\n\n`;

    if (task.acceptanceCriteria.length > 0) {
      prompt += `## Acceptance Criteria (MUST BE MET)\n\n`;
      prompt += `You must ensure ALL of the following criteria are satisfied by your implementation:\n\n`;
      for (const criterion of task.acceptanceCriteria) {
        const checkbox = criterion.completed ? '[x]' : '[ ]';
        prompt += `- ${checkbox} ${criterion.text}\n`;
      }
      prompt += `\n`;
    }

    if (task.specReference) {
      prompt += `## Specification Reference\n\n`;
      prompt += `Refer to: ${task.specReference}\n\n`;
    }

    prompt += `## Implementation Instructions\n\n`;
    prompt += `Follow these steps to complete the task:\n\n`;
    prompt += `1. **Explore the codebase**: Read relevant files to understand the current implementation\n`;
    prompt += `2. **Implement the changes**: Create, modify, or delete files as needed to complete the task\n`;
    prompt += `3. **Verify criteria**: Ensure all acceptance criteria are met by your implementation\n`;
    prompt += `4. **Be focused**: Make ONLY the changes necessary to complete this specific task\n`;
    prompt += `5. **Provide summary**: After completion, summarize what was changed and why\n\n`;

    prompt += `## Important Notes\n\n`;
    prompt += `- This is an autonomous execution - you must actually write/modify code\n`;
    prompt += `- Use appropriate tools (Read, Write, Edit, Bash, etc.) to make changes\n`;
    prompt += `- If you need clarification, make reasonable assumptions based on the task context\n`;
    prompt += `- Ensure your code follows existing patterns and conventions in the codebase\n`;
    prompt += `- Test your implementation if possible (run relevant tests or checks)\n\n`;

    prompt += `## Task Status Information\n\n`;
    prompt += `This task has a status of "${task.status}". The possible task statuses are:\n`;
    prompt += `- **To Do**: Task is ready to be started\n`;
    prompt += `- **In Progress**: Task is currently being worked on\n`;
    prompt += `- **Implemented**: Task has been implemented and should not be executed again\n`;
    prompt += `- **Needs Re-Work**: Task was attempted but needs to be redone\n`;
    prompt += `- **Verified**: Task has been implemented and verified, should not be executed again\n\n`;
    prompt += `You are receiving this task because it is ready to be implemented. After you complete\n`;
    prompt += `the implementation, the task status will be updated to "Implemented".\n\n`;

    prompt += `BEGIN IMPLEMENTATION NOW.\n`;

    return prompt;
  }

  /**
   * Execute a task using Claude Code CLI
   * Uses the CLI subprocess with --output-format stream-json for proper log capture.
   * Inspired by claudeception's execution approach.
   */
  private async executeWithClaude(task: RalphTask, prompt: string): Promise<TaskResult> {
    const git = await import('simple-git');

    console.log(`  [DEBUG] Starting CLI execution for ${task.id}`);
    console.log(`  [DEBUG] Project root: ${this.options.projectRoot}`);
    console.log(`  [DEBUG] Prompt length: ${prompt.length}`);

    // Track initial git state
    const gitInstance = git.simpleGit(this.options.projectRoot);
    let initialStatus: Awaited<ReturnType<typeof gitInstance.status>> | null = null;
    try {
      initialStatus = await gitInstance.status();
    } catch (error: any) {
      console.warn(`  [WARN] Failed to get initial git status for task ${task.id}: ${error.message}`);
      // Continue without git tracking - task can still succeed
    }

    // Setup logs directory
    const logsDir = path.join(this.options.projectRoot, '.ralph', 'logs');
    await fs.mkdir(logsDir, { recursive: true });

    // Create log file for this task
    const logFileName = `session-${this.session.sessionId}-${task.id}.log`;
    const logFilePath = path.join(logsDir, logFileName);
    const logStream = createWriteStream(logFilePath, { flags: 'w' });

    // Build CLI arguments - similar to claudeception approach
    const args: string[] = [
      '--output-format', 'stream-json',  // NDJSON streaming output
      '--print',                          // Headless/non-interactive mode
      '--verbose',                        // Detailed output
      '--dangerously-skip-permissions',   // Bypass permission prompts for autonomous execution
    ];

    // Optionally specify model if configured
    if (this.options.model) {
      args.push('--model', this.options.model);
    }

    // Add system prompt to reinforce autonomous behavior
    const systemPromptAppend = `
When given a task to implement, you MUST actively write, modify, or delete code files to complete the implementation.
Do not just describe what should be done - actually make the code changes using available tools.
This is an autonomous execution - there is no human to ask clarifying questions.
Make reasonable assumptions and proceed with implementation.`;

    args.push('--append-system-prompt', systemPromptAppend);

    console.log(`  [DEBUG] Executing claude CLI with args: ${args.join(' ')}`);

    // Execute Claude CLI as subprocess
    let sessionId: string | undefined;
    let finalResult: any = null;
    const streamBuffer: string[] = [];
    let costUsd: number | undefined;
    let totalTurns: number | undefined;

    // Get claude command - default to "claude"
    const claudeCommand = process.env.CLAUDE_COMMAND || 'claude';
    const [command, ...commandArgs] = claudeCommand.split(' ');
    const allArgs = [...commandArgs, ...args];

    const executable = execa(command, allArgs, {
      input: prompt,
      cwd: this.options.projectRoot,
      timeout: 30 * 60 * 1000, // 30 minute timeout
      env: {
        ...process.env,
        // Enable bash working directory persistence
        CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR: 'true',
      },
    });

    // Track stats for real-time updates
    let messageIndex = 0;
    let toolCallCount = 0;
    let toolResultCount = 0;
    let errorCount = 0;

    // Handle streaming output line by line
    executable.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        streamBuffer.push(line);

        try {
          const parsed = JSON.parse(line);

          // Capture session ID from various possible locations
          if (!sessionId) {
            if (parsed.session_id) {
              sessionId = parsed.session_id;
              console.log(`  [DEBUG] Captured session ID: ${sessionId}`);
            } else if (parsed.type === 'system' && parsed.system?.session_id) {
              sessionId = parsed.system.session_id;
              console.log(`  [DEBUG] Captured session ID from system message: ${sessionId}`);
            }
          }

          // Add timestamp if missing
          if (!parsed.timestamp) {
            parsed.timestamp = new Date().toISOString();
          }

          // Write to log file
          logStream.write(JSON.stringify(parsed) + '\n');

          // Parse and emit real-time log event
          const entry = parseStreamJsonLine(line, this.session.sessionId, task.id, messageIndex++);
          if (entry) {
            // Track stats
            if (entry.messageType === 'tool_use') toolCallCount++;
            if (entry.messageType === 'tool_result') toolResultCount++;
            if (entry.isError) errorCount++;

            // Emit log event for real-time streaming
            logEvents.emitLog({
              sessionId: this.session.sessionId,
              taskId: task.id,
              timestamp: entry.timestamp,
              entry,
            });
          }

          // Log message types for debugging
          if (parsed.type === 'system' && parsed.subtype === 'init') {
            console.log(`  [DEBUG] CLI initialized - model: ${parsed.model || 'unknown'}`);
          }

          // Capture the final result
          if (parsed.type === 'result') {
            finalResult = parsed;
            costUsd = parsed.total_cost_usd;
            totalTurns = parsed.num_turns;
            console.log(`  [DEBUG] Got result - subtype: ${parsed.subtype}, cost: $${costUsd?.toFixed(4) || 'unknown'}, turns: ${totalTurns || 'unknown'}`);

            // Emit final stats
            logEvents.emitStats({
              sessionId: this.session.sessionId,
              taskId: task.id,
              stats: {
                totalEntries: messageIndex,
                toolCalls: toolCallCount,
                toolResults: toolResultCount,
                errors: errorCount,
                cost: costUsd,
                turns: totalTurns,
              },
            });
          }
        } catch (parseErr) {
          // Non-JSON lines - still write to log and emit
          logStream.write(line + '\n');

          const entry = parseStreamJsonLine(line, this.session.sessionId, task.id, messageIndex++);
          if (entry) {
            logEvents.emitLog({
              sessionId: this.session.sessionId,
              taskId: task.id,
              timestamp: entry.timestamp,
              entry,
            });
          }
        }
      }
    });

    // Handle stderr
    executable.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        console.error(`  [STDERR] ${text}`);
        // Also log to file
        logStream.write(JSON.stringify({
          timestamp: new Date().toISOString(),
          type: 'log',
          content: `[STDERR] ${text}`,
        }) + '\n');
      }
    });

    try {
      // Wait for execution to complete
      await executable;
    } catch (error: any) {
      // Close log stream
      logStream.end();

      // Check if we still got a result despite the error
      if (finalResult && finalResult.subtype === 'success') {
        console.log(`  [DEBUG] Process exited with error but got success result`);
      } else {
        const errorMsg = error.message || String(error);
        throw new Error(`Claude CLI execution failed for task ${task.id}: ${errorMsg}`);
      }
    }

    // Close log stream
    logStream.end();

    console.log(`  [DEBUG] Execution complete. Log file: ${logFilePath}`);

    // Process final result
    if (!finalResult) {
      throw new Error(`No result received from Claude CLI for task ${task.id}`);
    }

    let finalResultText = '';
    if (finalResult.subtype === 'success') {
      finalResultText = finalResult.result || '';
    } else if (finalResult.subtype === 'error_during_execution') {
      const errors = finalResult.errors || [];
      throw new Error(`Task execution failed: ${errors.join(', ')}`);
    } else {
      throw new Error(`Task ended with ${finalResult.subtype}`);
    }

    // Get final git state to determine what changed
    let finalStatus: Awaited<ReturnType<typeof gitInstance.status>> | null = null;
    try {
      finalStatus = await gitInstance.status();
    } catch (error: any) {
      console.warn(`  [WARN] Failed to get final git status for task ${task.id}: ${error.message}`);
      // Continue - task result won't include file change details
    }

    // Calculate file changes
    const filesAdded: string[] = [];
    const filesModified: string[] = [];
    const filesDeleted: string[] = [];

    if (finalStatus) {
      // Files that are now staged but weren't before
      for (const file of finalStatus.files) {
        const wasTracked = initialStatus?.files.some(f => f.path === file.path) ?? false;

        if (!wasTracked && (file.index === 'A' || file.index === '?')) {
          filesAdded.push(file.path);
        } else if (file.index === 'D') {
          filesDeleted.push(file.path);
        } else if (file.index === 'M' || file.working_dir === 'M') {
          filesModified.push(file.path);
        }
      }
    }

    // Verify acceptance criteria
    const verification = await verifyAcceptanceCriteria(task, this.options.projectRoot);

    const result: TaskResult = {
      filesChanged: filesAdded.length + filesModified.length + filesDeleted.length,
      filesAdded,
      filesModified,
      filesDeleted,
      acceptanceCriteriaPassed: verification.passed,
      acceptanceCriteriaFailed: verification.failed,
      output: finalResultText || `Executed task ${task.id}`,
      sessionId,
      costUsd,
      totalTurns,
    };

    return result;
  }

  /**
   * Commit task changes to git
   */
  private async commitTask(task: RalphTask, result: TaskResult): Promise<void> {
    const git = await import('simple-git');
    const gitInstance = git.simpleGit(this.options.projectRoot);

    const commitMessage = this.buildCommitMessage(task, result);

    // Stage all changes - handle errors gracefully
    // Filter out .ralph/ files - they should never be committed
    const filesToStage = [
      ...result.filesAdded,
      ...result.filesModified,
      ...result.filesDeleted.map(f => `:${f}`), // : prefix removes files
    ]
      .filter(Boolean)
      .filter(file => !file.startsWith('.ralph/') && !file.startsWith(':.ralph/'));

    if (filesToStage.length === 0) {
      console.warn(`  [WARN] No files to stage for task ${task.id}, skipping commit`);
      return;
    }

    try {
      await gitInstance.add(filesToStage);
    } catch (error: any) {
      // Log error but don't fail the task
      console.warn(`  [WARN] Failed to stage files for task ${task.id}: ${error.message}`);
      // Continue anyway - changes might already be staged
    }

    // Commit with the formatted message
    try {
      await gitInstance.commit(commitMessage);
    } catch (error: any) {
      // Check if it's an "empty commit" type error
      const errorMsg = error.message || String(error);
      if (errorMsg.includes('nothing to commit') || errorMsg.includes('no changes added')) {
        console.warn(`  [WARN] No changes to commit for task ${task.id}`);
        return;
      }
      // For other errors, log but don't fail the task
      console.warn(`  [WARN] Failed to commit for task ${task.id}: ${errorMsg}`);
      return;
    }

    // Get the commit hash
    try {
      const log = await gitInstance.log({ maxCount: 1 });
      if (log.latest) {
        result.commitHash = log.latest.hash;
      }
    } catch (error: any) {
      // Non-fatal - just warn
      console.warn(`  [WARN] Failed to get commit hash for task ${task.id}: ${error.message}`);
    }
  }

  /**
   * Build a commit message for a task
   */
  private buildCommitMessage(task: RalphTask, result: TaskResult): string {
    let message = `[${task.id}] ${task.title}\n\n`;
    message += `${task.description}\n\n`;
    message += `Summary: Changed ${result.filesChanged} file(s):\n`;

    for (const file of result.filesAdded) {
      message += `  + ${file}\n`;
    }
    for (const file of result.filesModified) {
      message += `  ~ ${file}\n`;
    }
    for (const file of result.filesDeleted) {
      message += `  - ${file}\n`;
    }

    return message;
  }

  /**
   * Update plan file with completed acceptance criteria and task status
   */
  private async updatePlanFile(task: RalphTask, result: TaskResult): Promise<void> {
    try {
      // Read the current plan
      const planContent = await fs.readFile(this.options.planPath!, 'utf-8');
      const plan = planFromMarkdown(planContent);

      // Find the task in the plan
      const taskIndex = plan.tasks.findIndex(t => t.id === task.id);
      if (taskIndex === -1) {
        console.warn(`  [WARN] Task ${task.id} not found in plan file, skipping update`);
        return;
      }

      // Update the task's acceptance criteria based on passed criteria
      const updatedTask = { ...plan.tasks[taskIndex] };
      updatedTask.acceptanceCriteria = task.acceptanceCriteria.map(criterion => ({
        text: criterion.text,
        completed: result.acceptanceCriteriaPassed.includes(criterion.text)
      }));

      // Update task status based on acceptance criteria results
      if (result.acceptanceCriteriaFailed.length === 0) {
        // All criteria passed - mark as Implemented
        updatedTask.status = 'Implemented';
      } else if (result.acceptanceCriteriaPassed.length > 0) {
        // Some criteria passed but not all - mark as Needs Re-Work
        updatedTask.status = 'Needs Re-Work';
      }
      // If no criteria passed, leave status as-is (typically "To Do")

      // Replace the task in the plan
      plan.tasks[taskIndex] = updatedTask;

      // Write the updated plan back to the file
      const updatedPlanContent = planToMarkdown(plan);
      await fs.writeFile(this.options.planPath!, updatedPlanContent, 'utf-8');

      console.log(`  [INFO] Updated plan file: marked task ${task.id} as ${updatedTask.status} with ${result.acceptanceCriteriaPassed.length}/${task.acceptanceCriteria.length} acceptance criteria completed`);
    } catch (error: any) {
      console.error(`  [ERROR] Failed to update plan file for task ${task.id}: ${error.message}`);
      // Don't fail the task - plan file update is non-critical
    }
  }

  /**
   * Run tests after task completion
   */
  private async runTests(task: RalphTask): Promise<void> {
    const { spawn } = await import('child_process');

    console.log(`Running tests for ${task.id}...`);

    const testCommand = this.options.testCommand || 'npm run test:run';
    const [cmd, ...args] = testCommand.split(' ');

    return new Promise<void>((resolve, reject) => {
      const testProcess = spawn(cmd, args, {
        cwd: this.options.projectRoot,
        stdio: 'inherit',
      });

      testProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✓ Tests passed for ${task.id}`);
          resolve();
        } else {
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });

      testProcess.on('error', (err) => {
        reject(new Error(`Failed to run tests: ${err.message}`));
      });
    });
  }

  /**
   * Calculate execution progress
   */
  private calculateProgress(): number {
    if (this.plan.tasks.length === 0) return 0;
    return Math.round((this.session.completedTasks.size / this.plan.tasks.length) * 100);
  }

  /**
   * Main execution loop
   */
  public async run(): Promise<RalphExecutionSession> {
    console.log(`Starting Ralph execution session: ${this.session.sessionId}`);
    console.log(`Project root: ${this.options.projectRoot}`);
    console.log(`Plan: ${this.options.planPath}`);

    // Load the implementation plan
    await this.loadPlan();
    console.log(`Loaded plan with ${this.plan.totalTasks} tasks`);

    // Pre-populate completed tasks from plan file status if skipCompletedTasks is enabled
    if (this.options.skipCompletedTasks) {
      let skippedCount = 0;
      for (const task of this.plan.tasks) {
        if (task.status === 'Implemented' || task.status === 'Verified') {
          this.session.completedTasks.add(task.id);
          skippedCount++;
        }
      }
      if (skippedCount > 0) {
        console.log(`Skipping ${skippedCount} already completed tasks`);
      }
    }

    // Load previous session if resuming
    if (this.options.resume) {
      const sessions = await fs.readdir(this.options.stateDir!);
      const latestSession = sessions
        .filter(f => f.endsWith('.json'))
        .sort()
        .pop();

      if (latestSession) {
        const sessionId = latestSession.replace('.json', '');
        await this.loadSession(sessionId);
        console.log(`Resumed session: ${sessionId}`);
      }
    }

    // Save initial session state
    await this.saveSession();

    // Emit session started event
    this.emitPlanStatusEvent('session.started');

    // Main execution loop
    let task: RalphTask | null = this.getNextTask();
    console.log(`[DEBUG] Initial next task: ${task ? task.id : 'null'}`);


    while (task !== null) {
      const taskId = task.id; // Store ID for error handling
      console.log(`\n=== Executing ${task.id}: ${task.title} ===`);
      console.log(`Priority: ${task.priority}`);
      console.log(`Complexity: ${task.estimatedComplexity || 'N/A'}`);

      try {
        const result = await this.executeTask(task);

        console.log(`\n✓ ${task.id} completed successfully`);
        console.log(`  Files changed: ${result.filesChanged}`);
        console.log(`  Acceptance criteria passed: ${result.acceptanceCriteriaPassed.length}/${task.acceptanceCriteria.length}`);

        if (result.acceptanceCriteriaFailed.length > 0) {
          console.warn(`  Warning: ${result.acceptanceCriteriaFailed.length} criteria not verified`);
        }

      } catch (error) {
        console.error(`\n✗ ${taskId} failed: ${error}`);

        // Count total attempts for this task
        const totalAttempts = this.session.taskHistory.filter(h => h.taskId === taskId).length;
        const maxRetries = this.options.maxRetries || 3;

        if (totalAttempts >= maxRetries) {
          console.error(`  Max retries (${maxRetries}) reached for ${taskId}, marking as failed and continuing`);
          // Add to failedTasks to prevent infinite retry loop
          this.session.failedTasks.add(taskId);
          // Add to completedTasks so getNextTask will skip this task
          this.session.completedTasks.add(taskId);
        } else {
          console.error(`  Attempt ${totalAttempts}/${maxRetries} for ${taskId}, will retry...`);
        }
      }

      // Update progress
      const progress = this.calculateProgress();
      console.log(`\nProgress: ${progress}% (${this.session.completedTasks.size}/${this.plan.totalTasks} tasks completed)`);

      if (this.options.hooks?.onProgress) {
        await this.options.hooks.onProgress(progress, this.session);
      }

      // Save checkpoint
      await this.saveSession();
      if (this.options.hooks?.onCheckpoint) {
        await this.options.hooks.onCheckpoint(this.session);
      }

      // Get next task
      task = this.getNextTask();
      console.log(`[DEBUG] Next task in loop: ${task ? task.id : 'null'}`);

    }

    // Execution complete
    console.log(`\n=== Execution Complete ===`);
    console.log(`Session: ${this.session.sessionId}`);
    console.log(`Tasks completed: ${this.session.completedTasks.size}/${this.plan.totalTasks}`);

    // Emit session completed event
    this.emitPlanStatusEvent('session.completed');

    if (this.session.failedTasks.size > 0) {
      console.log(`Tasks failed: ${this.session.failedTasks.size}`);
      for (const taskId of this.session.failedTasks) {
        console.log(`  - ${taskId}`);
      }
    }

    return this.session;
  }

  /**
   * Get the current session state
   */
  public getSession(): RalphExecutionSession {
    return { ...this.session };
  }

  /**
   * Get task history
   */
  public getTaskHistory(): TaskExecution[] {
    return [...this.session.taskHistory];
  }
}

/**
 * Main entry point for running a Ralph execution
 */
export async function runRalphExecution(options: RalphExecutorOptions): Promise<RalphExecutionSession> {
  const executor = new RalphExecutor(options);
  return executor.run();
}

/**
 * Create a checkpoint of the current state
 */
export async function createCheckpoint(
  sessionId: string,
  stateDir: string = '.ralph/sessions'
): Promise<string> {
  const checkpointPath = path.join(stateDir, `checkpoint-${sessionId}-${Date.now()}.json`);
  // Implement checkpoint creation logic
  return checkpointPath;
}

/**
 * Verify acceptance criteria for a task
 */
export async function verifyAcceptanceCriteria(
  task: RalphTask,
  projectRoot: string
): Promise<{
  passed: string[];
  failed: string[];
}> {
  const passed: string[] = [];
  const failed: string[] = [];

  // Each criterion should be automatically verified
  // This would involve:
  // - Checking file existence
  // - Running tests
  // - Checking code patterns
  // - Executing commands

  for (const criterion of task.acceptanceCriteria) {
    // Placeholder verification logic
    // In practice, this would parse the criterion and verify accordingly
    const isVerified = await verifyCriterion(criterion.text, projectRoot);

    if (isVerified) {
      passed.push(criterion.text);
    } else {
      failed.push(criterion.text);
    }
  }

  return { passed, failed };
}

/**
 * Verify a single acceptance criterion using Claude CLI
 * Uses the same CLI subprocess approach as task execution for consistency.
 */
async function verifyCriterion(criterion: string, projectRoot: string): Promise<boolean> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const { spawn } = await import('child_process');

  const trimmed = criterion.trim();

  // Fast-path checks for common patterns (avoid SDK overhead)

  // Pattern 1: "X exists" or "X file exists" -> check file/path existence
  const existsMatch = trimmed.match(/^(.+?)(?:\s+file)?\s+exists$/i);
  if (existsMatch) {
    const filePath = path.join(projectRoot, existsMatch[1].trim());
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Pattern 2: "npm run X passes" or "X command passes" -> run command
  const commandMatch = trimmed.match(/^(npm run \S+|[\w\-]+)\s+passes$/i);
  if (commandMatch) {
    return new Promise<boolean>((resolve) => {
      const [cmd, ...args] = commandMatch[1].split(' ');
      const testProcess = spawn(cmd, args, {
        cwd: projectRoot,
        stdio: 'pipe',
      });

      testProcess.on('close', (code) => {
        resolve(code === 0);
      });

      testProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  // Pattern 3: "X includes Y" -> check file contains content
  const includesMatch = trimmed.match(/^(.+?)\s+includes\s+(.+)$/i);
  if (includesMatch) {
    const filePath = path.join(projectRoot, includesMatch[1].trim());
    const searchContent = includesMatch[2].trim().replace(/^["']|["']$/g, '');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.includes(searchContent);
    } catch {
      return false;
    }
  }

  // Pattern 4: Single word - treat as file path
  if (!trimmed.includes(' ') && trimmed.length > 0) {
    const filePath = path.join(projectRoot, trimmed);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // For all other patterns, use Claude CLI for semantic verification (same approach as task execution)
  try {
    const { execa } = await import('execa');

    const prompt = `# Acceptance Criterion Verification

You are verifying whether the following acceptance criterion has been satisfied in the codebase.

**Criterion to verify:**
${criterion}

**Instructions:**
1. Explore the codebase to understand what has been implemented
2. Determine if the criterion has been satisfied
3. Return ONLY "true" if satisfied, or "false" if not satisfied

**Important:**
- Be thorough - check files, run tests if needed, examine the actual implementation
- If the criterion mentions something "exists", "is created", "is implemented", etc., verify it actually exists
- If the criterion mentions functionality, verify the code implements it
- Return your answer as a single word: either "true" or "false" (lowercase, no punctuation)`;

    // Build CLI arguments - same approach as executeWithClaude
    const args: string[] = [
      '--output-format', 'stream-json',
      '--print',
      '--verbose',
      '--dangerously-skip-permissions',
      '--max-turns', '100',
      '--model', 'haiku',
    ];

    const systemPromptAppend = `
When verifying acceptance criteria, be thorough and precise.
Return ONLY "true" or "false" as your final answer - nothing else.`;

    args.push('--append-system-prompt', systemPromptAppend);

    // Get claude command - default to "claude"
    const claudeCommand = process.env.CLAUDE_COMMAND || 'claude';
    const [command, ...commandArgs] = claudeCommand.split(' ');
    const allArgs = [...commandArgs, ...args];

    let finalResult: any = null;

    const executable = execa(command, allArgs, {
      input: prompt,
      cwd: projectRoot,
      timeout: 5 * 60 * 1000, // 5 minute timeout for verification
      env: {
        ...process.env,
        CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR: 'true',
      },
    });

    // Handle streaming output to capture the result
    executable.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'result') {
            finalResult = parsed;
          }
        } catch {
          // Non-JSON lines, ignore
        }
      }
    });

    try {
      await executable;
    } catch (error: any) {
      // Check if we still got a result despite the error
      if (!finalResult || finalResult.subtype !== 'success') {
        console.warn(`  [WARNING] CLI verification failed for criterion: "${criterion}"`);
        console.warn(`  [WARNING] Error: ${error.message || String(error)}`);
        return false;
      }
    }

    if (!finalResult) {
      console.warn(`  [WARNING] No result received for criterion: "${criterion}"`);
      return false;
    }

    if (finalResult.subtype !== 'success') {
      console.warn(`  [WARNING] Verification ended with ${finalResult.subtype} for criterion: "${criterion}"`);
      return false;
    }

    // Parse the response - look for true/false
    const response = finalResult.result || '';
    const normalized = response.toLowerCase().trim();
    return normalized === 'true' || normalized.startsWith('true') || normalized.includes('\ntrue');
  } catch (error) {
    console.warn(`  [WARNING] Verification failed for criterion: "${criterion}"`);
    console.warn(`  [WARNING] Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Server API client for interacting with Ralph Executor Server
 */
export class RalphExecutorClient {
  private baseUrl: string;
  private projectRoot: string;

  constructor(options: ServerClientOptions) {
    this.baseUrl = `http://${options.host || 'localhost'}:${options.port || 3001}`;
    this.projectRoot = options.projectRoot;
  }

  /**
   * Check if the server is running
   */
  async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available plans
   */
  async listPlans(): Promise<Array<{
    id: string;
    path: string;
    title: string;
    totalTasks: number;
  }>> {
    const response = await fetch(`${this.baseUrl}/plans`);
    if (!response.ok) {
      throw new Error(`Failed to list plans: ${response.statusText}`);
    }
    const data = await response.json() as { plans: Array<{
      id: string;
      path: string;
      title: string;
      totalTasks: number;
    }> };
    return data.plans;
  }

  /**
   * Get plan details
   */
  async getPlan(planId: string): Promise<{ plan: RalphPlan }> {
    const response = await fetch(`${this.baseUrl}/plans/${encodeURIComponent(planId)}`);
    if (!response.ok) {
      throw new Error(`Failed to get plan: ${response.statusText}`);
    }
    return response.json() as Promise<{ plan: RalphPlan }>;
  }

  /**
   * Start execution of a plan
   */
  async execute(options: Omit<ServerClientOptions, 'host' | 'port' | 'projectRoot'>): Promise<{
    sessionId: string;
    status: string;
    plan: {
      title: string;
      totalTasks: number;
    };
    message: string;
  }> {
    const body = {
      plan: options.planPath,
      directory: this.projectRoot,
      noCommit: options.noCommit,
      autoTest: options.autoTest,
      dryRun: options.dryRun,
      maxRetries: options.maxRetries,
      maxParallel: options.maxParallel,
    };

    const response = await fetch(`${this.baseUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json() as { message?: string };
      throw new Error(`Failed to start execution: ${error.message || response.statusText}`);
    }

    return response.json() as Promise<{
      sessionId: string;
      status: string;
      plan: {
        title: string;
        totalTasks: number;
      };
      message: string;
    }>;
  }

  /**
   * Get execution status
   */
  async getStatus(sessionId: string): Promise<{
    sessionId: string;
    status: 'running' | 'completed' | 'failed';
    message?: string;
    result?: ExecutionResult;
    error?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/status/${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`);
    }
    return response.json() as Promise<{
      sessionId: string;
      status: 'running' | 'completed' | 'failed';
      message?: string;
      result?: ExecutionResult;
      error?: string;
    }>;
  }

  /**
   * List active sessions
   */
  async listSessions(): Promise<{
    sessions: Array<{
      sessionId: string;
      status: string;
      error?: string;
    }>;
  }> {
    const response = await fetch(`${this.baseUrl}/sessions`);
    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.statusText}`);
    }
    return response.json() as Promise<{
      sessions: Array<{
        sessionId: string;
        status: string;
        error?: string;
      }>;
    }>;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.statusText}`);
    }
  }
}

/**
 * Execute a plan via the Ralph Executor Server
 * This function is the main entry point when the skill is invoked via /ralph-executor
 */
export async function executeViaServer(
  options: ServerClientOptions & { wait?: boolean; pollInterval?: number }
): Promise<void> {
  const {
    host = 'localhost',
    port = 3001,
    projectRoot,
    planPath,
    wait = true,
    pollInterval = 5000,
    ...executionOptions
  } = options;

  const client = new RalphExecutorClient({ host, port, projectRoot, planPath, ...executionOptions });

  // Check if server is running
  const isHealthy = await client.checkServerHealth();

  if (!isHealthy) {
    // Server not running - provide instructions to user
    console.error('\n❌ Ralph Executor Server is not running.\n');
    console.error('Please start the server in a separate terminal:\n');
    console.error('Option 1 - Using the ralph CLI:');
    console.error(`  ralph server --port ${port}\n`);
    console.error('Option 2 - Using the npm script:');
    console.error(`  npm run server -- --port ${port}\n`);
    console.error('Then try again.\n');
    throw new Error('Ralph Executor Server is not running');
  }

  console.log(`\n✓ Ralph Executor Server is running at http://${host}:${port}\n`);

  // Determine plan path
  let actualPlanPath = planPath;
  if (!actualPlanPath) {
    // Try to find a plan in the project
    const plans = await client.listPlans();
    if (plans.length === 0) {
      throw new Error('No implementation plans found in the project');
    }
    if (plans.length > 1) {
      console.log('Available plans:');
      for (const plan of plans) {
        console.log(`  - ${plan.id}: ${plan.title} (${plan.totalTasks} tasks)`);
      }
      console.log('\nPlease specify a plan using the planPath option.');
      throw new Error('Multiple plans found, please specify one');
    }
    actualPlanPath = plans[0].path;
    console.log(`Using plan: ${plans[0].title} (${plans[0].totalTasks} tasks)\n`);
  }

  // Start execution
  console.log('Starting execution...');
  const result = await client.execute({
    planPath: actualPlanPath,
    ...executionOptions,
  });

  console.log(`\n✓ Execution started`);
  console.log(`  Session ID: ${result.sessionId}`);
  console.log(`  Plan: ${result.plan.title} (${result.plan.totalTasks} tasks)`);
  console.log(`  ${result.message}\n`);

  // If not waiting, return immediately
  if (!wait) {
    console.log(`You can check status with:`);
    console.log(`  curl http://${host}:${port}/status/${result.sessionId}\n`);
    return;
  }

  // Poll for status
  console.log('Monitoring progress...');

  while (true) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const status = await client.getStatus(result.sessionId);

    if (status.status === 'completed') {
      console.log(`\n✓ Execution completed successfully!\n`);
      if (status.result) {
        console.log(`  Duration: ${Math.round(status.result.duration / 1000)}s`);
        console.log(`  Tasks completed: ${status.result.completedTasks.length}/${status.result.totalTasks}`);
        if (status.result.failedTasks.length > 0) {
          console.log(`  Tasks failed: ${status.result.failedTasks.length}`);
          for (const taskId of status.result.failedTasks) {
            console.log(`    - ${taskId}`);
          }
        }
      }
      console.log();
      return;
    }

    if (status.status === 'failed') {
      console.log(`\n❌ Execution failed: ${status.error}\n`);
      throw new Error(`Execution failed: ${status.error}`);
    }

    // Still running
    process.stdout.write('.');
  }
}

/**
 * Get the current server status
 */
export async function getServerStatus(options: { host?: string; port?: number } = {}): Promise<{
  isRunning: boolean;
  activeSessions?: number;
  projectRoot?: string;
}> {
  const { host = 'localhost', port = 3001 } = options;
  const client = new RalphExecutorClient({ host, port, projectRoot: '' });

  const isRunning = await client.checkServerHealth();

  if (!isRunning) {
    return { isRunning: false };
  }

  // Get health endpoint
  const response = await fetch(`http://${host}:${port}/health`);
  if (response.ok) {
    const health = await response.json() as { activeSessions?: number; projectRoot?: string };
    return {
      isRunning: true,
      activeSessions: health.activeSessions,
      projectRoot: health.projectRoot,
    };
  }

  return { isRunning: true };
}
