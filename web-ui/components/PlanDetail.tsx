'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TaskList } from './TaskList';
import { DependencyGraph } from './DependencyGraph';
import { EditPlanModal } from './EditPlanModal';
import { Button } from './ui/button';
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Clock,
  ListChecks,
  GitGraph,
  RefreshCw,
  EyeOff,
  Edit3,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RalphTask } from '@/lib/plan-utils';
import { ConnectionStatus } from './ConnectionStatus';
import { useServerEvents } from '@/lib/ralph';

// Re-export TaskStatus from status.ts as RuntimeTaskStatus for compatibility
export type RuntimeTaskStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'failed';

export interface TaskWithStatus extends RalphTask {
  runtimeStatus: RuntimeTaskStatus;
}

export interface RuntimeStatusSummary {
  completedTasks: number;
  inProgressTasks: number;
  failedTasks: number;
  blockedTasks: number;
  pendingTasks: number;
  progress: number;
  sessionId?: string;
}

export interface PlanDetailData {
  id: string;
  name: string;
  description: string;
  overview: string;
  tasks: TaskWithStatus[];
  metadata: {
    totalTasks: number;
    generatedAt: string;
    estimatedDuration?: string;
  };
  validation: {
    valid: boolean;
    warnings: string[];
  };
  runtimeStatus?: RuntimeStatusSummary;
  projectRoot?: string;
}

interface PlanDetailApiResponse {
  success: boolean;
  plan?: PlanDetailData;
  error?: string;
  message?: string;
  validationErrors?: string[];
  warnings?: string[];
}

/**
 * PlanDetail component
 *
 * Displays a detailed view of a plan with:
 * - Project overview section
 * - Progress indicator
 * - Filterable/sortable task list
 * - Breadcrumb navigation
 * - Manual refresh button with loading state
 * - Restart execution button
 */
