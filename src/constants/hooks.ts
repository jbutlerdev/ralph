/**
 * Hook event names for Claude Agent SDK integration
 *
 * These constants define the hook events that can be registered
 * with the SessionManager for task lifecycle management.
 */

/**
 * Hook: Triggered when a task starts execution
 * Used for updating task status and initializing tracking
 */
export const TASK_START = 'TaskStart';

/**
 * Hook: Triggered after any tool use during task execution
 * Used for tracking file changes and monitoring progress
 */
export const POST_TOOL_USE = 'PostToolUse';

/**
 * Hook: Triggered when a task completes
 * Used for detecting task boundaries and triggering commit workflow
 */
export const TASK_COMPLETION = 'TaskCompletion';

/**
 * Hook: Triggered when user submits feedback during iteration
 * Used for handling user feedback and continuing execution
 */
export const ITERATION_PROMPT = 'IterationPrompt';

/**
 * Hook: Triggered when forking a new branch
 * Used for creating new worktree and session for parallel exploration
 */
export const FORK_SESSION = 'ForkSession';

/**
 * Hook: Triggered on user prompt submit
 * Used for intercepting special commands like //fork:
 */
export const USER_PROMPT_SUBMIT = 'UserPromptSubmit';

/**
 * Hook: Triggered on session stop
 * Used for cleanup and finalization
 */
export const STOP = 'Stop';
