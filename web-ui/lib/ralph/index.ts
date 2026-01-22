/**
 * Ralph Plan Parser
 *
 * Utilities for parsing and manipulating Ralph implementation plans.
 *
 * @example
 * ```ts
 * import { planFromMarkdown, validateRalphPlan } from '@/lib/ralph';
 *
 * const plan = planFromMarkdown(markdownContent);
 * const validation = validateRalphPlan(plan);
 * ```
 */

// Export polling hook and types
export {
  usePolling,
} from './usePolling';

export type {
  UsePollingOptions,
  UsePollingResult,
} from './usePolling';

// Export WebSocket hook and types
export {
  useWebSocket,
} from './useWebSocket';

export type {
  UseWebSocketOptions,
  UseWebSocketResult,
  WSConnectionState,
  WSMessage,
  WSMessageType,
  TaskEventData,
  SessionChangeData,
  CheckpointData,
} from './useWebSocket';

// Export SSE hook and types
export {
  useServerEvents,
} from '../../src/lib/ralph/useServerEvents';

export type {
  UseServerEventsOptions,
  UseServerEventsResult,
  SSEConnectionState,
  PlanStatusEvent,
  TaskStatusEvent,
  SSEMessage,
} from '../../src/lib/ralph/useServerEvents';

// Export types
export type {
  RalphTask,
  RalphPlan,
  TaskExecution,
  TaskResult,
  RalphExecutionSession,
  ExecutionResult,
  RalphExecutorOptions,
  ServerConfig,
  ExecutionRequest,
} from './types';

// Export parser functions
// NOTE: parser.ts uses 'path' module which is not available in browser
// These functions should only be used in server components or API routes
// Uncomment if you need them in server-side code:
// export {
//   planFromMarkdown,
//   validateRalphPlan,
//   sortTasksByDependencies,
//   getNextTask,
//   calculateProgress,
//   filterByPriority,
//   filterByTag,
//   getTaskById,
// } from './parser';

// Export status functions - SERVER ONLY
// NOTE: status.ts uses fs and simple-git which are not available in browser
// These functions should only be used in server components or API routes
// Import directly from './status' in server-side code

// Export status types (client-safe, no fs/git dependencies)
export type {
  TaskStatus,
  TaskStatusInfo,
} from './status-types';
