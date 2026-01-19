/**
 * Ralph Task Status Tracking
 *
 * Reads Ralph's `.ralph/` runtime state to determine task completion status.
 * Parses session data, commit history, and checkpoint information to determine
 * which tasks are completed, in progress, or pending.
 */

import type { RalphPlan, RalphTask } from './types';
import type { TaskStatus } from './types';

/**
 * Runtime task status based on execution state and git history
 * This is different from the plan's TaskStatus which represents the manual plan status
 */
export type RuntimeTaskStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'failed';

/**
 * Ralph session data structure from .ralph/sessions/*.json
 */
export interface RalphSession {
  sessionId: string;
  planPath: string;
  completedTasks: string[];
  skippedTasks: string[];
  failedTasks: string[];
  currentTaskId: string | null;
  taskHistory: Array<{
    taskId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    result?: {
      commitHash?: string;
      filesChanged: number;
      acceptanceCriteriaPassed: string[];
      acceptanceCriteriaFailed: string[];
    };
    error?: string;
    attempts: number;
  }>;
  startedAt: string;
  lastActivity: string;
}

/**
 * Task status with additional metadata
 */
export interface TaskStatusInfo {
  taskId: string;
  status: RuntimeTaskStatus;
  source: 'session' | 'plan' | 'git' | 'inferred';
  sessionId?: string;
  commitHash?: string;
  startedAt?: string;
  completedAt?: string;
  reason?: string;
}

/**
 * Options for status tracking
 */
export interface StatusTrackingOptions {
  /**
   * Project root directory
   */
  projectPath: string;

  /**
   * Whether to read git commit messages for task markers
   */
  checkGitCommits?: boolean;

  /**
   * Whether to throw errors or return gracefully
   */
  strict?: boolean;
}

/**
 * Result of status tracking
 */
export interface StatusTrackingResult {
  taskStatuses: Map<string, RuntimeTaskStatus>;
  taskInfo: Map<string, TaskStatusInfo>;
  sessionId?: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  failedTasks: number;
  blockedTasks: number;
  pendingTasks: number;
}

/**
 * Get task status by reading .ralph runtime state and git history
 *
 * @param plan - The Ralph plan to analyze
 * @param projectPath - Path to the project directory
 * @returns Map of task IDs to their runtime status
 */
export async function getTaskStatus(
  plan: RalphPlan,
  projectPath: string
): Promise<Map<string, RuntimeTaskStatus>> {
  const result = await getTaskStatusInfo(plan, { projectPath });
  return result.taskStatuses;
}

/**
 * Get detailed task status information
 *
 * @param plan - The Ralph plan to analyze
 * @param options - Status tracking options
 * @returns Detailed status tracking result
 */
export async function getTaskStatusInfo(
  plan: RalphPlan,
  options: StatusTrackingOptions
): Promise<StatusTrackingResult> {
  const { projectPath, checkGitCommits = true, strict = false } = options;

  const taskStatuses = new Map<string, RuntimeTaskStatus>();
  const taskInfo = new Map<string, TaskStatusInfo>();

  // Initialize all tasks as pending
  for (const task of plan.tasks) {
    taskStatuses.set(task.id, 'pending');
    taskInfo.set(task.id, {
      taskId: task.id,
      status: 'pending',
      source: 'inferred',
    });
  }

  try {
    // Try to read session data from .ralph/sessions
    const sessionData = await readLatestSession(projectPath);
    if (sessionData) {
      // Apply session-based statuses
      applySessionStatuses(sessionData, taskStatuses, taskInfo);

      // Check git commits if enabled and we have commit info
      if (checkGitCommits) {
        const gitStatuses = await getStatusesFromGitCommits(plan, projectPath);
        applyGitStatuses(gitStatuses, taskStatuses, taskInfo, sessionData);
      }
    } else {
      // No session data, try git commits only
      if (checkGitCommits) {
        const gitStatuses = await getStatusesFromGitCommits(plan, projectPath);
        applyGitStatuses(gitStatuses, taskStatuses, taskInfo);
      }
    }

    // Infer blocked status based on dependencies
    inferBlockedStatuses(plan, taskStatuses, taskInfo);
  } catch (error) {
    if (strict) {
      throw error;
    }
    // In non-strict mode, continue with default pending statuses
    console.warn('Error reading task status:', error);
  }

  // Calculate summary
  const summary = calculateStatusSummary(taskStatuses);

  return {
    taskStatuses,
    taskInfo,
    ...summary,
  };
}

