/**
 * Task Complete Tool Handler
 *
 * Handles the logic for marking tasks as complete in the Ralph executor.
 * Updates session state when a task is marked complete.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Session context for task completion
 */
export interface SessionContext {
  sessionId?: string;
  planPath?: string;
  projectRoot?: string;
  currentTaskId?: string;
}

/**
 * Session file structure
 */
interface RalphSessionFile {
  sessionId: string;
  planPath: string;
  completedTasks: string[];
  skippedTasks: string[];
  failedTasks: string[];
  currentTaskId: string | null;
  taskHistory: Array<{
    taskId: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    result?: Record<string, unknown>;
    error?: string;
    attempts: number;
  }>;
  startedAt: string;
  lastActivity: string;
}

/**
 * Load session state from file
 */
async function loadSessionState(
  sessionId: string,
  projectRoot: string
): Promise<RalphSessionFile | null> {
  try {
    const stateDir = path.join(projectRoot, '.ralph', 'sessions');
    const sessionPath = path.join(stateDir, `${sessionId}.json`);
    const content = await fs.readFile(sessionPath, 'utf-8');
    return JSON.parse(content) as RalphSessionFile;
  } catch (error) {
    // Session file not found or invalid
    return null;
  }
}

/**
 * Save session state to file
 */
async function saveSessionState(
  session: RalphSessionFile,
  projectRoot: string
): Promise<void> {
  const stateDir = path.join(projectRoot, '.ralph', 'sessions');
  await fs.mkdir(stateDir, { recursive: true });
  const sessionPath = path.join(stateDir, `${session.sessionId}.json`);
  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
}

/**
 * Handle task-complete tool call
 *
 * @param context - Session context from environment variables
 * @returns Result of the operation
 */
export async function handleTaskComplete(
  context: SessionContext
): Promise<{ success: boolean; message: string }> {
  const { sessionId, currentTaskId } = context;

  // Validate required context
  if (!sessionId) {
    return {
      success: false,
      message: 'Session ID not provided. Ensure RALPH_SESSION_ID environment variable is set.',
    };
  }

  // Load current session state
  const session = await loadSessionState(sessionId, context.projectRoot || process.cwd());

  if (!session) {
    return {
      success: false,
      message: `Session "${sessionId}" not found. Ensure the session exists and the session file is accessible.`,
    };
  }

  // Update session state with current task ID as completed
  if (currentTaskId) {
    if (!session.completedTasks.includes(currentTaskId)) {
      session.completedTasks.push(currentTaskId);
    }
    session.failedTasks = session.failedTasks.filter((id) => id !== currentTaskId);
    session.lastActivity = new Date().toISOString();
  }

  // Update task execution history
  const taskExecution = session.taskHistory.find(
    (h) => h.taskId === currentTaskId && h.status === 'in_progress'
  );
  if (taskExecution) {
    taskExecution.status = 'completed';
    taskExecution.completedAt = new Date().toISOString();
    if (taskExecution.startedAt) {
      taskExecution.duration = Date.now() - new Date(taskExecution.startedAt).getTime();
    }
  }

  // Save updated session
  await saveSessionState(session, context.projectRoot || process.cwd());

  return {
    success: true,
    message: `Task marked as complete. Ralph executor will now proceed to the next task.`,
  };
}
