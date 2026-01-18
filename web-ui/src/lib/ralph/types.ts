/**
 * Ralph TUI Orchestrator - Type definitions
 *
 * These types represent the structured data from Ralph implementation plans.
 */

export interface RalphTask {
  /** Task identifier (e.g., "task-001", "task-002") */
  id: string;
  /** Human-readable task title */
  title: string;
  /** Detailed description of what to implement */
  description: string;
  /** Task priority level */
  priority: 'high' | 'medium' | 'low';
  /** Array of task IDs that must complete first */
  dependencies: string[];
  /** Array of checkboxes for completion verification */
  acceptanceCriteria: string[];
  /** Optional path to spec file */
  specReference?: string;
  /** Estimated complexity: 1=trivial, 5=complex */
  estimatedComplexity?: 1 | 2 | 3 | 4 | 5;
  /** Optional tags for filtering/grouping */
  tags?: string[];
}

export interface RalphPlan {
  /** Project name */
  projectName: string;
  /** Project description */
  description: string;
  /** Project overview */
  overview: string;
  /** Array of tasks in the plan */
  tasks: RalphTask[];
  /** ISO timestamp when plan was generated */
  generatedAt: string;
  /** Total number of tasks */
  totalTasks: number;
  /** Rough estimate like "2-3 days" */
  estimatedDuration?: string;
}

export interface RalphProgress {
  /** Number of completed tasks */
  completed: number;
  /** Total number of tasks */
  total: number;
  /** Completion percentage (0-100) */
  percentage: number;
}
