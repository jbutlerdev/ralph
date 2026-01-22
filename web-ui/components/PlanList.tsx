'use client';

import { useState, useCallback, useEffect } from 'react';
import { PlanCard } from './PlanCard';
import { Button } from './ui/button';
import { Loader2, AlertCircle, FolderOpen, RefreshCw, Clock, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionStatus } from './ConnectionStatus';
import { useServerEvents, type SSEConnectionState } from '@/lib/ralph';

export interface PlanData {
  id: string;
  name: string;
  description: string;
  path: string;
  totalTasks?: number;
  completedTasks?: number;
  inProgressTasks?: number;
  blockedTasks?: number;
  pendingTasks?: number;
  failedTasks?: number;
  progress?: number; // Completion percentage
  projectRoot?: string; // Project root directory
  registeredAt?: string;
  lastAccessed?: string;
}

export interface PlansApiResponse {
  success: boolean;
  plans?: PlanData[];
  count?: number;
  error?: string;
  message?: string;
}

/**
 * PlanList component
 *
 * Displays a grid of plan cards with:
 * - Loading state during API fetch
 * - Empty state when no plans found
 * - Error state with retry button
 * - Responsive grid layout (1/2/3 columns)
 * - Real-time updates via WebSocket (with polling fallback)
 * - Connection status indicator
 * - Manual refresh button with loading state
 * - Last updated timestamp
 * - Stale data indicator
 */
export function PlanList() {
  const [response, setResponse] = useState<PlansApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch function for plans
  const fetchPlans = useCallback(async (): Promise<PlansApiResponse> => {
    const res = await fetch('/api/plans');
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
  }, []);

  // Handle manual refresh
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlans();
      setResponse(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch plans'));
    } finally {
      setLoading(false);
    }
  }, [fetchPlans]);

  // Set up SSE for real-time updates with polling fallback
  const { connectionState, usingFallback } = useServerEvents({
    enabled: true,
    fallbackToPolling: true,
    pollingInterval: 5000,
    pollingFetcher: refresh,
    onPlanStatus: (event) => {
      console.log('Plan status event received:', event.type);
      // When we receive a plan status event, refresh the plans list
      refresh();
    },
    onTaskStatus: (event) => {
      console.log('Task status event received:', event.status);
      // When we receive a task status event, refresh the plans list
      refresh();
    },
  });

  // Initial fetch
  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plans = response?.plans || [];

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />
          <p className="mt-4 text-lg text-muted-foreground">Loading plans...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Failed to Load Plans</h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (plans.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Plans Found</h2>
          <p className="text-muted-foreground">
            There are no Ralph implementation plans available. Create a plan by running the Ralph
            plan generator skill in your project.
          </p>
        </div>
      </div>
    );
  }

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

  // Plans grid
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Implementation Plans</h1>
            <ConnectionStatus
              compact
              connectionState={connectionState}
              usingFallback={usingFallback}
            />
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            Browse and manage your Ralph project implementation plans
          </p>
          {lastUpdated && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={refresh}
            disabled={loading}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            title={usingFallback ? 'Using HTTP polling' : 'Real-time WebSocket connected'}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {usingFallback && connectionState === 'connected' && (
        <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/20 px-4 py-2 text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
          <WifiOff className="h-4 w-4" />
          WebSocket unavailable - using HTTP polling fallback. Updates will be less frequent.
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            id={plan.id}
            name={plan.name}
            description={plan.description}
            totalTasks={plan.totalTasks || 0}
            completedTasks={plan.completedTasks || 0}
            inProgressTasks={plan.inProgressTasks}
            failedTasks={plan.failedTasks}
            progress={plan.progress}
            projectRoot={plan.projectRoot}
          />
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Showing {plans.length} plan{plans.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
