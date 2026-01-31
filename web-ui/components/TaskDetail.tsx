'use client';

import { useState } from 'react';
import type { AcceptanceCriterion } from '@/lib/ralph/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  X,
  Tag,
  Link as LinkIcon,
  ListChecks,
  FileText,
  GitBranch,
  ArrowRight,
  Check,
  Network,
  Terminal,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RalphTask } from '@/lib/ralph/types';

export interface TaskDetailProps {
  task: RalphTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planTasks?: RalphTask[]; // Optional: all tasks in the plan for dependency graph
  onNavigateToTask?: (taskId: string) => void; // Callback for task navigation
  taskStatus?: 'pending' | 'in_progress' | 'completed' | 'failed'; // Optional task status
  planId?: string; // Plan ID for fetching logs and toggling criteria
  onOpenLogs?: () => void; // Callback to open logs modal
}

/**
 * TaskDetail component
 *
 * Displays a detailed view of a single task with:
 * - Full task information (title, ID, status, priority, complexity, tags)
 * - Complete description
 * - Acceptance criteria as checkboxes
 * - Dependencies section with links to parent tasks
 * - Dependent tasks section with links to child tasks
 * - Spec reference link if present
 * - Visual dependency information
 * - Full accessibility support
 */
export function TaskDetail({
  task,
  open,
  onOpenChange,
  planTasks = [],
  onNavigateToTask,
  taskStatus = 'pending',
  planId,
  onOpenLogs,
}: TaskDetailProps) {
  const [togglingCriterion, setTogglingCriterion] = useState<number | null>(null);

  // Calculate completed criteria count from task's acceptance criteria
  const completedCount = task.acceptanceCriteria.filter(c => c.completed).length;

  // Toggle acceptance criterion
  const handleToggleCriterion = async (index: number) => {
    if (!planId || togglingCriterion !== null) return;

    setTogglingCriterion(index);
    try {
      const response = await fetch(`/api/plans/${planId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: task.id,
          updateType: 'acceptanceCriteria',
          criterionIndex: index,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle acceptance criterion');
      }

      // Refresh would be handled by parent component
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to toggle acceptance criterion:', error);
      alert(error instanceof Error ? error.message : 'Failed to toggle acceptance criterion');
    } finally {
      setTogglingCriterion(null);
    }
  };
  const getPriorityColor = (priority: RalphTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
  };

  const getPriorityLabel = (priority: RalphTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'High Priority';
      case 'medium':
        return 'Medium Priority';
      case 'low':
        return 'Low Priority';
    }
  };

  const getComplexityLabel = (complexity?: number) => {
    if (!complexity) return undefined;
    switch (complexity) {
      case 1:
        return { label: 'Trivial', color: 'text-green-600 dark:text-green-400' };
      case 2:
        return { label: 'Simple', color: 'text-green-600 dark:text-green-400' };
      case 3:
        return { label: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400' };
      case 4:
        return { label: 'Complex', color: 'text-orange-600 dark:text-orange-400' };
      case 5:
        return { label: 'Very Complex', color: 'text-red-600 dark:text-red-400' };
    }
  };

  const getStatusColor = (status: 'pending' | 'in_progress' | 'completed' | 'failed') => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'failed':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusLabel = (status: 'pending' | 'in_progress' | 'completed' | 'failed') => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  const getStatusIcon = (status: 'pending' | 'in_progress' | 'completed' | 'failed') => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
      case 'in_progress':
        return <Circle className="h-4 w-4 fill-blue-500/20 text-blue-500" aria-hidden="true" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    }
  };

  // Find dependent tasks (tasks that depend on this task)
  const dependentTasks = planTasks.filter(t =>
    t.dependencies.includes(task.id)
  );

  // Find parent tasks (tasks this task depends on)
  const parentTasks = planTasks.filter(t =>
    task.dependencies.includes(t.id)
  );

  const complexityInfo = getComplexityLabel(task.estimatedComplexity);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                {/* Task ID */}
                <span className="text-xs sm:text-sm font-mono text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 rounded">
                  {task.id}
                </span>

                {/* Priority Badge */}
                <span
                  className={cn(
                    'text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full',
                    getPriorityColor(task.priority)
                  )}
                  aria-label={`Priority: ${task.priority}`}
                >
                  {getPriorityLabel(task.priority)}
                </span>

                {/* Complexity Badge */}
                {complexityInfo && (
                  <span
                    className={cn(
                      'text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground',
                      complexityInfo.color
                    )}
                    aria-label={`Complexity: ${complexityInfo.label}`}
                  >
                    {complexityInfo.label}
                  </span>
                )}

                {/* Status Badge */}
                <span
                  className={cn(
                    'text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1',
                    getStatusColor(taskStatus)
                  )}
                  aria-label={`Status: ${getStatusLabel(taskStatus)}`}
                >
                  {getStatusIcon(taskStatus)}
                  {getStatusLabel(taskStatus)}
                </span>
              </div>

              <DialogTitle className="text-xl sm:text-2xl">{task.title}</DialogTitle>
            </div>

            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none self-start"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <DialogDescription id="task-description">
            Full task details and requirements
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 mt-4">
          {/* Description */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Description
            </h3>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {task.description || 'No description provided.'}
            </p>
          </section>

          {/* Acceptance Criteria */}
          {task.acceptanceCriteria.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Acceptance Criteria
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({task.acceptanceCriteria.length} items, {completedCount} completed)
                </span>
              </h3>
              <ul
                className="space-y-2"
                role="list"
                aria-label="Acceptance criteria list"
              >
                {task.acceptanceCriteria.map((criterion, idx) => {
                  // Handle both object format {text, completed} and legacy string format
                  const criterionText = typeof criterion === 'object' ? criterion.text : criterion;
                  const isCompleted = typeof criterion === 'object' ? criterion.completed : false;
                  const isToggling = togglingCriterion === idx;

                  return (
                    <li
                      key={idx}
                      className={cn(
                        'flex items-start gap-3 text-sm group transition-colors',
                        isCompleted ? 'opacity-75' : ''
                      )}
                      role="listitem"
                    >
                      <button
                        onClick={() => handleToggleCriterion(idx)}
                        disabled={isToggling || !planId}
                        className={cn(
                          'mt-0.5 flex-shrink-0 transition-all',
                          planId && 'cursor-pointer hover:scale-110',
                          isToggling && 'opacity-50 cursor-not-allowed'
                        )}
                        aria-label={isCompleted ? `Mark "${criterionText}" as incomplete` : `Mark "${criterionText}" as complete`}
                      >
                        {isCompleted ? (
                          <div className="flex items-center justify-center w-5 h-5 rounded bg-green-500 text-white">
                            <Check className="h-3 w-3" aria-hidden="true" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-5 h-5 rounded border-2 border-muted-foreground hover:border-green-500">
                            <div className="w-2 h-2" aria-hidden="true" />
                          </div>
                        )}
                      </button>
                      <span className={cn(
                        'flex-1 leading-relaxed',
                        isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                      )}>
                        {criterionText}
                      </span>
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded',
                        isCompleted
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400'
                      )}>
                        {isCompleted ? 'Done' : 'Pending'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Dependencies Section */}
          {task.dependencies.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Dependencies
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({task.dependencies.length} required task{task.dependencies.length > 1 ? 's' : ''})
                </span>
              </h3>
              <div className="space-y-2">
                {parentTasks.map(parentTask => (
                  <button
                    key={parentTask.id}
                    onClick={() => onNavigateToTask?.(parentTask.id)}
                    className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent hover:border-accent transition-all group"
                    aria-label={`View task ${parentTask.id}: ${parentTask.title}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {parentTask.id}
                      </span>
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex-1">
                        {parentTask.title}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Dependent Tasks Section */}
          {dependentTasks.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Dependent Tasks
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({dependentTasks.length} task{dependentTasks.length > 1 ? 's' : ''} depend on this)
                </span>
              </h3>
              <div className="space-y-2">
                {dependentTasks.map(childTask => (
                  <button
                    key={childTask.id}
                    onClick={() => onNavigateToTask?.(childTask.id)}
                    className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent hover:border-accent transition-all group"
                    aria-label={`View task ${childTask.id}: ${childTask.title}`}
                  >
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors rotate-180" aria-hidden="true" />
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {childTask.id}
                      </span>
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex-1">
                        {childTask.title}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Visual Dependency Graph */}
          {(task.dependencies.length > 0 || dependentTasks.length > 0) && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 sm:mb-3 flex items-center gap-2">
                <Network className="h-4 w-4" />
                Dependency Graph
                <span className="ml-1 text-xs font-normal text-muted-foreground hidden sm:inline">
                  Visual representation of task relationships
                </span>
              </h3>
              <div className="bg-muted/30 rounded-lg p-3 sm:p-4 border">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  {/* Parent tasks (dependencies) */}
                  {parentTasks.length > 0 && (
                    <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-medium text-muted-foreground">Dependencies</span>
                      <div className="flex flex-wrap justify-center gap-2">
                        {parentTasks.map(parentTask => (
                          <button
                            key={parentTask.id}
                            onClick={() => onNavigateToTask?.(parentTask.id)}
                            className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors text-[10px] sm:text-xs font-medium text-orange-700 dark:text-orange-300 max-w-[100px] sm:max-w-[120px]"
                            aria-label={`View dependency ${parentTask.id}: ${parentTask.title}`}
                            title={parentTask.title}
                          >
                            <div className="truncate">{parentTask.id}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Arrow indicator - horizontal on desktop, vertical on mobile */}
                  {parentTasks.length > 0 && dependentTasks.length > 0 && (
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground rotate-90 sm:rotate-0" />
                  )}

                  {/* Current task */}
                  <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-medium text-muted-foreground">This Task</span>
                    <div className="px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg border-2 border-primary bg-primary/10 text-[10px] sm:text-xs font-semibold text-primary max-w-[120px] sm:max-w-[140px] text-center">
                      <div className="truncate">{task.id}</div>
                      <div className="text-[10px] mt-1 truncate">{task.title}</div>
                    </div>
                  </div>

                  {/* Arrow indicator - horizontal on desktop, vertical on mobile */}
                  {parentTasks.length > 0 && dependentTasks.length > 0 && (
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground rotate-90 sm:rotate-0" />
                  )}

                  {/* Child tasks (dependents) */}
                  {dependentTasks.length > 0 && (
                    <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-medium text-muted-foreground">Dependent Tasks</span>
                      <div className="flex flex-wrap justify-center gap-2">
                        {dependentTasks.map(childTask => (
                          <button
                            key={childTask.id}
                            onClick={() => onNavigateToTask?.(childTask.id)}
                            className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors text-[10px] sm:text-xs font-medium text-blue-700 dark:text-blue-300 max-w-[100px] sm:max-w-[120px]"
                            aria-label={`View dependent task ${childTask.id}: ${childTask.title}`}
                            title={childTask.title}
                          >
                            <div className="truncate">{childTask.id}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-muted-foreground/20">
                  <div className="grid grid-cols-3 gap-2 sm:gap-6 text-[10px] sm:text-xs text-muted-foreground text-center">
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20 flex-shrink-0" />
                      <span className="truncate">Dependencies</span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded border-2 border-primary bg-primary/10 flex-shrink-0" />
                      <span className="truncate">Current task</span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20 flex-shrink-0" />
                      <span className="truncate">Dependents</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2" role="list" aria-label="Task tags">
                {task.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium"
                    role="listitem"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Spec Reference */}
          {task.specReference && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Specification Reference
              </h3>
              <a
                href={task.specReference}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                <LinkIcon className="h-4 w-4" aria-hidden="true" />
                <span>View specification document</span>
              </a>
            </section>
          )}

          {/* View Logs Button */}
          <section>
            <button
              onClick={() => onOpenLogs?.()}
              disabled={!planId || !onOpenLogs}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-input bg-background hover:bg-accent hover:border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <Terminal className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-sm font-medium text-foreground">
                {taskStatus === 'completed' || taskStatus === 'in_progress'
                  ? 'View Execution Logs'
                  : 'View Logs (when available)'
                }
              </span>
            </button>
          </section>

          {/* Empty state for dependencies */}
          {task.dependencies.length === 0 && dependentTasks.length === 0 && (
            <section className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
              <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>This task has no dependencies</p>
              <p className="text-xs mt-1">It can be started at any time</p>
            </section>
          )}
        </div>

        {/* Footer with keyboard hint */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">Esc</kbd> to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
