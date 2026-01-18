/**
 * Ralph Plan Generator Skill
 *
 * This skill generates a structured implementation plan for the Ralph Wiggum technique.
 * The output includes tasks with proper IDs, priorities, dependencies, and acceptance criteria
 * that can be consumed by TypeScript code for looping.
 */
export interface RalphTask {
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
    acceptanceCriteria: string[];
    specReference?: string;
    estimatedComplexity?: 1 | 2 | 3 | 4 | 5;
    tags?: string[];
}
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
 * Generates a Ralph-compatible implementation plan from requirements
 */
export declare function generateRalphPlan(requirements: string, options?: {
    projectName?: string;
    maxComplexity?: number;
    includeSpecs?: boolean;
}): Promise<RalphPlan>;
/**
 * Validates a Ralph plan for consistency and completeness
 */
export declare function validateRalphPlan(plan: RalphPlan): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
/**
 * Converts a Ralph plan to Markdown format for human review
 */
export declare function planToMarkdown(plan: RalphPlan): string;
/**
 * Converts a Markdown implementation plan to a RalphPlan object
 * Parses the structured format defined in CLAUDE.md
 */
export declare function planFromMarkdown(markdown: string): RalphPlan;
/**
 * Sorts tasks by dependency order (topological sort)
 * Returns tasks in order they should be executed
 */
export declare function sortTasksByDependencies(tasks: RalphTask[]): RalphTask[];
/**
 * Gets the next pending task that has all dependencies met
 */
export declare function getNextTask(plan: RalphPlan, completedTaskIds: Set<string>): RalphTask | null;
/**
 * Calculates completion progress
 */
export declare function calculateProgress(plan: RalphPlan, completedTaskIds: Set<string>): {
    completed: number;
    total: number;
    percentage: number;
};
/**
 * Filters tasks by priority
 */
export declare function filterByPriority(plan: RalphPlan, priority: RalphTask['priority']): RalphTask[];
/**
 * Filters tasks by tag
 */
export declare function filterByTag(plan: RalphPlan, tag: string): RalphTask[];
/**
 * Gets task by ID
 */
export declare function getTaskById(plan: RalphPlan, taskId: string): RalphTask | undefined;
/**
 * Plan storage configuration
 */
export declare const PLANS_DIR = "plans";
export declare const PLAN_FILE_MD = "IMPLEMENTATION_PLAN.md";
export declare const PLAN_FILE_JSON = "IMPLEMENTATION_PLAN.json";
/**
 * Returns the file paths for a plan
 * @param planName - The name of the plan (folder name)
 * @returns Object with mdPath and jsonPath
 */
export declare function getPlanPath(planName: string): {
    mdPath: string;
    jsonPath: string;
    dir: string;
};
/**
 * Lists all available plans by scanning the plans directory
 * @returns Array of plan names (folder names)
 */
export declare function listAllPlans(): Promise<string[]>;
/**
 * Loads a plan from disk
 * @param planName - The name of the plan (folder name)
 * @returns The parsed RalphPlan object
 * @throws Error if plan file doesn't exist or can't be parsed
 */
export declare function loadPlan(planName: string): Promise<RalphPlan>;
/**
 * Saves a plan to disk in both Markdown and JSON formats
 * @param planName - The name of the plan (folder name)
 * @param plan - The RalphPlan object to save
 */
export declare function savePlan(planName: string, plan: RalphPlan): Promise<void>;
//# sourceMappingURL=ralph-plan-generator.skill.d.ts.map