/**
 * Ralph Plan Utilities
 *
 * A subset of plan generator utilities for use in the web UI.
 * These are copied from the main Ralph package to avoid module resolution issues.
 */

import * as path from 'node:path';

/**
 * Valid status values for a task in the plan
 */
export type TaskStatus = 'To Do' | 'In Progress' | 'Implemented' | 'Needs Re-Work' | 'Verified';

/**
 * Individual acceptance criterion with its completion state
 */
export interface AcceptanceCriterion {
  text: string;
  completed: boolean;
}

/**
 * Task interface
 */
export interface RalphTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  specReference?: string;
  estimatedComplexity?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  status: TaskStatus;
}

/**
 * Plan interface
 */
export interface RalphPlan {
  projectName: string;
  description: string;
  overview: string;
  tasks: RalphTask[];
  generatedAt: string;
  totalTasks: number;
  estimatedDuration?: string;
}

/**
 * Converts a Markdown implementation plan to a RalphPlan object
 */
const VALID_STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Implemented', 'Needs Re-Work', 'Verified'];
const DEFAULT_STATUS: TaskStatus = 'To Do';

export function planFromMarkdown(markdown: string, projectDir?: string): RalphPlan {
  const tasks: RalphTask[] = [];
  const lines = markdown.split('\n');
  let currentTask: Partial<RalphTask> | null = null;
  let projectName: string | undefined;

  // Parse implementation plan section
  let inTasksSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect tasks section
    if (line.toLowerCase() === '## tasks') {
      inTasksSection = true;
      continue;
    }

    // Parse **Project:** field from header section
    if (!inTasksSection) {
      const projectMatch = line.match(/^\*\*Project:\*\*\s*(.+)$/i);
      if (projectMatch) {
        projectName = projectMatch[1].trim();
        continue;
      }
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
        acceptanceCriteria: [] as AcceptanceCriterion[],
        priority: 'medium',
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

    // Parse acceptance criteria checkboxes (both [x] for checked and [ ] for unchecked)
    const criteriaMatch = line.match(/^-\s+\[([ x])\]\s*(.+)/i);
    if (criteriaMatch) {
      const isChecked = criteriaMatch[1].toLowerCase() === 'x';
      (currentTask.acceptanceCriteria as AcceptanceCriterion[]).push({
        text: criteriaMatch[2],
        completed: isChecked
      });
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

  // Generate ID from title if not present and ensure status is set
  tasks.forEach((task, index) => {
    if (!task.id) {
      task.id = `task-${String(index + 1).padStart(3, '0')}`;
    }
    // Ensure status is set
    if (!task.status) {
      task.status = DEFAULT_STATUS;
    }
  });

  // Determine project name:
  // 1. Use parsed **Project:** field from markdown
  // 2. Otherwise derive from directory name if provided
  // 3. Otherwise default to 'Project'
  let finalProjectName = projectName;
  if (!finalProjectName && projectDir) {
    // Extract directory name from path
    finalProjectName = path.basename(projectDir);
  }
  if (!finalProjectName) {
    finalProjectName = 'Project';
  }

  return {
    projectName: finalProjectName,
    description: markdown.match(/## Overview\s*\n\s*(.+)/)?.[1] || '',
    overview: '',
    tasks,
    generatedAt: new Date().toISOString(),
    totalTasks: tasks.length,
  };
}

/**
 * Validates a Ralph plan for consistency and completeness
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
 * Detects circular dependencies in the task graph
 */
function detectCircularDependencies(tasks: RalphTask[]): string[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
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

/**
 * Load a plan from a file path
 */
export async function loadPlan(planPath: string, projectRoot?: string): Promise<RalphPlan> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const content = await fs.readFile(planPath, 'utf-8');
  // Extract directory name from plan path as default project name
  const projectDir = projectRoot || path.dirname(planPath);
  return planFromMarkdown(content, projectDir);
}

/**
 * List all available plans in the project
 */
export async function listAllPlans(projectRoot: string = process.cwd()): Promise<string[]> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const plansDir = path.join(projectRoot, 'plans');

  const planNames: string[] = [];

  try {
    const entries = await fs.readdir(plansDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const planPath = path.join(plansDir, entry.name, 'IMPLEMENTATION_PLAN.md');
        try {
          await fs.access(planPath);
          planNames.push(entry.name);
        } catch {
          // No IMPLEMENTATION_PLAN.md in this directory
        }
      }
    }
  } catch {
    // plans directory doesn't exist
  }

  return planNames;
}
