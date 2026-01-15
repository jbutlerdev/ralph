/**
 * Plan Store - Manages implementation plan and task state
 *
 * This store tracks the implementation plan parsed from IMPLEMENTATION_PLAN.md,
 * task statuses, progress tracking, and user selections.
 */

import { create } from 'zustand';

/**
 * Task status enum
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

/**
 * Task priority
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task interface
 */
export interface Task {
  /** Unique task identifier (e.g., task-001) */
  id: string;

  /** Task title */
  title: string;

  /** Detailed task description */
  description: string;

  /** Current status */
  status: TaskStatus;

  /** Priority level */
  priority: TaskPriority;

  /** Array of task IDs this task depends on */
  dependencies: string[];

  /** Git commit hash when task was completed */
  commitHash: string | null;

  /** Checkpoint ID for task recovery */
  checkpointId: string | null;

  /** Number of attempts made */
  attempts: number;

  /** Error message if task failed */
  error: string | null;

  /** Task completion timestamp */
  completedAt: Date | null;
}

/**
 * Implementation plan interface
 */
export interface ImplementationPlan {
  /** Plan title */
  title: string;

  /** Plan description */
  description: string;

  /** Array of tasks */
  tasks: Task[];

  /** Plan creation timestamp */
  createdAt: Date;

  /** Last modified timestamp */
  updatedAt: Date;
}

/**
 * Plan state interface
 */
export interface PlanState {
  /** Current implementation plan */
  plan: ImplementationPlan | null;

  /** Array of all tasks */
  tasks: Task[];

  /** Current task index being executed */
  currentTaskIndex: number;

  /** Array of completed task IDs */
  completedTasks: string[];

  /** Currently selected task ID */
  selectedTaskId: string | null;

  /** Whether plan is being edited */
  isEditing: boolean;

  /** Plan validation errors */
  validationErrors: string[];
}

/**
 * Plan store actions
 */
export interface PlanActions {
  /** Set the implementation plan */
  setPlan: (plan: ImplementationPlan) => void;

  /** Update a specific task */
  updateTask: (taskId: string, updates: Partial<Task>) => void;

  /** Set task status */
  setTaskStatus: (taskId: string, status: TaskStatus) => void;

  /** Set current task index */
  setCurrentTaskIndex: (index: number) => void;

  /** Mark task as completed */
  completeTask: (taskId: string, commitHash: string) => void;

  /** Set selected task */
  setSelectedTaskId: (taskId: string | null) => void;

  /** Add validation error */
  addValidationError: (error: string) => void;

  /** Clear validation errors */
  clearValidationErrors: () => void;

  /** Set editing state */
  setEditing: (isEditing: boolean) => void;

  /** Reset plan state */
  resetPlan: () => void;

  /** Get next pending task */
  getNextPendingTask: () => Task | null;

  /** Check if task dependencies are satisfied */
  areDependenciesMet: (taskId: string) => boolean;

  /** Get task by ID */
  getTaskById: (taskId: string) => Task | null;

  /** Get progress percentage */
  getProgress: () => number;
}

/**
 * Initial plan state
 */
const initialState: PlanState = {
  plan: null,
  tasks: [],
  currentTaskIndex: 0,
  completedTasks: [],
  selectedTaskId: null,
  isEditing: false,
  validationErrors: [],
};

/**
 * Plan store type
 */
export type PlanStore = PlanState & PlanActions;

/**
 * Plan store - manages implementation plan and tasks
 */
export const usePlanStore = create<PlanStore>((set, get) => ({
  ...initialState,

  setPlan: (plan) =>
    set({
      plan,
      tasks: plan.tasks,
      completedTasks: [],
      currentTaskIndex: 0,
    }),

  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
      plan: state.plan
        ? {
            ...state.plan,
            tasks: state.plan.tasks.map((task) =>
              task.id === taskId ? { ...task, ...updates } : task
            ),
          }
        : null,
    })),

  setTaskStatus: (taskId, status) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, status } : task
      ),
    })),

  setCurrentTaskIndex: (index) => set({ currentTaskIndex: index }),

  completeTask: (taskId, commitHash) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: 'completed',
              commitHash,
              completedAt: new Date(),
            }
          : task
      ),
      completedTasks: [...state.completedTasks, taskId],
    })),

  setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),

  addValidationError: (error) =>
    set((state) => ({
      validationErrors: [...state.validationErrors, error],
    })),

  clearValidationErrors: () => set({ validationErrors: [] }),

  setEditing: (isEditing) => set({ isEditing }),

  resetPlan: () => set(initialState),

  getNextPendingTask: () => {
    const state = get();
    for (const task of state.tasks) {
      if (
        task.status === 'pending' &&
        get().areDependenciesMet(task.id)
      ) {
        return task;
      }
    }
    return null;
  },

  areDependenciesMet: (taskId) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task || task.dependencies.length === 0) {
      return true;
    }
    return task.dependencies.every((depId) =>
      state.completedTasks.includes(depId)
    );
  },

  getTaskById: (taskId) => {
    const state = get();
    return state.tasks.find((t) => t.id === taskId) || null;
  },

  getProgress: () => {
    const state = get();
    if (state.tasks.length === 0) {
      return 0;
    }
    return (state.completedTasks.length / state.tasks.length) * 100;
  },
}));
