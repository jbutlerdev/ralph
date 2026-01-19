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
export {
  planFromMarkdown,
  validateRalphPlan,
  sortTasksByDependencies,
  getNextTask,
  calculateProgress,
  filterByPriority,
  filterByTag,
  getTaskById,
} from './parser';

// Export status functions
export {
  getTaskStatus,
  getPlanStatusSummary,
  getTasksByStatus,
  isRalphInitialized,
  getCurrentSession,
} from './status';

// Export status types
export type {
  TaskStatus,
  TaskStatusInfo,
} from './status';
