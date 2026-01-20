'use client';

import { CheckCircle2, Circle, AlertTriangle, Link as LinkIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RalphTask } from '@/lib/plan-utils';

export interface TaskItemProps {
  task: RalphTask;
  showDescription?: boolean;
  showAcceptanceCriteria?: boolean;
  className?: string;
  onClick?: () => void; // New: onClick handler for opening detail modal
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
}: TaskItemProps) {
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
    // Since we don't have task status in the RalphTask interface,
    // we'll default to pending state
    return <Circle className="h-4 w-4 text-muted-foreground" />;
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
        {/* Status Icon */}
        <div className="mt-0.5 flex-shrink-0">{getStatusIcon()}</div>

        {/* Click indicator */}
        {onClick && (
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1 ml-auto" />
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
