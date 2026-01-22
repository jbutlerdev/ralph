/**
 * Ralph Executor Skill
 *
 * This skill communicates with the Ralph Executor Server API to execute plans.
 *
 * IMPORTANT: This skill does NOT start the server. The server must already be
 * running before using this skill.
 *
 * To start the server (in a separate terminal):
 *   ralph server --port 3001
 *   or
 *   npm run server -- --port 3001
 *
 * This skill re-exports all functionality from the main Ralph package.
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
 *
 * The skill communicates with the Ralph Executor Server via HTTP API.
 *
 * IMPORTANT: The Ralph Executor Server must be RUNNING before using this skill.
 * If the server is not running, the skill will report an error - you must start
 * the server yourself in a separate terminal.
 *
 * Usage:
 *   Use the ralph-executor skill to send a plan to the server
 *   and monitor execution progress.
 *
 * This skill will ONLY:
 *   - Connect to the server via HTTP API
 *   - Submit plans for execution
 *   - Poll for execution status
 *   - Report results
 *
 * This skill will NOT:
 *   - Start the server
 *   - Run the server in the background
 *   - Install dependencies
 */
