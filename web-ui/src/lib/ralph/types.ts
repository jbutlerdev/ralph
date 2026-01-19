/**
 * Ralph Type Definitions
 *
 * Shared types used across the Ralph project for the Web UI.
 * These are copied from the main Ralph project for browser compatibility.
 */

/**
 * Valid status values for a task in the plan
 */
export type TaskStatus = 'To Do' | 'In Progress' | 'Implemented' | 'Needs Re-Work' | 'Verified';

/**
 * A single task in a Ralph implementation plan
 */
export interface RalphTask {
  id: string;                  // e.g., "task-001", "task-002"
  title: string;               // Human-readable task title
  description: string;         // Detailed description of what to implement
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];      // Array of task IDs that must complete first
  acceptanceCriteria: string[]; // Array of checkboxes for completion verification
  specReference?: string;      // Optional path to spec file
  estimatedComplexity?: 1 | 2 | 3 | 4 | 5; // 1=trivial, 5=complex
  tags?: string[];             // Optional tags for filtering/grouping
  status: TaskStatus;          // Current status of the task (default: "To Do")
}

/**
 * A complete Ralph implementation plan
 */
export interface RalphPlan {
  projectName: string;
  description: string;
  overview: string;
  tasks: RalphTask[];
  generatedAt: string;
  totalTasks: number;
  estimatedDuration?: string; // Rough estimate like "2-3 days"
}

/**
 * Progress calculation result
 */
export interface ProgressInfo {
  completed: number;
  total: number;
  percentage: number;
}
