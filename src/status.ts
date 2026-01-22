/**
 * Runtime Status Utilities for Ralph Server
 *
 * Provides functions to determine task execution status by reading
 * from the plan markdown file. The plan file is the single source of truth.
 */

import type { RalphPlan, RalphTask } from './types/index.js';

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
 * Get runtime status for all tasks in a plan based on plan file status
 */
export async function getTasksRuntimeStatus(
  plan: RalphPlan,
  _projectRoot: string
): Promise<Map<string, TaskRuntimeStatus>> {
  const statusMap = new Map<string, TaskRuntimeStatus>();

  // Build a map of task statuses for dependency checking
  const taskStatuses = new Map<string, RuntimeTaskStatus>();

  // First pass: convert plan file status to runtime status
  for (const task of plan.tasks) {
    const runtimeStatus = planStatusToRuntimeStatus(task.status);
    taskStatuses.set(task.id, runtimeStatus);
    statusMap.set(task.id, {
      status: runtimeStatus,
      planStatus: task.status,
    });
  }

  // Second pass: check for blocked tasks (dependencies not met)
  for (const task of plan.tasks) {
    if (taskStatuses.get(task.id) === 'pending') {
      const hasIncompleteDeps = task.dependencies.some(depId => {
        const depStatus = taskStatuses.get(depId);
        return !depStatus || depStatus !== 'completed';
      });
      if (hasIncompleteDeps) {
        statusMap.set(task.id, {
          status: 'blocked',
          planStatus: task.status,
        });
      }
    }
  }

  return statusMap;
}

/**
 * Get runtime status summary for a plan
 */
export async function getPlanRuntimeStatus(
  plan: RalphPlan,
  projectRoot: string
): Promise<PlanRuntimeStatus> {
  const taskStatuses = await getTasksRuntimeStatus(plan, projectRoot);

  let completedTasks = 0;
  let inProgressTasks = 0;
  let blockedTasks = 0;
  let pendingTasks = 0;
  let failedTasks = 0;

  for (const status of taskStatuses.values()) {
    switch (status.status) {
      case 'completed':
        completedTasks++;
        break;
      case 'in-progress':
        inProgressTasks++;
        break;
      case 'blocked':
        blockedTasks++;
        break;
      case 'failed':
        failedTasks++;
        break;
      case 'pending':
        pendingTasks++;
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
