/**
 * Ralph Plan Generator Skill
 *
 * This skill generates a structured implementation plan for the Ralph Wiggum technique.
 * The output includes tasks with proper IDs, priorities, dependencies, and acceptance criteria
 * that can be consumed by TypeScript code for looping.
 */
/**
 * Generates a Ralph-compatible implementation plan from requirements
 */
export async function generateRalphPlan(requirements, options) {
    const { projectName = 'Project', maxComplexity = 5, includeSpecs = true, } = options || {};
    // This skill should be called by Claude with the actual implementation
    // The skill provides the structure and guidance for plan generation
    throw new Error('This skill must be invoked through the Claude skill system');
}
/**
 * Validates a Ralph plan for consistency and completeness
 */
export function validateRalphPlan(plan) {
    const errors = [];
    const warnings = [];
    // Check for at least one task
    if (plan.tasks.length === 0) {
        errors.push('Plan must contain at least one task');
        return { valid: false, errors, warnings };
    }
    // Validate each task
    const taskIds = new Set();
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
    // Validate dependencies reference existing tasks
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
function detectCircularDependencies(tasks) {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];
    function dfs(taskId, path) {
        if (recursionStack.has(taskId)) {
            const cycleStart = path.indexOf(taskId);
            const cycle = path.slice(cycleStart).concat(taskId).join(' -> ');
            cycles.push(cycle);
            return;
        }
        if (visited.has(taskId))
            return;
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
 * Converts a Ralph plan to Markdown format for human review
 */
export function planToMarkdown(plan) {
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
export function planFromMarkdown(markdown) {
    const tasks = [];
    const lines = markdown.split('\n');
    let currentTask = null;
    // Parse implementation plan section
    let inTasksSection = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Detect tasks section
        if (line.toLowerCase() === '## tasks') {
            inTasksSection = true;
            continue;
        }
        if (!inTasksSection)
            continue;
        // Detect task header: ### Task N: Title or ### Title
        const taskHeaderMatch = line.match(/^###\s+(Task\s+\d+:\s*)?(.+)$/);
        if (taskHeaderMatch) {
            // Save previous task
            if (currentTask?.id && currentTask?.title) {
                tasks.push(currentTask);
            }
            // Start new task
            currentTask = {
                title: taskHeaderMatch[2],
                dependencies: [],
                acceptanceCriteria: [],
            };
            continue;
        }
        if (!currentTask)
            continue;
        // Parse ID field
        const idMatch = line.match(/\*\*ID:\*\*\s*(task-\d+)/i);
        if (idMatch) {
            currentTask.id = idMatch[1];
            continue;
        }
        // Parse priority
        const priorityMatch = line.match(/\*\*Priority:\*\*\s*(high|medium|low)/i);
        if (priorityMatch) {
            currentTask.priority = priorityMatch[1].toLowerCase();
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
        // Parse description (may span multiple lines until next ** field)
        const descMatch = line.match(/\*\*Description:\*\*\s*(.+)/i);
        if (descMatch) {
            currentTask.description = descMatch[1];
            // Read subsequent lines that are part of the description
            // Description continues until empty line or next field marker (**)
            let j = i + 1;
            while (j < lines.length && lines[j].trim() && !lines[j].trim().startsWith('**')) {
                currentTask.description += '\n' + lines[j].trim();
                j++;
            }
            // Skip the lines we just consumed
            i = j - 1;
            continue;
        }
        // Parse acceptance criteria checkboxes
        const criteriaMatch = line.match(/^-\s+\[\s*\]\s*(.+)/);
        if (criteriaMatch) {
            (currentTask.acceptanceCriteria ??= []).push(criteriaMatch[1]);
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
        tasks.push(currentTask);
    }
    // Auto-generate task IDs for tasks that are missing them
    // Uses sequential numbering: task-001, task-002, etc.
    tasks.forEach((task, index) => {
        if (!task.id) {
            task.id = `task-${String(index + 1).padStart(3, '0')}`;
        }
    });
    // Build the plan object from parsed markdown
    // Note: projectName is parsed from the Overview section if present
    const projectMatch = markdown.match(/\*\*Project:\*\*\s*([^\n]+)/i);
    const overviewMatch = markdown.match(/## Overview\s*\n\s*([^\n]+)/);
    return {
        projectName: projectMatch?.[1]?.trim() || 'Project',
        description: overviewMatch?.[1]?.trim() || '',
        overview: overviewMatch?.[1]?.trim() || '',
        tasks,
        generatedAt: new Date().toISOString(),
        totalTasks: tasks.length,
    };
}
/**
 * Sorts tasks by dependency order (topological sort)
 * Returns tasks in order they should be executed
 */
export function sortTasksByDependencies(tasks) {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const sorted = [];
    const visited = new Set();
    const temp = new Set();
    function visit(taskId) {
        if (temp.has(taskId)) {
            throw new Error(`Circular dependency detected involving ${taskId}`);
        }
        if (visited.has(taskId))
            return;
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
export function getNextTask(plan, completedTaskIds) {
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
export function calculateProgress(plan, completedTaskIds) {
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
export function filterByPriority(plan, priority) {
    return plan.tasks.filter(t => t.priority === priority);
}
/**
 * Filters tasks by tag
 */
export function filterByTag(plan, tag) {
    return plan.tasks.filter(t => t.tags?.includes(tag));
}
/**
 * Gets task by ID
 */
export function getTaskById(plan, taskId) {
    return plan.tasks.find(t => t.id === taskId);
}
/**
 * Plan storage configuration
 */
export const PLANS_DIR = 'plans';
export const PLAN_FILE_MD = 'IMPLEMENTATION_PLAN.md';
export const PLAN_FILE_JSON = 'IMPLEMENTATION_PLAN.json';
/**
 * Returns the file paths for a plan
 * @param planName - The name of the plan (folder name)
 * @returns Object with mdPath and jsonPath
 */
export function getPlanPath(planName) {
    const dir = `${PLANS_DIR}/${planName}`;
    return {
        dir,
        mdPath: `${dir}/${PLAN_FILE_MD}`,
        jsonPath: `${dir}/${PLAN_FILE_JSON}`,
    };
}
/**
 * Lists all available plans by scanning the plans directory
 * @returns Array of plan names (folder names)
 */
export async function listAllPlans() {
    try {
        const fs = await import('fs/promises');
        const path = await import('path');
        // Check if plans directory exists
        try {
            await fs.access(PLANS_DIR);
        }
        catch {
            // Directory doesn't exist, return empty array
            return [];
        }
        const entries = await fs.readdir(PLANS_DIR, { withFileTypes: true });
        const plans = [];
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const planPath = path.join(PLANS_DIR, entry.name);
                const mdPath = path.join(planPath, PLAN_FILE_MD);
                // Only include if it has an IMPLEMENTATION_PLAN.md file
                try {
                    await fs.access(mdPath);
                    plans.push(entry.name);
                }
                catch {
                    // No plan file in this directory, skip it
                }
            }
        }
        return plans.sort();
    }
    catch (error) {
        console.error('Error listing plans:', error);
        return [];
    }
}
/**
 * Loads a plan from disk
 * @param planName - The name of the plan (folder name)
 * @returns The parsed RalphPlan object
 * @throws Error if plan file doesn't exist or can't be parsed
 */
export async function loadPlan(planName) {
    const fs = await import('fs/promises');
    const { mdPath } = getPlanPath(planName);
    try {
        const content = await fs.readFile(mdPath, 'utf-8');
        return planFromMarkdown(content);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Plan not found: ${planName}`);
        }
        throw error;
    }
}
/**
 * Saves a plan to disk in both Markdown and JSON formats
 * @param planName - The name of the plan (folder name)
 * @param plan - The RalphPlan object to save
 */
export async function savePlan(planName, plan) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { dir, mdPath, jsonPath } = getPlanPath(planName);
    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });
    // Save Markdown version
    const markdown = planToMarkdown(plan);
    await fs.writeFile(mdPath, markdown, 'utf-8');
    // Save JSON version
    const json = JSON.stringify(plan, null, 2);
    await fs.writeFile(jsonPath, json, 'utf-8');
}
//# sourceMappingURL=ralph-plan-generator.skill.js.map