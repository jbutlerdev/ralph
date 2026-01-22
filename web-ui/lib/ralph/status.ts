/**
 * Ralph Task Status Tracking System
 *
 * Reads Ralph's `.ralph/` runtime state to determine task completion status.
 * Parses session data, commit history, and checkpoint information to determine
 * which tasks are completed, in progress, or pending.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { RalphPlan, RalphTask } from './types.js';

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

/**
 * Ralph session state from `.ralph/sessions/*.json`
 */
interface RalphSessionState {
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
    error?: string;
  }>;
  startedAt: string;
  lastActivity: string;
}

/**
 * Ralph runtime directory structure
 */
const RALPH_DIR = '.ralph';
const SESSIONS_DIR = path.join(RALPH_DIR, 'sessions');

/**
 * Get task status for all tasks in a plan
 *
 * @param plan - The Ralph plan to get status for
 * @param projectPath - Path to the project root directory
 * @returns Map of task ID to status information
 */
export async function getTaskStatus(
  plan: RalphPlan,
  projectPath: string
): Promise<Map<string, TaskStatusInfo>> {
  const statusMap = new Map<string, TaskStatusInfo>();
  const sessionsDir = path.join(projectPath, SESSIONS_DIR);

  // Initialize all tasks as pending
  for (const task of plan.tasks) {
    statusMap.set(task.id, {
      status: 'pending',
      taskId: task.id,
      dependenciesMet: false,
    });
  }

  try {
    // Read session state if available
    const sessionState = await readLatestSession(sessionsDir);

    if (sessionState) {
      // Update task statuses based on session state
      for (const task of plan.tasks) {
        const taskStatus = determineTaskStatus(task, sessionState, plan);
        statusMap.set(task.id, taskStatus);
      }
    } else {
      // No session state - check git commits for task completion
      await updateStatusFromGit(statusMap, plan, projectPath);
    }

    // Update dependency status
    updateDependencyStatus(statusMap, plan);
  } catch (error) {
    // Handle missing .ralph directory gracefully
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      // No .ralph directory exists - all tasks are pending
      updateDependencyStatus(statusMap, plan);
    } else {
      console.error('Error reading task status:', error);
      // Return pending status for all tasks
      updateDependencyStatus(statusMap, plan);
    }
  }

  return statusMap;
}

/**
 * Read the latest session from the sessions directory
 */
async function readLatestSession(sessionsDir: string): Promise<RalphSessionState | null> {
  try {
    const files = await fs.readdir(sessionsDir);
    const sessionFiles = files
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    if (sessionFiles.length === 0) {
      return null;
    }

    // Read the most recent session
    const latestSessionPath = path.join(sessionsDir, sessionFiles[0]);
    const content = await fs.readFile(latestSessionPath, 'utf-8');
    return JSON.parse(content) as RalphSessionState;
  } catch {
    return null;
  }
}

/**
 * Determine task status based on session state
 */
function determineTaskStatus(
  task: RalphTask,
  session: RalphSessionState,
  plan: RalphPlan
): TaskStatusInfo {
  // Check if task is currently in progress
  if (session.currentTaskId === task.id) {
    return {
      status: 'in-progress',
      taskId: task.id,
      dependenciesMet: areDependenciesMet(task, session.completedTasks),
    };
  }

  // Check if task is completed
  if (session.completedTasks.includes(task.id)) {
    const taskHistory = session.taskHistory.find(h => h.taskId === task.id);
    return {
      status: 'completed',
      taskId: task.id,
      completedAt: taskHistory?.completedAt,
      startedAt: taskHistory?.startedAt,
      dependenciesMet: true,
    };
  }

  // Check if task failed
  if (session.failedTasks.includes(task.id)) {
    const taskHistory = session.taskHistory.find(h => h.taskId === task.id);
    return {
      status: 'failed',
      taskId: task.id,
      errorMessage: taskHistory?.error,
      startedAt: taskHistory?.startedAt,
      dependenciesMet: areDependenciesMet(task, session.completedTasks),
    };
  }

  // Check if task is skipped
  if (session.skippedTasks.includes(task.id)) {
    return {
      status: 'completed',
      taskId: task.id,
      dependenciesMet: areDependenciesMet(task, session.completedTasks),
    };
  }

  // Task is pending
  return {
    status: 'pending',
    taskId: task.id,
    dependenciesMet: areDependenciesMet(task, session.completedTasks),
  };
}

