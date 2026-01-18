/**
 * Ralph Executor Skill
 *
 * This skill orchestrates the autonomous execution of a Ralph Wiggum implementation plan.
 * It uses the Claude Code SDK to run independent sessions for each task, managing
 * dependencies, checkpoints, and state persistence.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * The Ralph Executor - orchestrates autonomous execution of implementation plans
 */
export class RalphExecutor {
    options;
    session;
    plan; // RalphPlan from plan-generator
    constructor(options) {
        this.options = {
            maxRetries: 3,
            maxParallelTasks: 1,
            autoCommit: true,
            autoTest: false,
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
    createSession() {
        const sessionId = this.options.resume
            ? `resume-${Date.now()}`
            : `session-${Date.now()}`;
        return {
            sessionId,
            planPath: this.options.planPath,
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
    async loadPlan() {
        const planContent = await fs.readFile(this.options.planPath, 'utf-8');
        // Import the plan-generator utilities
        const { planFromMarkdown } = await import('../ralph-plan-generator/ralph-plan-generator.skill.js');
        this.plan = planFromMarkdown(planContent);
        // Validate the plan
        const { validateRalphPlan } = await import('../ralph-plan-generator/ralph-plan-generator.skill.js');
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
    async saveSession() {
        const stateDir = this.options.stateDir;
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
    async loadSession(sessionId) {
        const sessionPath = path.join(this.options.stateDir, `${sessionId}.json`);
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
    getNextTask() {
        const { getNextTask } = require('../ralph-plan-generator/ralph-plan-generator.skill.js');
        return getNextTask(this.plan, this.session.completedTasks);
    }
    /**
     * Execute a single task using Claude Code SDK
     */
    async executeTask(task) {
        const taskExecution = {
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
        let result;
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
        }
        catch (error) {
            taskExecution.status = 'failed';
            taskExecution.completedAt = new Date().toISOString();
            taskExecution.duration = Date.now() - startTime;
            taskExecution.error = error instanceof Error ? error.message : String(error);
            this.session.failedTasks.add(task.id);
            this.session.lastActivity = new Date().toISOString();
            // Call task fail hook
            if (this.options.hooks?.onTaskFail) {
                await this.options.hooks.onTaskFail(task, error, this.session);
            }
            throw error;
        }
        await this.saveSession();
        return result;
    }
    /**
     * Build the prompt for a task execution
     */
    buildTaskPrompt(task) {
        let prompt = `# Task Execution\n\n`;
        prompt += `**Task ID:** ${task.id}\n`;
        prompt += `**Title:** ${task.title}\n`;
        prompt += `**Priority:** ${task.priority}\n\n`;
        if (task.dependencies.length > 0) {
            prompt += `**Dependencies:** ${task.dependencies.join(', ')}\n\n`;
        }
        prompt += `## Description\n\n${task.description}\n\n`;
        if (task.acceptanceCriteria.length > 0) {
            prompt += `## Acceptance Criteria\n\n`;
            for (const criterion of task.acceptanceCriteria) {
                prompt += `- [ ] ${criterion}\n`;
            }
            prompt += `\n`;
        }
        if (task.specReference) {
            prompt += `## Specification\n\nRefer to: ${task.specReference}\n\n`;
        }
        prompt += `## Instructions\n\n`;
        prompt += `1. Read the current state of the codebase\n`;
        prompt += `2. Implement the task according to the description\n`;
        prompt += `3. Verify all acceptance criteria are met\n`;
        prompt += `4. Make only the changes necessary to complete this task\n`;
        prompt += `5. After completion, provide a summary of changes\n\n`;
        return prompt;
    }
    /**
     * Execute a task using Claude Code SDK
     * Spawns a new claude CLI process with the task prompt
     */
    async executeWithClaude(task, prompt) {
        const { spawn } = await import('child_process');
        const fs = await import('fs/promises');
        const path = await import('path');
        // Create a temporary file with the prompt
        const promptDir = path.join(this.options.projectRoot, '.ralph', 'prompts');
        await fs.mkdir(promptDir, { recursive: true });
        const promptFile = path.join(promptDir, `${task.id}.md`);
        await fs.writeFile(promptFile, prompt, 'utf-8');
        // Track initial git state
        const git = await import('simple-git');
        const gitInstance = git.simpleGit(this.options.projectRoot);
        const initialStatus = await gitInstance.status();
        // Spawn claude process with the prompt
        const claude = spawn('claude', [promptFile], {
            cwd: this.options.projectRoot,
            stdio: 'inherit',
            env: {
                ...process.env,
                CLAUDE_TASK_ID: task.id,
                CLAUDE_PROJECT_ROOT: this.options.projectRoot,
            },
        });
        // Wait for claude to complete
        await new Promise((resolve, reject) => {
            claude.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Claude process exited with code ${code}`));
                }
            });
            claude.on('error', (err) => {
                reject(new Error(`Failed to spawn claude process: ${err.message}`));
            });
        });
        // Get final git state to determine what changed
        const finalStatus = await gitInstance.status();
        // Calculate file changes
        const filesAdded = [];
        const filesModified = [];
        const filesDeleted = [];
        // Files that are now staged but weren't before
        for (const file of finalStatus.files) {
            const wasTracked = initialStatus.files.some(f => f.path === file.path);
            if (!wasTracked && file.index === 'added') {
                filesAdded.push(file.path);
            }
            else if (wasTracked && file.index !== 'deleted') {
                filesModified.push(file.path);
            }
            else if (file.index === 'deleted') {
                filesDeleted.push(file.path);
            }
        }
        // Verify acceptance criteria
        const verification = await verifyAcceptanceCriteria(task, this.options.projectRoot);
        const result = {
            filesChanged: filesAdded.length + filesModified.length + filesDeleted.length,
            filesAdded,
            filesModified,
            filesDeleted,
            acceptanceCriteriaPassed: verification.passed,
            acceptanceCriteriaFailed: verification.failed,
            output: `Executed task ${task.id}`,
        };
        return result;
    }
    /**
     * Commit task changes to git
     */
    async commitTask(task, result) {
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
    buildCommitMessage(task, result) {
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
    async runTests(task) {
        const { spawn } = await import('child_process');
        console.log(`Running tests for ${task.id}...`);
        const testCommand = this.options.testCommand || 'npm run test:run';
        const [cmd, ...args] = testCommand.split(' ');
        return new Promise((resolve, reject) => {
            const testProcess = spawn(cmd, args, {
                cwd: this.options.projectRoot,
                stdio: 'inherit',
            });
            testProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`✓ Tests passed for ${task.id}`);
                    resolve();
                }
                else {
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
    calculateProgress() {
        if (this.plan.tasks.length === 0)
            return 0;
        return Math.round((this.session.completedTasks.size / this.plan.tasks.length) * 100);
    }
    /**
     * Main execution loop
     */
    async run() {
        console.log(`Starting Ralph execution session: ${this.session.sessionId}`);
        console.log(`Project root: ${this.options.projectRoot}`);
        console.log(`Plan: ${this.options.planPath}`);
        // Load the implementation plan
        await this.loadPlan();
        console.log(`Loaded plan with ${this.plan.totalTasks} tasks`);
        // Load previous session if resuming
        if (this.options.resume) {
            const sessions = await fs.readdir(this.options.stateDir);
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
        let task = this.getNextTask();
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
            }
            catch (error) {
                console.error(`\n✗ ${taskId} failed: ${error}`);
                // Retry logic could go here
                if ((this.session.taskHistory.find(h => h.taskId === taskId)?.attempts ?? 1) >= (this.options.maxRetries || 3)) {
                    console.error(`  Max retries reached for ${taskId}, continuing to next task`);
                }
                else {
                    console.error(`  Retrying ${taskId}...`);
                    // Implement retry logic
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
    getSession() {
        return { ...this.session };
    }
    /**
     * Get task history
     */
    getTaskHistory() {
        return [...this.session.taskHistory];
    }
}
/**
 * Main entry point for running a Ralph execution
 */
export async function runRalphExecution(options) {
    const executor = new RalphExecutor(options);
    return executor.run();
}
/**
 * Create a checkpoint of the current state
 */
export async function createCheckpoint(sessionId, stateDir = '.ralph/sessions') {
    const checkpointPath = path.join(stateDir, `checkpoint-${sessionId}-${Date.now()}.json`);
    // Implement checkpoint creation logic
    return checkpointPath;
}
/**
 * Verify acceptance criteria for a task
 */
export async function verifyAcceptanceCriteria(task, projectRoot) {
    const passed = [];
    const failed = [];
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
        }
        else {
            failed.push(criterion);
        }
    }
    return { passed, failed };
}
/**
 * Verify a single acceptance criterion
 */
async function verifyCriterion(criterion, projectRoot) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { spawn } = await import('child_process');
    const trimmed = criterion.trim();
    // Pattern 1: "X exists" or "X file exists" -> check file/path existence
    const existsMatch = trimmed.match(/^(.+?)(?:\s+file)?\s+exists$/i);
    if (existsMatch) {
        const filePath = path.join(projectRoot, existsMatch[1].trim());
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    // Pattern 2: "npm run X passes" or "X command passes" -> run command
    const commandMatch = trimmed.match(/^(npm run \S+|[\w\-]+)\s+passes$/i);
    if (commandMatch) {
        return new Promise((resolve) => {
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
    // Pattern 3: "X is defined" or "X function exists" -> check in codebase
    const definedMatch = trimmed.match(/^(.+?)\s+(?:function|class|variable|const|let|var)\s+(?:is\s+)?defined$/i);
    if (definedMatch) {
        const searchTerm = definedMatch[1].trim();
        // Search for the definition in ts/js files
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
            exec(`grep -r "${searchTerm}" ${projectRoot} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | head -1`, (error, stdout) => {
                resolve(!error && stdout.length > 0);
            });
        });
    }
    // Pattern 4: "X includes Y" -> check file contains content
    const includesMatch = trimmed.match(/^(.+?)\s+includes\s+(.+)$/i);
    if (includesMatch) {
        const filePath = path.join(projectRoot, includesMatch[1].trim());
        const searchContent = includesMatch[2].trim().replace(/^["']|["']$/g, '');
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return content.includes(searchContent);
        }
        catch {
            return false;
        }
    }
    // Pattern 5: Default - check if it's a file existence check
    if (!trimmed.includes(' ') && trimmed.length > 0) {
        // Single word, treat as file path
        const filePath = path.join(projectRoot, trimmed);
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    // Unknown pattern, can't verify
    return false;
}
//# sourceMappingURL=ralph-executor.skill.js.map