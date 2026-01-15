/**
 * File system paths for Ralph runtime state
 *
 * These constants define the directory structure and file paths
 * used by the Ralph TUI for storing runtime state, sessions,
 * checkpoints, and comments.
 */

/**
 * Base directory for Ralph runtime state
 * This directory is gitignored
 */
export const RALPH_DIR = '.ralph';

/**
 * Sessions directory - stores session metadata
 * Each session has a corresponding JSON file
 */
export const SESSIONS_DIR = `${RALPH_DIR}/sessions`;

/**
 * Checkpoints directory - stores file checkpoint data
 * Checkpoints are used for reverting state
 */
export const CHECKPOINTS_DIR = `${RALPH_DIR}/checkpoints`;

/**
 * Comments directory - stores diff comments
 * Comments are indexed by commit hash
 */
export const COMMENTS_DIR = `${RALPH_DIR}/comments`;

/**
 * Specs directory - stores requirement specifications
 * These are AI-generated and user-editable
 */
export const SPECS_DIR = 'specs';

/**
 * Implementation plan file
 * AI-generated plan that follows task breakdown format
 */
export const IMPLEMENTATION_PLAN_FILE = 'IMPLEMENTATION_PLAN.md';

/**
 * Session metadata file extension
 */
export const SESSION_EXT = '.json';

/**
 * Checkpoint file extension
 */
export const CHECKPOINT_EXT = '.json';

/**
 * Comment file extension
 */
export const COMMENT_EXT = '.json';

/**
 * Spec file extension
 */
export const SPEC_EXT = '.md';

/**
 * Get path to a session metadata file
 * @param sessionId - The session ID
 * @returns Full path to the session file
 */
export function getSessionPath(sessionId: string): string {
  return `${SESSIONS_DIR}/${sessionId}${SESSION_EXT}`;
}

/**
 * Get path to a checkpoint file
 * @param checkpointId - The checkpoint ID
 * @returns Full path to the checkpoint file
 */
export function getCheckpointPath(checkpointId: string): string {
  return `${CHECKPOINTS_DIR}/${checkpointId}${CHECKPOINT_EXT}`;
}

/**
 * Get path to a comment file
 * @param commitHash - The commit hash
 * @returns Full path to the comment file
 */
export function getCommentPath(commitHash: string): string {
  return `${COMMENTS_DIR}/${commitHash}${COMMENT_EXT}`;
}

/**
 * Get path to a spec file
 * @param specName - The spec name (without extension)
 * @returns Full path to the spec file
 */
export function getSpecPath(specName: string): string {
  return `${SPECS_DIR}/${specName}${SPEC_EXT}`;
}
