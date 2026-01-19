'use client';

import { useEffect, useState } from 'react';
import { PlanCard } from './PlanCard';
import { Button } from './ui/button';
import { Loader2, AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';

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
 */
export function PlanList() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/plans');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: PlansApiResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch plans');
      }

      setPlans(data.plans || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

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
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchPlans} variant="outline">
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

  // Plans grid
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Implementation Plans</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Browse and manage your Ralph project implementation plans
          </p>
        </div>
        <Button onClick={fetchPlans} variant="outline" size="sm" className="w-full sm:w-auto">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
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
