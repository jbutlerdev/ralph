/**
 * Ralph Executor Skill
 *
 * This skill provides access to the Ralph Executor server API for plan execution.
 * It re-exports all functionality from the main Ralph package.
 */

// Re-export all executor functionality from main package
export {
  RalphExecutor,
  RalphExecutorClient,
  runRalphExecution,
  executeViaServer,
  getServerStatus,
} from '../../../dist/executor.js';

// Re-export types
export type {
  RalphTask,
  RalphPlan,
  TaskExecution,
  TaskResult,
  RalphExecutionSession,
  ExecutionResult,
  ServerConfig,
  ServerClientOptions,
  RalphExecutorOptions,
} from '../../../dist/executor.js';

/**
 * Main entry point - this skill re-exports everything from the main package.
 * When invoked, it will use the RalphExecutorClient to communicate with
 * the Ralph Server running on localhost:3001.
 *
 * Usage:
 *   Use the ralph-executor skill to send a plan to the server
 *   and monitor execution progress.
 */