/**
 * Read the latest session file from .ralph/sessions directory
 */
async function readLatestSession(projectPath: string): Promise<RalphSession | null> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const sessionsDir = path.join(projectPath, '.ralph', 'sessions');

    // Check if directory exists
    try {
      await fs.access(sessionsDir);
    } catch {
      return null;
    }

    // Read all session files
    const files = await fs.readdir(sessionsDir);
    const sessionFiles = files
      .filter(f => f.startsWith('session-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (sessionFiles.length === 0) {
      return null;
    }

    // Read the most recent session file
    const latestSessionPath = path.join(sessionsDir, sessionFiles[0]);
    const content = await fs.readFile(latestSessionPath, 'utf-8');
    const session: RalphSession = JSON.parse(content);

    return session;
  } catch {
    return null;
  }
}

/**
 * Apply session-based statuses to the task maps
 */
function applySessionStatuses(
  session: RalphSession,
  taskStatuses: Map<string, RuntimeTaskStatus>,
  taskInfo: Map<string, TaskStatusInfo>
): void {
  // Mark completed tasks
  for (const taskId of session.completedTasks) {
    taskStatuses.set(taskId, 'completed');
    const taskHistory = session.taskHistory.find(h => h.taskId === taskId);
    taskInfo.set(taskId, {
      taskId,
      status: 'completed',
      source: 'session',
      sessionId: session.sessionId,
      commitHash: taskHistory?.result?.commitHash,
      completedAt: taskHistory?.completedAt,
    });
  }

  // Mark failed tasks
  for (const taskId of session.failedTasks) {
    taskStatuses.set(taskId, 'failed');
    const taskHistory = session.taskHistory.find(h => h.taskId === taskId);
    taskInfo.set(taskId, {
      taskId,
      status: 'failed',
      source: 'session',
      sessionId: session.sessionId,
      reason: taskHistory?.error,
    });
  }

  // Mark current task as in-progress
  if (session.currentTaskId) {
    taskStatuses.set(session.currentTaskId, 'in-progress');
    const taskHistory = session.taskHistory.find(h => h.taskId === session.currentTaskId);
    taskInfo.set(session.currentTaskId, {
      taskId: session.currentTaskId,
      status: 'in-progress',
      source: 'session',
      sessionId: session.sessionId,
      startedAt: taskHistory?.startedAt,
    });
  }
}

/**
 * Get task statuses from git commit messages
 * Looks for [task-XXX] patterns in commit messages
 */
async function getStatusesFromGitCommits(
  plan: RalphPlan,
  projectPath: string
): Promise<Map<string, { status: RuntimeTaskStatus; commitHash: string }>> {
  const statuses = new Map<string, { status: RuntimeTaskStatus; commitHash: string }>();

  try {
    // Use simple-git to read log
    const { default: simpleGit } = await import('simple-git');
    const git = simpleGit(projectPath);

    const log = await git.log({ maxCount: 100 });

    for (const commit of log.all) {
      // Match [task-XXX] pattern in commit message
      const match = commit.message.match(/\[task-(\d+)\]/);
      if (match) {
        const taskId = `task-${match[1]}`;
        // Check if this task exists in our plan
        if (plan.tasks.some(t => t.id === taskId)) {
          // Only set if not already set (earlier commits take precedence)
          if (!statuses.has(taskId)) {
            statuses.set(taskId, {
              status: 'completed',
              commitHash: commit.hash,
            });
          }
        }
      }
    }
  } catch {
    // Git operations might fail, return empty map
  }

  return statuses;
}

/**
 * Apply git-based statuses to the task maps
 */
