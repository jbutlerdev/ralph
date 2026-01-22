'use client';

import { CheckCircle2, Circle, AlertTriangle, Link as LinkIcon, ChevronRight, XCircle, Check, Star, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RalphTask } from '@/lib/plan-utils';
import type { RuntimeTaskStatus } from './PlanDetail';

export interface TaskItemProps {
  task: RalphTask & { runtimeStatus?: RuntimeTaskStatus };
  showDescription?: boolean;
  showAcceptanceCriteria?: boolean;
  className?: string;
  onClick?: () => void; // New: onClick handler for opening detail modal
  onToggleComplete?: (taskId: string) => Promise<void>; // New: Toggle completion status
  isToggling?: boolean; // Whether this task is currently being toggled
  onViewLogs?: () => void; // Callback for viewing logs
  planId?: string; // Plan ID for logs availability check
}

/**
 * TaskItem component
 *
 * Displays a single task with:
 * - Task ID and title
 * - Status badge (pending/in-progress/completed/failed)
 * - Priority badge (high/medium/low)
 * - Dependencies with links
 * - Description (optional)
 * - Acceptance criteria checkboxes (optional)
 * - Clickable to open detail modal (optional)
 */
export function TaskItem({
  task,
  showDescription = false,
  showAcceptanceCriteria = false,
  className,
  onClick,
  onToggleComplete,
  isToggling = false,
  onViewLogs,
  planId,
}: TaskItemProps) {

  // Completed is based on runtime status only
  const isCompleted = task.runtimeStatus === 'completed';

  // Plan file status (To Do, In Progress, Implemented, Needs Re-Work, Verified)
  const planStatus = task.status;
  const isImplemented = planStatus === 'Implemented' || planStatus === 'Verified';

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening detail modal
    if (!onToggleComplete || isToggling) return;

    try {
      await onToggleComplete(task.id);
    } catch (error) {
      console.error('Failed to toggle task completion:', error);
    }
  };

  const handleViewLogs = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening detail modal
    onViewLogs?.();
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

  const getStatusIcon = () => {
    const status = task.runtimeStatus || 'pending';

    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'in-progress':
        return <Circle className="h-4 w-4 text-blue-600 dark:text-blue-400 fill-blue-500/20" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'blocked':
        return <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
      case 'pending':
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div
      data-testid="task-item"
      data-task-id={task.id}
      className={cn(
        'group rounded-lg border bg-card p-3 sm:p-4 text-card-foreground shadow-sm transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-primary/50',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      aria-label={onClick ? `View details for ${task.title}` : undefined}
    >
      {/* Header: ID, Title, Badges */}
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Completion Checkbox */}
        {onToggleComplete && (
          <button
            onClick={handleToggleComplete}
            disabled={isToggling}
            className={cn(
              'mt-0.5 flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors',
              isCompleted
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-muted-foreground hover:border-green-500',
              isToggling && 'opacity-50 cursor-not-allowed'
            )}
            aria-label={isCompleted ? `Mark ${task.title} as incomplete` : `Mark ${task.title} as complete`}
          >
            {isCompleted && <Check className="h-3 w-3" />}
          </button>
        )}

        {/* Status Icon */}
        <div className="mt-0.5 flex-shrink-0">{getStatusIcon()}</div>

        {/* Logs button - only show if planId is available */}
        {planId && onViewLogs && (
          <button
            onClick={handleViewLogs}
            disabled={!planId}
            className="ml-auto flex-shrink-0 mt-0.5 p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="View task logs"
            aria-label={`View logs for ${task.title}`}
          >
            <Terminal className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        )}

        {/* Click indicator */}
        {onClick && (
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1 ml-2" />
        )}

        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 flex-wrap">
              {/* Task ID */}
              <span className="text-[10px] sm:text-xs font-mono text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0">
                {task.id}
              </span>

              {/* Title */}
              <h3 className="text-sm sm:text-base font-semibold truncate group-hover:text-primary transition-colors">
                {task.title}
              </h3>
            </div>

            {/* Priority Badge */}
            <span
              className={cn(
                'text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0',
                getPriorityColor(task.priority)
              )}
              aria-label={`Priority: ${task.priority}`}
            >
              {task.priority}
            </span>

            {/* Implemented Badge - shows if task is marked as Implemented/Verified in plan file */}
            {isImplemented && (
              <div
                className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30"
                title="Implemented"
              >
                <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-600 dark:text-amber-400 fill-amber-500" />
              </div>
            )}
          </div>

          {/* Dependencies */}
          {task.dependencies.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
              <LinkIcon className="h-3 w-3" />
              <span className="truncate">
                Depends on:{' '}
                {task.dependencies.map((dep, idx) => (
                  <span key={dep} className="font-mono hover:text-primary cursor-pointer">
                    {dep}
                    {idx < task.dependencies.length - 1 && ', '}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {showDescription && task.description && (
        <div className="mt-2 sm:mt-3 pl-6 sm:pl-7 text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
          {task.description}
        </div>
      )}

      {/* Acceptance Criteria */}
      {showAcceptanceCriteria && task.acceptanceCriteria.length > 0 && (
        <div className="mt-2 sm:mt-3 pl-6 sm:pl-7">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1.5 sm:mb-2">
            Acceptance Criteria
          </p>
          <ul className="space-y-1">
            {task.acceptanceCriteria.map((criterion, idx) => (
              <li
                key={idx}
                className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground"
              >
                <Circle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mt-0.5 sm:mt-1 flex-shrink-0 fill-muted-foreground/20" />
                <span className="text-[10px] sm:text-sm">{criterion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Additional metadata */}
      {task.tags && task.tags.length > 0 && (
        <div className="mt-2 sm:mt-3 pl-6 sm:pl-7 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-secondary text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
