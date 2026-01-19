'use client';

import { PlanCard } from './PlanCard';
import { Button } from './ui/button';
import { Loader2, AlertCircle, FolderOpen, RefreshCw, Clock, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePolling, useWebSocket } from '@/lib/ralph';
import { ConnectionStatus } from './ConnectionStatus';

export interface PlanData {
  id: string;
  name: string;
  description: string;
  path: string;
  totalTasks?: number;
  completedTasks?: number;
  inProgressTasks?: number;
  failedTasks?: number;
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
 * - Pause/Resume polling (when using fallback)
 */
export function PlanList() {
  // Use WebSocket for real-time updates with polling fallback
  const { connectionState, usingFallback, polling, lastMessage, onMessage } = useWebSocket({
    fallbackToPolling: true,
    pollingInterval: parseInt(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS || '5000', 10),
    pollingFetcher: async () => {
      const res = await fetch('/api/plans');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    },
  });

  // Use the appropriate polling result
  const pollingResult = usingFallback ? polling : usePolling<PlansApiResponse>({
    fetcher: async () => {
      const res = await fetch('/api/plans');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    },
    interval: parseInt(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS || '5000', 10),
    pollOnlyWhenVisible: true,
    staleTime: 60000,
    enabled: false, // Disabled when using WebSocket
  });

  const {
    data: response,
    loading,
    error,
    lastUpdated,
    isStale,
    isPaused,
    refresh,
    togglePause,
  } = usingFallback && pollingResult ? pollingResult : {
    data: null,
    loading: false,
    error: null,
    lastUpdated: lastMessageAt,
    isStale: false,
    isPaused: false,
    refresh: async () => {
      // Trigger refresh via fetch
      const res = await fetch('/api/plans');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return;
    },
    togglePause: () => {},
  };

  const lastMessageAt = lastMessage ? new Date(lastMessage.timestamp) : null;

  const plans = response?.plans || [];

  // Loading state
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
          <Button onClick={() => refresh()} variant="outline">
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
            <ConnectionStatus />
            {isStale && (
              <div
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                )}
                title="Data is stale (older than 60 seconds)"
              >
                <EyeOff className="h-3 w-3" />
                Stale
              </div>
            )}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            Browse and manage your Ralph project implementation plans
          </p>
          {lastUpdated && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
              {isPaused && (
                <span className="ml-2 text-muted-foreground">(Paused)</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={togglePause}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
          >
            {isPaused ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resume
              </>
            ) : (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Pause
              </>
            )}
          </Button>
          <Button
            onClick={() => refresh()}
            variant="outline"
            size="sm"
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw
              className={cn('mr-2 h-4 w-4', loading && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-3">
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
          />
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Showing {plans.length} plan{plans.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
