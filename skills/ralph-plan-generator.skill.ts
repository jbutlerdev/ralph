/**
 * Ralph Plan Generator Skill
 *
 * This skill generates a structured implementation plan for Ralph Wiggum technique.
 * The output includes tasks with proper IDs, priorities, dependencies, and acceptance criteria
 * that can be consumed by TypeScript code for looping.
 *
 * This skill now re-exports all functionality from main Ralph package.
 */

// Import types from main package
import type {
  RalphTask,
  RalphPlan,
  RalphExecutorOptions,
  TaskExecution,
  TaskResult,
  RalphExecutionSession,
  ExecutionResult,
  ServerConfig,
  ExecutionRequest,
} from '../dist/types/index.js';

// Re-export everything from main package
export {
  planToMarkdown,
  planFromMarkdown,
  validateRalphPlan,
  sortTasksByDependencies,
  getNextTask,
  calculateProgress,
  filterByPriority,
  filterByTag,
  getTaskById,
  loadPlan,
  listAllPlans,
} from '../dist/plan-generator.js';

// Re-export types
export type {
  RalphTask,
  RalphPlan,
  RalphExecutorOptions,
  TaskExecution,
  TaskResult,
  RalphExecutionSession,
  ExecutionResult,
  ServerConfig,
  ExecutionRequest,
};

/**
 * Generates a Ralph-compatible implementation plan from requirements
 *
 * This is a placeholder function that should be invoked through Claude skill system.
 * Claude will analyze requirements and generate a structured implementation plan.
 */
export async function generateRalphPlan(
  requirements: string,
  options?: {
    projectName?: string;
    maxComplexity?: number;
    includeSpecs?: boolean;
  }
): Promise<RalphPlan> {
  const {
    projectName = 'Project',
    maxComplexity = 5,
    includeSpecs = true,
  } = options || {};

  // This skill should be called by Claude with the actual implementation
  // The skill provides the structure and guidance for plan generation
  throw new Error('This skill must be invoked through the Claude skill system');
}