/**
 * Update task status from git commit history
 */
async function updateStatusFromGit(
  statusMap: Map<string, TaskStatusInfo>,
  plan: RalphPlan,
  projectPath: string
): Promise<void> {
  try {
    // Try to import simple-git dynamically
    const git = await import('simple-git');
    const gitInstance = git.default(projectPath);

    // Get commit log
    const log = await gitInstance.log({ maxCount: 100 });

    // Parse commits for task completion markers
    for (const commit of log.all) {
      const match = commit.message.match(/^\[([a-z]{4}-\d+)\]/);
      if (match) {
        const taskId = match[1];
        const existingStatus = statusMap.get(taskId);
        if (existingStatus && existingStatus.status === 'pending') {
          statusMap.set(taskId, {
            status: 'completed',
            taskId,
            commitHash: commit.hash,
            completedAt: commit.date,
            dependenciesMet: false, // Will be updated later
          });
        }
      }
    }
  } catch {
    // Git operations failed - continue with current status map
  }
}

/**
 * Update dependency status for all tasks
 */
function updateDependencyStatus(
  statusMap: Map<string, TaskStatusInfo>,
  plan: RalphPlan
): void {
  for (const task of plan.tasks) {
    const status = statusMap.get(task.id);
    if (!status) continue;

    // Determine if dependencies are met
    const dependenciesMet = areDependenciesMet(
      task,
      Array.from(statusMap.values())
        .filter(s => s.status === 'completed')
        .map(s => s.taskId)
    );

    // Update status based on dependencies
    if (status.status === 'pending' && !dependenciesMet) {
      status.status = 'blocked';
    }

    status.dependenciesMet = dependenciesMet;
  }
}

/**
 * Check if task dependencies are met
 */
function areDependenciesMet(task: RalphTask, completedTaskIds: string[]): boolean {
  return task.dependencies.every(depId => completedTaskIds.includes(depId));
}

/**
 * Get overall plan status summary
 * Merges runtime status from .ralph/sessions with plan file status (Implemented/Verified)
 */
export async function getPlanStatusSummary(
  plan: RalphPlan,
  projectPath: string
): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  blocked: number;
  failed: number;
  percentage: number;
}> {
  const statusMap = await getTaskStatus(plan, projectPath);

  const summary = {
    total: plan.tasks.length,
    completed: 0,
    inProgress: 0,
    pending: 0,
    blocked: 0,
    failed: 0,
    percentage: 0,
  };

  for (const task of plan.tasks) {
    // First check if task is marked as completed in the plan file
    if (task.status === 'Implemented' || task.status === 'Verified') {
      summary.completed++;
      continue;
    }

    // Otherwise use runtime status from sessions
    const runtimeStatus = statusMap.get(task.id);
    const status = runtimeStatus?.status || 'pending';

    switch (status) {
      case 'completed':
        summary.completed++;
        break;
      case 'in-progress':
        summary.inProgress++;
        break;
      case 'pending':
        summary.pending++;
        break;
      case 'blocked':
        summary.blocked++;
        break;
      case 'failed':
        summary.failed++;
        break;
    }
  }

  summary.percentage = summary.total > 0
    ? Math.round((summary.completed / summary.total) * 100)
    : 0;

  return summary;
}

/**
 * Get tasks filtered by status
 */
export async function getTasksByStatus(
  plan: RalphPlan,
  projectPath: string,
  status: TaskStatus
): Promise<RalphTask[]> {
  const statusMap = await getTaskStatus(plan, projectPath);

  return plan.tasks.filter(task => {
    const taskStatus = statusMap.get(task.id);
    return taskStatus?.status === status;
  });
}

/**
 * Check if Ralph has been initialized in the project
 */
export async function isRalphInitialized(projectPath: string): Promise<boolean> {
  const ralphDir = path.join(projectPath, RALPH_DIR);
  try {
    await fs.access(ralphDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current session information
 */
export async function getCurrentSession(
  projectPath: string
): Promise<RalphSessionState | null> {
  const sessionsDir = path.join(projectPath, SESSIONS_DIR);
  return readLatestSession(sessionsDir);
}
