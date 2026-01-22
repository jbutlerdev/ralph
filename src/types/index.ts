/**
 * Ralph Type Definitions
 *
 * Shared types used across the Ralph project.
 */

/**
 * Valid status values for a task in the plan
 */
export type TaskStatus = 'To Do' | 'In Progress' | 'Implemented' | 'Needs Re-Work' | 'Verified';

/**
 * A single task in a Ralph implementation plan
 */
export interface RalphTask {
  id: string;                  // e.g., "task-001", "task-002"
  title: string;               // Human-readable task title
  description: string;         // Detailed description of what to implement
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];      // Array of task IDs that must complete first
  acceptanceCriteria: string[]; // Array of checkboxes for completion verification
  specReference?: string;      // Optional path to spec file
  estimatedComplexity?: 1 | 2 | 3 | 4 | 5; // 1=trivial, 5=complex
  tags?: string[];             // Optional tags for filtering/grouping
  status: TaskStatus;          // Current status of the task (default: "To Do")
}

/**
 * A complete Ralph implementation plan
 */
export interface RalphPlan {
  projectName: string;
  description: string;
  overview: string;
  tasks: RalphTask[];
  generatedAt: string;
  totalTasks: number;
  estimatedDuration?: string; // Rough estimate like "2-3 days"
}

/**
 * Execution state for a single task
 */
export interface TaskExecution {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number; // milliseconds
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
  /** Claude session ID captured from stream-json output */
  sessionId?: string;
  /** Total cost in USD from Claude API */
  costUsd?: number;
  /** Number of turns/iterations used */
  totalTurns?: number;
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
  metadata?: Record<string, unknown>;
}

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
   * Path to the Ralph MCP server executable
   */
  mcpServerPath?: string;

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
   * Whether to fail tasks when acceptance criteria are not verified
   */
  requireAcceptanceCriteria?: boolean;

  /**
   * Directory for storing execution state
   */
  stateDir?: string;

  /**
   * Whether to resume from a previous session
   */
  resume?: boolean;

  /**
   * Claude model to use (e.g., 'sonnet', 'opus', 'haiku')
   */
  model?: string;

  /**
   * Timeout in milliseconds for task execution (default: 30 minutes)
   */
  timeout?: number;

  /**
   * Claude Code SDK options (deprecated - use model instead)
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
 * A registered plan in the registry
 */
export interface RegisteredPlan {
  planId: string;
  projectRoot: string;
  planPath: string;
  title?: string;
  totalTasks?: number;
  registeredAt: string;
  lastAccessed?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Plan registry file structure
 */
export interface PlanRegistry {
  version: number;
  plans: Record<string, RegisteredPlan>;
}

/**
 * Options for plan registration
 */
export interface RegisterPlanOptions {
  overwrite?: boolean;
  metadata?: Record<string, unknown>;
}

// Re-export MCP types
export * from './mcp.js';
