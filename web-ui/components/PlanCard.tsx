'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlanCardProps {
  id: string;
  name: string;
  description: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks?: number;
  failedTasks?: number;
  className?: string;
}

/**
 * PlanCard component
 *
 * Displays a project card with:
 * - Project name and description
 * - Progress bar with color coding
 * - Task statistics (total, completed, pending)
 * - Clickable link to project details
 */
export function PlanCard({
  id,
  name,
  description,
  totalTasks,
  completedTasks,
  inProgressTasks = 0,
  failedTasks = 0,
  className,
}: PlanCardProps) {
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const pendingTasks = totalTasks - completedTasks;

  // Determine progress bar color based on percentage
  const progressColor = percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <Link
      href={`/plan/${id}`}
      className={cn(
        'block group relative overflow-hidden rounded-lg border bg-card p-6 text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold tracking-tight group-hover:text-primary transition-colors">
            {name}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{percentage}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn('h-full transition-all duration-500 ease-out', progressColor)}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-muted-foreground">
            {completedTasks} <span className="sr-only">completed</span>
          </span>
        </div>

        {inProgressTasks > 0 && (
          <div className="flex items-center gap-1.5">
            <Circle className="h-4 w-4 text-blue-500 fill-blue-500/20" />
            <span className="text-muted-foreground">
              {inProgressTasks} <span className="sr-only">in progress</span>
            </span>
          </div>
        )}

        {failedTasks > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-muted-foreground">
              {failedTasks} <span className="sr-only">failed</span>
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Circle className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {pendingTasks} <span className="sr-only">pending</span>
          </span>
        </div>

        <div className="ml-auto font-medium text-muted-foreground">
          {totalTasks} total
        </div>
      </div>

      {/* Failed indicator */}
      {failedTasks > 0 && (
        <div className="absolute top-4 right-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
        </div>
      )}
    </Link>
  );
}
