/**
 * Ralph Task Status Types
 *
 * Client-safe types for task status tracking.
 * These types are shared between server and client code.
 */

/**
 * Task status enumeration
 */
export type TaskStatus =
  | 'pending'      // Task has not started yet
  | 'in-progress'  // Task is currently being executed
  | 'completed'    // Task has completed successfully
  | 'blocked'      // Task dependencies are not met
  | 'failed';      // Task failed during execution

/**
 * Task status information
 */
export interface TaskStatusInfo {
  status: TaskStatus;
  taskId: string;
  completedAt?: string;
  startedAt?: string;
  errorMessage?: string;
  commitHash?: string;
  dependenciesMet: boolean;
}
