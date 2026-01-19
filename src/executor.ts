/**
 * Ralph Executor Skill
 *
 * This skill orchestrates the autonomous execution of a Ralph Wiggum implementation plan.
 * It uses the Claude Code SDK to run independent sessions for each task, managing
 * dependencies, checkpoints, and state persistence.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
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
import { getNextTask, planFromMarkdown, validateRalphPlan } from './plan-generator.js';

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

    const startTime = Date.now();
    let result: TaskResult;

    try {
      // Build the task prompt
      const prompt = this.buildTaskPrompt(task);

      // Execute using Claude Code SDK
      result = await this.executeWithClaude(task, prompt);

      // Update execution state
      taskExecution.status = 'completed';
      taskExecution.completedAt = new Date().toISOString();
      taskExecution.duration = Date.now() - startTime;
      taskExecution.result = result;

      this.session.completedTasks.add(task.id);
      this.session.lastActivity = new Date().toISOString();

      // Call task complete hook
      if (this.options.hooks?.onTaskComplete) {
        await this.options.hooks.onTaskComplete(task, result, this.session);
      }

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

    prompt += `You are an autonomous AI assistant. You MUST IMPLEMENT the following task by writing, modifying, or deleting code files.\n\n`;
    prompt += `Do NOT just describe what should be done - you MUST actually make the code changes.\n\n`;

    prompt += `**Task ID:** ${task.id}\n`;
    prompt += `**Title:** ${task.title}\n`;
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
        prompt += `- [ ] ${criterion}\n`;
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

    prompt += `BEGIN IMPLEMENTATION NOW.\n`;

    return prompt;
  }

  /**
   * Execute a task using Claude Code SDK
   * Uses the SDK to run non-interactively with bypassed permissions
   */
  private async executeWithClaude(task: RalphTask, prompt: string): Promise<TaskResult> {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const git = await import('simple-git');

    console.log(`  [DEBUG] Starting SDK execution for ${task.id}`);
    console.log(`  [DEBUG] Project root: ${this.options.projectRoot}`);
    console.log(`  [DEBUG] Prompt length: ${prompt.length}`);

    // Track initial git state
    const gitInstance = git.simpleGit(this.options.projectRoot);
    const initialStatus = await gitInstance.status();

    // Use the SDK to run Claude Code non-interactively
    const sdkQuery = query({
      prompt,
      options: {
        cwd: this.options.projectRoot,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        // Don't persist sessions for autonomous tasks
        persistSession: false,
        // Load project settings to get CLAUDE.md context
        settingSources: ['project'],
        // Use the default tool preset
        tools: { type: 'preset', preset: 'claude_code' },
        // Explicitly use the Claude Code system prompt with our custom instructions
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: '\n\nWhen given a task to implement, you MUST actively write, modify, or delete code files to complete the implementation. Do not just describe what should be done - actually make the code changes using available tools.',
        },
        // Optional: limit to one turn for autonomous execution
        // maxTurns: 10,
      },
    });

    // Consume the async generator to wait for completion
    let finalResult: string = '';

    try {
      for await (const message of sdkQuery) {
        if (message.type === 'result') {
          if (message.subtype === 'success') {
            finalResult = message.result || '';
          } else if (message.subtype === 'error_during_execution') {
            throw new Error(`Task execution failed: ${message.errors.join(', ')}`);
          }
        }
      }
    } catch (error) {
      // Re-throw with more context
      throw new Error(`Claude SDK execution failed for task ${task.id}: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Get final git state to determine what changed
    const finalStatus = await gitInstance.status();

    // Calculate file changes
    const filesAdded: string[] = [];
    const filesModified: string[] = [];
    const filesDeleted: string[] = [];

    // Files that are now staged but weren't before
    for (const file of finalStatus.files) {
      const wasTracked = initialStatus.files.some(f => f.path === file.path);

      if (!wasTracked && file.index === 'added') {
        filesAdded.push(file.path);
      } else if (wasTracked && file.index !== 'deleted') {
        filesModified.push(file.path);
      } else if (file.index === 'deleted') {
        filesDeleted.push(file.path);
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
      output: finalResult || `Executed task ${task.id}`,
    };

    // Fail the task if acceptance criteria are required but not met
    if (this.options.requireAcceptanceCriteria && verification.failed.length > 0) {
      throw new Error(
        `Acceptance criteria not met:\n${verification.failed.map(f => `  - ${f}`).join('\n')}`
      );
    }

    return result;
  }

  /**
   * Commit task changes to git
   */
  private async commitTask(task: RalphTask, result: TaskResult): Promise<void> {
    const git = await import('simple-git');
    const gitInstance = git.simpleGit(this.options.projectRoot);

    const commitMessage = this.buildCommitMessage(task, result);

    // Stage all changes
    await gitInstance.add([
      ...result.filesAdded,
      ...result.filesModified,
      ...result.filesDeleted.map(f => `:${f}`), // : prefix removes files
    ].filter(Boolean));

    // Commit with the formatted message
    await gitInstance.commit(commitMessage);

    // Get the commit hash
    const log = await gitInstance.log({ maxCount: 1 });
    if (log.latest) {
      result.commitHash = log.latest.hash;
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

    // Main execution loop
    let task: RalphTask | null = this.getNextTask();

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
    }

    // Execution complete
    console.log(`\n=== Execution Complete ===`);
    console.log(`Session: ${this.session.sessionId}`);
    console.log(`Tasks completed: ${this.session.completedTasks.size}/${this.plan.totalTasks}`);

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
    const isVerified = await verifyCriterion(criterion, projectRoot);

    if (isVerified) {
      passed.push(criterion);
    } else {
      failed.push(criterion);
    }
  }

  return { passed, failed };
}

/**
 * Verify a single acceptance criterion using Claude Code SDK
 */
async function verifyCriterion(criterion: string, projectRoot: string): Promise<boolean> {
  const { query } = await import('@anthropic-ai/claude-agent-sdk');
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

  // For all other patterns, use Claude SDK for semantic verification
  try {
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

    const sdkQuery = query({
      prompt,
      options: {
        cwd: projectRoot,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        persistSession: false,
        settingSources: ['project'],
        tools: { type: 'preset', preset: 'claude_code' },
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: '\n\nWhen verifying acceptance criteria, be thorough and precise. Return ONLY "true" or "false" as your final answer.',
        },
        maxTurns: 20,
      },
    });

    let response = '';
    for await (const message of sdkQuery) {
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          response = message.result || '';
        } else if (message.subtype === 'error_during_execution') {
          console.warn(`  [WARNING] SDK error during verification: ${message.errors.join(', ')}`);
          return false;
        }
      }
    }

    // Parse the response - look for true/false
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
