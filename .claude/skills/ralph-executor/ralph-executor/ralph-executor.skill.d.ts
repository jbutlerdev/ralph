/**
 * Ralph Executor Skill
 *
 * This skill orchestrates the autonomous execution of a Ralph Wiggum implementation plan.
 * It uses the Claude Code SDK to run independent sessions for each task, managing
 * dependencies, checkpoints, and state persistence.
 */
import type { RalphTask, RalphPlan } from '../ralph-plan-generator/ralph-plan-generator.skill.js';
export type { RalphTask, RalphPlan };
/**
 * Execution state for a single task
 */
export interface TaskExecution {
    taskId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    result?: TaskResult;
    error?: string;
    attempts: number;
}
/**
 * Result of a task execution
 */
export interface TaskResult {
    filesChanged: number;
    filesAdded: string[];
    filesModified: string[];
    filesDeleted: string[];
    acceptanceCriteriaPassed: string[];
    acceptanceCriteriaFailed: string[];
    output: string;
    commitHash?: string;
}
/**
 * Execution session state
 */
export interface RalphExecutionSession {
    sessionId: string;
    planPath: string;
    completedTasks: Set<string>;
    skippedTasks: Set<string>;
    failedTasks: Set<string>;
    currentTaskId: string | null;
    taskHistory: TaskExecution[];
    startedAt: string;
    lastActivity: string;
    totalTokens?: number;
    totalCost?: number;
    checkpointPath?: string;
    metadata?: Record<string, any>;
}
/**
 * Options for the Ralph executor
 */
export interface RalphExecutorOptions {
    /**
     * Root directory of the project
     */
    projectRoot: string;
    /**
     * Path to the implementation plan
     */
    planPath?: string;
    /**
     * Maximum number of retry attempts for failed tasks
     */
    maxRetries?: number;
    /**
     * Maximum number of parallel tasks (default: 1 for sequential)
     */
    maxParallelTasks?: number;
    /**
     * Whether to create git commits after each task
     */
    autoCommit?: boolean;
    /**
     * Whether to run tests after each task
     */
    autoTest?: boolean;
    /**
     * Test command to run
     */
    testCommand?: string;
    /**
     * Directory for storing execution state
     */
    stateDir?: string;
    /**
     * Whether to resume from a previous session
     */
    resume?: boolean;
    /**
     * Claude Code SDK options
     */
    claudeOptions?: {
        apiKey?: string;
        model?: string;
        maxTokens?: number;
        temperature?: number;
    };
    /**
     * Hooks for lifecycle events
     */
    hooks?: {
        onTaskStart?: (task: RalphTask, session: RalphExecutionSession) => Promise<void>;
        onTaskComplete?: (task: RalphTask, result: TaskResult, session: RalphExecutionSession) => Promise<void>;
        onTaskFail?: (task: RalphTask, error: Error, session: RalphExecutionSession) => Promise<void>;
        onCheckpoint?: (session: RalphExecutionSession) => Promise<void>;
        onProgress?: (progress: number, session: RalphExecutionSession) => Promise<void>;
    };
}
/**
 * The Ralph Executor - orchestrates autonomous execution of implementation plans
 */
export declare class RalphExecutor {
    private options;
    private session;
    private plan;
    constructor(options: RalphExecutorOptions);
    /**
     * Create a new execution session
     */
    private createSession;
    /**
     * Load the implementation plan
     */
    private loadPlan;
    /**
     * Save session state to disk
     */
    private saveSession;
    /**
     * Load a previous session state
     */
    private loadSession;
    /**
     * Get the next task to execute
     */
    private getNextTask;
    /**
     * Execute a single task using Claude Code SDK
     */
    private executeTask;
    /**
     * Build the prompt for a task execution
     */
    private buildTaskPrompt;
    /**
     * Execute a task using Claude Code SDK
     * Spawns a new claude CLI process with the task prompt
     */
    private executeWithClaude;
    /**
     * Commit task changes to git
     */
    private commitTask;
    /**
     * Build a commit message for a task
     */
    private buildCommitMessage;
    /**
     * Run tests after task completion
     */
    private runTests;
    /**
     * Calculate execution progress
     */
    private calculateProgress;
    /**
     * Main execution loop
     */
    run(): Promise<RalphExecutionSession>;
    /**
     * Get the current session state
     */
    getSession(): RalphExecutionSession;
    /**
     * Get task history
     */
    getTaskHistory(): TaskExecution[];
}
/**
 * Main entry point for running a Ralph execution
 */
export declare function runRalphExecution(options: RalphExecutorOptions): Promise<RalphExecutionSession>;
/**
 * Create a checkpoint of the current state
 */
export declare function createCheckpoint(sessionId: string, stateDir?: string): Promise<string>;
/**
 * Verify acceptance criteria for a task
 */
export declare function verifyAcceptanceCriteria(task: RalphTask, projectRoot: string): Promise<{
    passed: string[];
    failed: string[];
}>;
//# sourceMappingURL=ralph-executor.skill.d.ts.map