function applyGitStatuses(
  gitStatuses: Map<string, { status: RuntimeTaskStatus; commitHash: string }>,
  taskStatuses: Map<string, RuntimeTaskStatus>,
  taskInfo: Map<string, TaskStatusInfo>,
  session?: RalphSession
): void {
  for (const [taskId, { status, commitHash }] of gitStatuses) {
    // Don't override session statuses if they exist and are more recent
    const currentInfo = taskInfo.get(taskId);
    if (currentInfo?.source === 'session') {
      continue;
    }

    taskStatuses.set(taskId, status);
    taskInfo.set(taskId, {
      taskId,
      status,
      source: 'git',
      commitHash,
      sessionId: session?.sessionId,
    });
  }
}

/**
 * Infer blocked status based on incomplete dependencies
 */
function inferBlockedStatuses(
  plan: RalphPlan,
  taskStatuses: Map<string, RuntimeTaskStatus>,
  taskInfo: Map<string, TaskStatusInfo>
): void {
  for (const task of plan.tasks) {
    // Skip if already has a definitive status
    const currentStatus = taskStatuses.get(task.id);
    if (currentStatus && currentStatus !== 'pending') {
      continue;
    }

    // Check if all dependencies are completed
    const hasIncompleteDeps = task.dependencies.some(depId => {
      const depStatus = taskStatuses.get(depId);
      return depStatus !== 'completed';
    });

    if (hasIncompleteDeps && task.dependencies.length > 0) {
      taskStatuses.set(task.id, 'blocked');
      taskInfo.set(task.id, {
        taskId: task.id,
        status: 'blocked',
        source: 'inferred',
        reason: 'Waiting for dependencies to complete',
      });
    }
  }
}

/**
 * Calculate summary statistics from task statuses
 */
function calculateStatusSummary(taskStatuses: Map<string, RuntimeTaskStatus>): {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  failedTasks: number;
  blockedTasks: number;
  pendingTasks: number;
} {
  let completed = 0;
  let inProgress = 0;
  let failed = 0;
  let blocked = 0;
  let pending = 0;

  for (const status of taskStatuses.values()) {
    switch (status) {
      case 'completed':
        completed++;
        break;
      case 'in-progress':
        inProgress++;
        break;
      case 'failed':
        failed++;
        break;
      case 'blocked':
        blocked++;
        break;
      case 'pending':
        pending++;
        break;
    }
  }

  return {
    totalTasks: taskStatuses.size,
    completedTasks: completed,
    inProgressTasks: inProgress,
    failedTasks: failed,
    blockedTasks: blocked,
    pendingTasks: pending,
  };
}

/**
 * Check if a task is ready to be executed
 * (not blocked, not completed, not failed, not in-progress)
 */
export function isTaskReady(taskId: string, taskStatuses: Map<string, RuntimeTaskStatus>): boolean {
  const status = taskStatuses.get(taskId);
  return status === 'pending';
}

/**
 * Get the next task that should be executed
 */
export function getNextTaskToExecute(
  plan: RalphPlan,
  taskStatuses: Map<string, RuntimeTaskStatus>
): RalphTask | null {
  // Find tasks that are ready (pending) and have all dependencies met
  const readyTasks = plan.tasks.filter(task => {
    if (taskStatuses.get(task.id) !== 'pending') {
      return false;
    }

    // Check if all dependencies are completed
    return task.dependencies.every(depId => taskStatuses.get(depId) === 'completed');
  });

  if (readyTasks.length === 0) {
    return null;
  }

  // Sort by priority (high > medium > low) and then by ID
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  readyTasks.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return a.id.localeCompare(b.id);
  });

  return readyTasks[0];
}

/**
 * Convert runtime status to display-friendly string
 */
export function runtimeStatusToString(status: RuntimeTaskStatus): string {
  const statusMap: Record<RuntimeTaskStatus, string> = {
    'pending': 'Pending',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'blocked': 'Blocked',
    'failed': 'Failed',
  };
  return statusMap[status];
}

/**
 * Get a CSS class name for a runtime status
 */
export function getRuntimeStatusClass(status: RuntimeTaskStatus): string {
  const classMap: Record<RuntimeTaskStatus, string> = {
    'pending': 'status-pending',
    'in-progress': 'status-in-progress',
    'completed': 'status-completed',
    'blocked': 'status-blocked',
    'failed': 'status-failed',
  };
  return classMap[status];
}
