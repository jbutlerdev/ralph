/**
 * MCP (Model Context Protocol) type definitions for Ralph executor tools
 */

/**
 * Parameters for the task-complete tool
 */
export interface TaskCompleteParams {
  /**
   * ID of the task to mark as complete
   */
  taskId: string;

  /**
   * Optional notes about the task completion
   */
  notes?: string;

  /**
   * Map of acceptance criterion to pass/fail status
   */
  acceptanceCriteria?: Record<string, boolean>;

  /**
   * List of files changed during task execution
   */
  filesChanged?: string[];
}

/**
 * Result returned by the task-complete tool
 */
export interface TaskCompleteResult {
  /**
   * Whether the operation was successful
   */
  success: boolean;

  /**
   * Updated task status
   */
  taskStatus: string;

  /**
   * Current session ID
   */
  sessionId: string;

  /**
   * Message describing the result
   */
  message: string;

  /**
   * Error message if operation failed
   */
  error?: string;
}

/**
 * Tool definition for the task-complete tool
 */
export interface TaskCompleteToolDefinition {
  name: 'ralph_task_complete';
  description: string;
  inputSchema: {
    type: 'object';
    properties: {
      taskId: {
        type: 'string';
        description: string;
      };
      notes?: {
        type: 'string';
        description: string;
      };
      acceptanceCriteria?: {
        type: 'object';
        description: string;
        additionalProperties: {
          type: 'boolean';
        };
      };
      filesChanged?: {
        type: 'array';
        description: string;
        items: {
          type: 'string';
        };
      };
    };
    required: string[];
  };
}