export function PlanDetail({ planId }: { planId: string }) {
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [plan, setPlan] = useState<PlanDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [togglingTask, setTogglingTask] = useState<Set<string>>(new Set());
  const [restarting, setRestarting] = useState(false);

  // Fetch plan data
  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/plans/${planId}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data: PlanDetailApiResponse = await res.json();
      if (data.success && data.plan) {
        setPlan(data.plan);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.error || 'Plan not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load plan'));
    } finally {
      setLoading(false);
    }
  }, [planId]);

  // Set up SSE for real-time updates
  const { connectionState, usingFallback } = useServerEvents({
    planId,
    enabled: true,
    fallbackToPolling: true,
    pollingInterval: 5000,
    pollingFetcher: fetchPlan,
    onPlanStatus: (event) => {
      console.log('Plan status event received:', event.type, event.taskId);
      // When we receive a plan status event for this plan, refresh the data
      if (event.planId === planId) {
        fetchPlan();
      }
    },
    onTaskStatus: (event) => {
      console.log('Task status event received:', event.status, event.taskId);
      // Refresh to get updated task status
      fetchPlan();
    },
  });

  // Restart execution
  const handleRestart = async () => {
    if (restarting) return;

    setRestarting(true);
    try {
      const response = await fetch(`/api/plans/${planId}/restart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.message || error.error || errorMessage;
          }
        } catch {
          // Failed to parse error, keep default message
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.success) {
        console.log(`Restarted plan ${planId}, session: ${result.sessionId}`);
        // Refresh the plan to show updated status after a brief delay
        setTimeout(() => fetchPlan(), 1000);
      }
    } catch (error) {
      console.error('Failed to restart plan:', error);
      alert(error instanceof Error ? error.message : 'Failed to restart plan');
    } finally {
      setRestarting(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPlan();
  }, [planId]);

  // Format timestamp
  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[600px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />
          <p className="mt-4 text-lg text-muted-foreground">Loading plan details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !plan) {
    return (
      <div className="flex min-h-[600px] items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Failed to Load Plan</h2>
          <p className="text-muted-foreground mb-4">{error?.message || 'Plan not found'}</p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Plans
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate progress from runtime status
  const progress = plan.runtimeStatus?.progress ?? 0;
  const completedTasks = plan.runtimeStatus?.completedTasks ?? 0;
  const inProgressTasks = plan.runtimeStatus?.inProgressTasks ?? 0;
  const failedTasks = plan.runtimeStatus?.failedTasks ?? 0;

  // Save edited tasks and metadata
  const handleSaveTasks = async (editedTasks: RalphTask[], metadata?: { name: string; description: string }) => {
    try {
      setSavingPlan(true);

      // If metadata is provided, update it first
      if (metadata && (metadata.name || metadata.description)) {
        // We need to update the plan file's **Project:** field and Overview section
        const response = await fetch(`/api/plans/${planId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            updateType: 'metadata',
            metadata: {
              projectName: metadata.name,
              description: metadata.description,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update plan metadata');
        }
      }

      // Send all tasks to the API using PUT for each task
      for (const task of editedTasks) {
        const response = await fetch(`/api/plans/${planId}?taskId=${task.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(task),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update task');
        }
      }

      // Refresh the plan to show updated data
      await fetchPlan();
    } catch (error) {
      console.error('Error saving tasks:', error);
      throw error;
    } finally {
      setSavingPlan(false);
    }
  };

  // Toggle task completion status
  const handleToggleComplete = async (taskId: string) => {
    try {
      setTogglingTask(prev => new Set(prev).add(taskId));

      const task = plan.tasks.find(t => t.id === taskId);
      if (!task) return;

      const newStatus: RalphTask['status'] =
        task.status === 'Implemented' || task.status === 'Verified' ? 'To Do' : 'Implemented';

      const response = await fetch(`/api/plans/${planId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task status');
      }

      // Refresh the plan to show updated data
      await fetchPlan();
    } catch (error) {
      console.error('Failed to toggle task completion:', error);
      throw error;
    } finally {
      setTogglingTask(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/"
          className="flex items-center text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Plans
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground truncate max-w-[150px] sm:max-w-none">{plan.name}</span>
      </div>

      {/* Plan Header */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{plan.name}</h1>
              <ConnectionStatus connectionState={connectionState} usingFallback={usingFallback} compact />
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">{plan.description}</p>
            {lastUpdated && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={fetchPlan}
              variant="outline"
              size="sm"
              disabled={loading || savingPlan || restarting}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw
                className={cn('mr-2 h-4 w-4', loading && 'animate-spin')}
              />
              Refresh
            </Button>
            <Button
              onClick={() => setEditModalOpen(true)}
              variant="default"
              size="sm"
              disabled={loading || savingPlan || restarting}
              className="flex-1 sm:flex-none"
            >
              <Edit3 className="mr-2 h-4 w-4" />
              Edit Plan
            </Button>
            <Button
              onClick={handleRestart}
              disabled={restarting || loading || savingPlan}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <Play className={cn('mr-2 h-4 w-4', restarting && 'animate-pulse')} />
              {restarting ? 'Starting...' : 'Restart'}
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Card */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 sm:mb-6">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-semibold">Overall Progress</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Track completion status of all tasks
            </p>
          </div>
          <div className="text-right sm:text-left">
            <div className="text-2xl sm:text-3xl font-bold" data-testid="progress-percent">{progress}%</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-secondary mb-4 sm:mb-6">
          <div
            className={cn(
              'h-full transition-all duration-500 ease-out',
              progress >= 80 ? 'bg-green-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            )}
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Total Tasks */}
          <div className="flex items-center gap-3" data-testid="total-tasks">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10">
              <ListChecks className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold">{plan.metadata.totalTasks}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Total Tasks</div>
            </div>
          </div>

          {/* Completed */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold" data-testid="completed-tasks">{completedTasks}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Completed</div>
            </div>
          </div>

          {/* In Progress */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
              <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 fill-blue-500/20" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold" data-testid="in-progress-tasks">{inProgressTasks}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>

          {/* Failed */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold" data-testid="failed-tasks">{failedTasks}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        </div>

        {/* Validation Warnings */}
        {plan.validation.warnings && plan.validation.warnings.length > 0 && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30" data-testid="validation-warnings">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <h4 className="font-medium text-sm text-yellow-900 dark:text-yellow-100">
                  Plan Validation Warnings
                </h4>
                <ul className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1">
                  {plan.validation.warnings.map((warning, idx) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overview Section */}
      {plan.overview && (
        <div className="rounded-lg border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Project Overview</h2>
          <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap" data-testid="project-overview">
            {plan.overview}
          </div>

          {/* Metadata */}
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>
                Generated:{' '}
                {new Date(plan.metadata.generatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            {plan.projectRoot && (
              <div className="flex items-center gap-2">
                <span className="font-mono">{plan.projectRoot}</span>
              </div>
            )}
            {plan.metadata.estimatedDuration && (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Estimated Duration: {plan.metadata.estimatedDuration}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
          <h2 className="text-xl sm:text-2xl font-semibold">Tasks</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex-1 sm:flex-none"
            >
              <ListChecks className="h-4 w-4 mr-2" />
              List View
            </Button>
            <Button
              variant={viewMode === 'graph' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('graph')}
              className="flex-1 sm:flex-none"
            >
              <GitGraph className="h-4 w-4 mr-2" />
              Dependency Graph
            </Button>
          </div>
        </div>

        {viewMode === 'list' ? (
          <TaskList tasks={plan.tasks} onToggleComplete={handleToggleComplete} togglingTasks={togglingTask} planId={planId} />
        ) : (
          <DependencyGraph tasks={plan.tasks} planId={planId} />
        )}
      </div>

      {/* Edit Plan Modal */}
      {plan && (
        <EditPlanModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          tasks={plan.tasks}
          completedTaskIds={new Set(
            plan.tasks
              .filter(t => t.runtimeStatus === 'completed')
              .map(t => t.id)
          )}
          planMetadata={{
            name: plan.name,
            description: plan.description,
          }}
          onSave={handleSaveTasks}
          loading={savingPlan}
        />
      )}
    </div>
  );
}
