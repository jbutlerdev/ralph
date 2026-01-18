/**
 * Ralph Plan Generator
 *
 * Utilities for generating, parsing, and validating Ralph implementation plans.
 */

import type { RalphPlan, RalphTask } from './types/index.js';

/**
 * Converts a Ralph plan to Markdown format for human review
 */
export function planToMarkdown(plan: RalphPlan): string {
  let md = `# Implementation Plan\n\n`;
  md += `## Overview\n\n${plan.description}\n\n`;
  md += `**Project:** ${plan.projectName}\n`;
  md += `**Total Tasks:** ${plan.totalTasks}\n`;
  if (plan.estimatedDuration) {
    md += `**Estimated Duration:** ${plan.estimatedDuration}\n`;
  }
  md += `\n---\n\n## Tasks\n\n`;

  for (const task of plan.tasks) {
    md += `### ${task.id}: ${task.title}\n\n`;
    md += `**ID:** ${task.id}\n`;
    md += `**Priority:** ${task.priority}\n`;
    if (task.dependencies.length > 0) {
      md += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
    }
    if (task.estimatedComplexity) {
      md += `**Complexity:** ${task.estimatedComplexity}/5\n`;
    }
    if (task.tags && task.tags.length > 0) {
      md += `**Tags:** ${task.tags.join(', ')}\n`;
    }
    md += `\n`;
    md += `**Description:**\n${task.description}\n\n`;
    md += `**Acceptance Criteria:**\n`;
    for (const criterion of task.acceptanceCriteria) {
      md += `- [ ] ${criterion}\n`;
    }
    if (task.specReference) {
      md += `\n**Spec Reference:** [${task.specReference}](${task.specReference})\n`;
    }
    md += `\n---\n\n`;
  }

  md += `\n*Generated on ${plan.generatedAt}*\n`;

  return md;
}

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
 */
export function getNextTask(plan: RalphPlan, completedTaskIds: Set<string>): RalphTask | null {
  for (const task of plan.tasks) {
    const isCompleted = completedTaskIds.has(task.id);
    const dependenciesMet = task.dependencies.every(dep => completedTaskIds.has(dep));

    if (!isCompleted && dependenciesMet) {
      return task;
    }
  }
  return null;
}

/**
 * Calculates completion progress
 */
export function calculateProgress(plan: RalphPlan, completedTaskIds: Set<string>): {
  completed: number;
  total: number;
  percentage: number;
} {
  const completed = plan.tasks.filter(t => completedTaskIds.has(t.id)).length;
  const total = plan.tasks.length;
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Filters tasks by priority
 */
export function filterByPriority(plan: RalphPlan, priority: RalphTask['priority']): RalphTask[] {
  return plan.tasks.filter(t => t.priority === priority);
}

/**
 * Filters tasks by tag
 */
export function filterByTag(plan: RalphPlan, tag: string): RalphTask[] {
  return plan.tasks.filter(t => t.tags?.includes(tag));
}

/**
 * Gets task by ID
 */
export function getTaskById(plan: RalphPlan, taskId: string): RalphTask | undefined {
  return plan.tasks.find(t => t.id === taskId);
}

/**
 * Load a plan from a file path
 */
export async function loadPlan(planPath: string): Promise<RalphPlan> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(planPath, 'utf-8');
  return planFromMarkdown(content);
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
