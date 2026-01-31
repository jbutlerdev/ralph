/**
 * Runtime Status Utilities for Ralph Server
 *
 * Provides functions to determine task execution status by reading
 * from the plan markdown file and session data. Merges static plan
 * status with runtime execution state.
 */

import type { RalphPlan, RalphTask } from './types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const RALPH_DIR = '.ralph';
const SESSIONS_DIR = path.join(RALPH_DIR, 'sessions');

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
    result?: {
      acceptanceCriteriaPassed: string[];
      acceptanceCriteriaFailed: string[];
    };
  }>;
  startedAt: string;
  lastActivity: string;
}

/**
 * Runtime task execution status
 */
export type RuntimeTaskStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'failed';

/**
 * Runtime status information for a task
 */
export interface TaskRuntimeStatus {
  status: RuntimeTaskStatus;
  planStatus: RalphTask['status']; // The original status from the plan file
}

/**
 * Summary of plan execution status
 */
export interface PlanRuntimeStatus {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  pendingTasks: number;
  failedTasks: number;
  progress: number;
}

/**
 * Convert plan file status to runtime status
 */
function planStatusToRuntimeStatus(planStatus: RalphTask['status']): RuntimeTaskStatus {
  switch (planStatus) {
    case 'Implemented':
    case 'Verified':
      return 'completed';
    case 'In Progress':
      return 'in-progress';
    case 'Needs Re-Work':
      return 'failed';
    case 'To Do':
    default:
      return 'pending';
  }
}

/**
 * Read the latest session from the sessions directory
 * Filters sessions to only return those matching the specified plan path
 */
export async function readLatestSession(sessionsDir: string, planPath: string): Promise<RalphSessionState | null> {
  try {
    const files = await fs.readdir(sessionsDir);
    const sessionFiles = files
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    if (sessionFiles.length === 0) {
      return null;
    }

    // Find the most recent session that matches the plan path
    for (const sessionFile of sessionFiles) {
      const sessionFilePath = path.join(sessionsDir, sessionFile);
      const content = await fs.readFile(sessionFilePath, 'utf-8');
      const session = JSON.parse(content) as RalphSessionState;

      // Normalize paths for comparison (handle both relative and absolute paths)
      const sessionPlanPath = path.resolve(session.planPath);
      const targetPlanPath = path.resolve(planPath);

      if (sessionPlanPath === targetPlanPath) {
        return session;
      }
    }

    // No matching session found
    return null;
  } catch {
    return null;
  }
}

/**
 * Update task status from git commit history
 */
async function updateStatusFromGit(
  statusMap: Map<string, TaskRuntimeStatus>,
  plan: RalphPlan,
  projectPath: string
): Promise<void> {
  try {
    const git = await import('simple-git');
    const gitInstance = git.simpleGit(projectPath);

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
            planStatus: existingStatus.planStatus,
          });
        }
      }
    }
  } catch {
    // Git operations failed - continue with current status map
  }
}

/**
 * Check if task dependencies are met
 */
function areDependenciesMet(task: RalphTask, completedTaskIds: string[]): boolean {
  return task.dependencies.every(depId => completedTaskIds.includes(depId));
}

/**
 * Get runtime status for all tasks in a plan
 *
 * This function merges plan file status with runtime session data:
 * 1. First check if task is marked as Implemented/Verified in plan file
 * 2. Otherwise use runtime status from .ralph/sessions
 * 3. If no session data, check git commits
 * 4. Finally, check if pending tasks have unmet dependencies (blocked)
 */
export async function getTasksRuntimeStatus(
  plan: RalphPlan,
  projectRoot: string,
  planPath?: string
): Promise<Map<string, TaskRuntimeStatus>> {
  const statusMap = new Map<string, TaskRuntimeStatus>();
  const sessionsDir = path.join(projectRoot, SESSIONS_DIR);

  // Initialize all tasks with status from plan file
  for (const task of plan.tasks) {
    statusMap.set(task.id, {
      status: planStatusToRuntimeStatus(task.status),
      planStatus: task.status,
    });
  }

  try {
    // Read session state if available
    const sessionState = await readLatestSession(sessionsDir, planPath || '');

    if (sessionState) {
      // Update task statuses based on session state
      for (const task of plan.tasks) {
        // Check if task is currently in progress
        if (sessionState.currentTaskId === task.id) {
          statusMap.set(task.id, {
            status: 'in-progress',
            planStatus: task.status,
          });
        }
        // Check if task is completed
        else if (sessionState.completedTasks.includes(task.id)) {
          statusMap.set(task.id, {
            status: 'completed',
            planStatus: task.status,
          });
        }
        // Check if task is skipped (treat as completed)
        else if (sessionState.skippedTasks.includes(task.id)) {
          statusMap.set(task.id, {
            status: 'completed',
            planStatus: task.status,
          });
        }
        // Check if task failed
        else if (sessionState.failedTasks.includes(task.id)) {
          statusMap.set(task.id, {
            status: 'failed',
            planStatus: task.status,
          });
        }
      }
    } else {
      // No session state - check git commits for task completion
      await updateStatusFromGit(statusMap, plan, projectRoot);
    }
  } catch (error) {
    // Handle missing .ralph directory gracefully
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      // No .ralph directory exists - all tasks remain with plan file status
    } else {
      console.error('Error reading task runtime status:', error);
      // Return plan file status for all tasks
    }
  }

  // Update dependency status - mark pending tasks with unmet deps as blocked
  const completedTaskIds = Array.from(statusMap.values())
    .filter(s => s.status === 'completed')
    .map(s => {
      // Find the task ID by status
      for (const [taskId, status] of statusMap.entries()) {
        if (status === s) return taskId;
      }
      return '';
    })
    .filter(id => id !== '');

  for (const task of plan.tasks) {
    const status = statusMap.get(task.id);
    if (!status) continue;

    if (status.status === 'pending' && !areDependenciesMet(task, completedTaskIds)) {
      status.status = 'blocked';
    }
  }

  return statusMap;
}

/**
 * Get runtime status summary for a plan
 *
 * Matches the behavior of web-ui/lib/ralph/status.ts getPlanStatusSummary
 * by giving priority to plan file status (Implemented/Verified) over runtime status
 */
export async function getPlanRuntimeStatus(
  plan: RalphPlan,
  projectRoot: string,
  planPath?: string
): Promise<PlanRuntimeStatus> {
  const taskStatuses = await getTasksRuntimeStatus(plan, projectRoot, planPath);

  let completedTasks = 0;
  let inProgressTasks = 0;
  let blockedTasks = 0;
  let pendingTasks = 0;
  let failedTasks = 0;

  // Match web-ui behavior: first check plan file status, then runtime status
  for (const task of plan.tasks) {
    // First check if task is marked as completed in the plan file
    if (task.status === 'Implemented' || task.status === 'Verified') {
      completedTasks++;
      continue;
    }

    // Otherwise use runtime status
    const runtimeStatus = taskStatuses.get(task.id);
    const status = runtimeStatus?.status || 'pending';

    switch (status) {
      case 'completed':
        completedTasks++;
        break;
      case 'in-progress':
        inProgressTasks++;
        break;
      case 'pending':
        pendingTasks++;
        break;
      case 'blocked':
        blockedTasks++;
        break;
      case 'failed':
        failedTasks++;
        break;
    }
  }

  const totalTasks = plan.tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    pendingTasks,
    failedTasks,
    progress,
  };
}
