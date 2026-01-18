/**
 * Ralph Plan Parser
 *
 * Utilities for reading and parsing Ralph implementation plans from Markdown.
 */

import type { RalphPlan, RalphTask, RalphProgress } from './types';

/**
 * Converts a Markdown implementation plan to a RalphPlan object.
 * Parses the structured format defined in CLAUDE.md.
 *
 * @param markdown - The Markdown content to parse
 * @returns A parsed RalphPlan object
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
      // Save previous task
      if (currentTask?.id && currentTask?.title) {
        tasks.push(currentTask as RalphTask);
      }
      // Start new task
      currentTask = {
        title: taskHeaderMatch[2],
        dependencies: [],
        acceptanceCriteria: [],
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

    // Parse dependencies
    const depsMatch = line.match(/\*\*Dependencies:\*\*\s*(.+)/i);
    if (depsMatch) {
      const deps = depsMatch[1]
        .split(',')
        .map((d) => d.trim())
        .filter((d) => d);
      currentTask.dependencies = deps;
      continue;
    }

    // Parse complexity
    const complexityMatch = line.match(/\*\*Complexity:\*\*\s*(\d)\/5/i);
    if (complexityMatch && currentTask) {
      currentTask.estimatedComplexity = Number.parseInt(complexityMatch[1], 10) as 1 | 2 | 3 | 4 | 5;
      continue;
    }

    // Parse tags
    const tagsMatch = line.match(/\*\*Tags:\*\*\s*(.+)/i);
    if (tagsMatch && currentTask) {
      currentTask.tags = tagsMatch[1].split(',').map((t) => t.trim()).filter((t) => t);
      continue;
    }

    // Parse description
    const descMatch = line.match(/\*\*Description:\*\*\s*(.+)/i);
    if (descMatch) {
      currentTask.description = descMatch[1];
      // Continue reading multi-line description
      let j = i + 1;
      while (j < lines.length && lines[j].trim() && !lines[j].trim().startsWith('**')) {
        currentTask.description += '\n' + lines[j].trim();
        j++;
      }
      i = j - 1;
      continue;
    }

    // Parse acceptance criteria checkboxes
    const criteriaMatch = line.match(/^-\s+\[\s*\]\s*(.+)/);
    if (criteriaMatch) {
      currentTask.acceptanceCriteria.push(criteriaMatch[1]);
      continue;
    }

    // Parse spec reference
    const specMatch = line.match(/\*\*Spec Reference:\*\*\s*\[([^\]]+)\]\(([^)]+)\)/i);
    if (specMatch) {
      currentTask.specReference = specMatch[2];
      continue;
    }
  }

  // Save last task
  if (currentTask?.id && currentTask?.title) {
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
 * Sorts tasks by dependency order using topological sort.
 * Returns tasks in the order they should be executed.
 *
 * @param tasks - Array of tasks to sort
 * @returns Tasks sorted by dependency order
 * @throws Error if circular dependencies are detected
 */
export function sortTasksByDependencies(tasks: RalphTask[]): RalphTask[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
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
 * Gets the next pending task that has all dependencies met.
 *
 * @param plan - The Ralph plan to search
 * @param completedTaskIds - Set of completed task IDs
 * @returns The next task, or null if no task is ready
 */
export function getNextTask(plan: RalphPlan, completedTaskIds: Set<string>): RalphTask | null {
  for (const task of plan.tasks) {
    const isCompleted = completedTaskIds.has(task.id);
    const dependenciesMet = task.dependencies.every((dep) => completedTaskIds.has(dep));

    if (!isCompleted && dependenciesMet) {
      return task;
    }
  }
  return null;
}

/**
 * Calculates completion progress for a plan.
 *
 * @param plan - The Ralph plan to calculate progress for
 * @param completedTaskIds - Set of completed task IDs
 * @returns Progress information including completed count, total, and percentage
 */
export function calculateProgress(plan: RalphPlan, completedTaskIds: Set<string>): RalphProgress {
  const completed = plan.tasks.filter((t) => completedTaskIds.has(t.id)).length;
  const total = plan.tasks.length;
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Filters tasks by priority level.
 *
 * @param plan - The Ralph plan to filter
 * @param priority - The priority level to filter by
 * @returns Tasks matching the specified priority
 */
export function filterByPriority(plan: RalphPlan, priority: RalphTask['priority']): RalphTask[] {
  return plan.tasks.filter((t) => t.priority === priority);
}

/**
 * Filters tasks by tag.
 *
 * @param plan - The Ralph plan to filter
 * @param tag - The tag to filter by
 * @returns Tasks matching the specified tag
 */
export function filterByTag(plan: RalphPlan, tag: string): RalphTask[] {
  return plan.tasks.filter((t) => t.tags?.includes(tag));
}

/**
 * Gets a task by its ID.
 *
 * @param plan - The Ralph plan to search
 * @param taskId - The task ID to find
 * @returns The task if found, undefined otherwise
 */
export function getTaskById(plan: RalphPlan, taskId: string): RalphTask | undefined {
  return plan.tasks.find((t) => t.id === taskId);
}

/**
 * Validates a Ralph plan for consistency and completeness.
 *
 * @param plan - The Ralph plan to validate
 * @returns Validation result with errors and warnings
 */
export function validateRalphPlan(plan: RalphPlan): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for task IDs
  if (plan.tasks.length === 0) {
    errors.push('Plan must contain at least one task');
    return { valid: false, errors, warnings };
  }

  // Validate each task
  const taskIds = new Set<string>();
  plan.tasks.forEach((task, index) => {
    // Validate ID format
    if (!task.id.match(/^task-\d+$/)) {
      errors.push(`Task ${index + 1} has invalid ID format: ${task.id} (expected: task-XXX)`);
    }

    // Check for duplicate IDs
    if (taskIds.has(task.id)) {
      errors.push(`Duplicate task ID: ${task.id}`);
    }
    taskIds.add(task.id);

    // Validate required fields
    if (!task.title.trim()) {
      errors.push(`Task ${task.id} is missing a title`);
    }
    if (!task.description.trim()) {
      errors.push(`Task ${task.id} is missing a description`);
    }
    if (task.acceptanceCriteria.length === 0) {
      warnings.push(`Task ${task.id} has no acceptance criteria`);
    }
  });

  // Validate dependencies
  plan.tasks.forEach((task) => {
    task.dependencies.forEach((depId) => {
      if (!taskIds.has(depId)) {
        errors.push(`Task ${task.id} depends on non-existent task: ${depId}`);
      }
    });
  });

  // Check for circular dependencies
  const circularDeps = detectCircularDependencies(plan.tasks);
  if (circularDeps.length > 0) {
    errors.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detects circular dependencies in the task graph.
 *
 * @param tasks - Array of tasks to check
 * @returns Array of circular dependency paths found
 */
function detectCircularDependencies(tasks: RalphTask[]): string[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[] = [];

  function dfs(taskId: string, path: string[]): void {
    if (recursionStack.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      const cycle = path.slice(cycleStart).concat(taskId).join(' -> ');
      cycles.push(cycle);
      return;
    }

    if (visited.has(taskId)) return;

    visited.add(taskId);
    recursionStack.add(taskId);
    path.push(taskId);

    const task = taskMap.get(taskId);
    if (task) {
      for (const depId of task.dependencies) {
        dfs(depId, path);
      }
    }

    path.pop();
    recursionStack.delete(taskId);
  }

  for (const task of tasks) {
    dfs(task.id, []);
  }

  return cycles;
}
