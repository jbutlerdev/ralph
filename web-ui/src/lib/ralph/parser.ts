/**
 * Ralph Plan Parser Utilities
 *
 * Utilities for parsing and manipulating Ralph implementation plans in the Web UI.
 * Adapted from the main Ralph project for browser compatibility.
 */

import type { RalphPlan, RalphTask, TaskStatus, ProgressInfo } from './types';

const VALID_STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Implemented', 'Needs Re-Work', 'Verified'];
const DEFAULT_STATUS: TaskStatus = 'To Do';

/**
 * Converts a Markdown implementation plan to a RalphPlan object
 * Parses the structured format defined in CLAUDE.md
 */
export function planFromMarkdown(markdown: string): RalphPlan {
  const tasks: RalphTask[] = [];
  const lines = markdown.split('\n');
  let currentTask: Partial<RalphTask> | null = null;

  // Parse implementation plan section
  let inTasksSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect tasks section
    if (line.toLowerCase() === '## tasks') {
      inTasksSection = true;
      continue;
    }

    if (!inTasksSection) continue;

    // Detect task header: ### Task N: Title or ### Title
    const taskHeaderMatch = line.match(/^###\s+(Task\s+\d+:\s*)?(.+)$/);
    if (taskHeaderMatch) {
      // Save previous task (only need title, ID can be auto-generated)
      if (currentTask?.title) {
        tasks.push(currentTask as RalphTask);
      }
      // Start new task
      currentTask = {
        title: taskHeaderMatch[2],
        dependencies: [],
        acceptanceCriteria: [],
        status: DEFAULT_STATUS,
      };
      continue;
    }

    if (!currentTask) continue;

    // Parse ID field
    const idMatch = line.match(/\*\*ID:\*\*\s*(task-\d+)/i);
    if (idMatch) {
      currentTask.id = idMatch[1];
      continue;
    }

    // Parse priority
    const priorityMatch = line.match(/\*\*Priority:\*\*\s*(high|medium|low)/i);
    if (priorityMatch) {
      currentTask.priority = priorityMatch[1].toLowerCase() as RalphTask['priority'];
      continue;
    }

    // Parse status
    const statusMatch = line.match(/\*\*Status:\*\*\s*(.+)$/i);
    if (statusMatch) {
      const statusValue = statusMatch[1].trim();
      if (VALID_STATUSES.includes(statusValue as TaskStatus)) {
        currentTask.status = statusValue as TaskStatus;
      } else {
        // Default to "To Do" if invalid status
        currentTask.status = DEFAULT_STATUS;
      }
      continue;
    }

    // Parse dependencies
    const depsMatch = line.match(/\*\*Dependencies:\*\*\s*(.+)/i);
    if (depsMatch) {
      const deps = depsMatch[1]
        .split(',')
        .map(d => d.trim())
        .filter(d => d);
      currentTask.dependencies = deps;
      continue;
    }

    // Parse description
    const descMatch = line.match(/\*\*Description:\*\*/i);
    if (descMatch) {
      // Read the next line(s) as the description content
      let j = i + 1;
      const descLines: string[] = [];
      while (j < lines.length && lines[j].trim() && !lines[j].trim().startsWith('**')) {
        descLines.push(lines[j].trim());
        j++;
      }
      currentTask.description = descLines.join('\n');
      i = j - 1;
      continue;
    }

    // Parse acceptance criteria checkboxes
    const criteriaMatch = line.match(/^-\s+\[\s*\]\s*(.+)/);
    if (criteriaMatch) {
      currentTask.acceptanceCriteria?.push(criteriaMatch[1]);
      continue;
    }

    // Parse spec reference
    const specMatch = line.match(/\*\*Spec Reference:\*\*\s*\[([^\]]+)\]\(([^)]+)\)/i);
    if (specMatch) {
      currentTask.specReference = specMatch[2];
      continue;
    }
  }

  // Save last task (only need title, ID can be auto-generated)
  if (currentTask?.title) {
    tasks.push(currentTask as RalphTask);
  }

  // Generate ID from title if not present
  tasks.forEach((task, index) => {
    if (!task.id) {
      task.id = `task-${String(index + 1).padStart(3, '0')}`;
    }
  });

  return {
    projectName: 'Project',
    description: markdown.match(/## Overview\s*\n\s*(.+)/)?.[1] || '',
    overview: '',
    tasks,
    generatedAt: new Date().toISOString(),
    totalTasks: tasks.length,
  };
}

/**
 * Sorts tasks by dependency order (topological sort)
 * Returns tasks in order they should be executed
 */
export function sortTasksByDependencies(tasks: RalphTask[]): RalphTask[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const sorted: RalphTask[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(taskId: string): void {
    if (temp.has(taskId)) {
      throw new Error(`Circular dependency detected involving ${taskId}`);
    }
    if (visited.has(taskId)) return;

    temp.add(taskId);

    const task = taskMap.get(taskId);
    if (task) {
      for (const depId of task.dependencies) {
        visit(depId);
      }
    }

    temp.delete(taskId);
    visited.add(taskId);

    if (task) {
      sorted.push(task);
    }
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return sorted;
}

/**
 * Gets the next pending task that has all dependencies met
 * Tasks with status "Implemented", "Verified", or "In Progress" are considered already completed
 * and will not be returned for execution
 */
export function getNextTask(plan: RalphPlan, completedTaskIds: Set<string>): RalphTask | null {
  for (const task of plan.tasks) {
    // Skip tasks that are already completed in the session
    const isCompleted = completedTaskIds.has(task.id);

    // Skip tasks with terminal or in-progress status
    // - "Implemented" and "Verified": already done, should not be executed
    // - "In Progress": already being worked on, should not be executed
    const shouldSkipStatus =
      task.status === 'Implemented' ||
      task.status === 'Verified' ||
      task.status === 'In Progress';

    const dependenciesMet = task.dependencies.every(dep => {
      // Check if dependency is in completed tasks
      if (completedTaskIds.has(dep)) return true;

      // Check if dependency task has terminal or in-progress status
      const depTask = plan.tasks.find(t => t.id === dep);
      if (depTask && (
        depTask.status === 'Implemented' ||
        depTask.status === 'Verified' ||
        depTask.status === 'In Progress'
      )) {
        return true;
      }

      return false;
    });

    if (!isCompleted && !shouldSkipStatus && dependenciesMet) {
      return task;
    }
  }
  return null;
}

/**
 * Calculates completion progress
 */
export function calculateProgress(plan: RalphPlan, completedTaskIds: Set<string>): ProgressInfo {
  const completed = plan.tasks.filter(t => completedTaskIds.has(t.id)).length;
  const total = plan.tasks.length;
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
