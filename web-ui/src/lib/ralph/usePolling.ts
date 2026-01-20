'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Configuration options for the polling hook
 */
export interface UsePollingOptions<T> {
  /**
   * Async function to fetch data
   */
  fetcher: () => Promise<T>;

  /**
   * Polling interval in milliseconds (default: 5000)
   */
  interval?: number;

  /**
   * Whether polling is enabled (default: true)
   */
  enabled?: boolean;

  /**
   * Whether to poll only when the tab is visible (default: true)
   */
  pollOnlyWhenVisible?: boolean;

  /**
   * Maximum number of consecutive retries with exponential backoff (default: 5)
   */
  maxRetries?: number;

  /**
   * Base delay for exponential backoff in milliseconds (default: 1000)
   */
  baseBackoffDelay?: number;

  /**
   * Maximum backoff delay in milliseconds (default: 30000)
   */
  maxBackoffDelay?: number;

  /**
   * Time in milliseconds after which data is considered stale (default: 60000)
   * Set to null to disable staleness detection
   */
  staleTime?: number | null;

  /**
   * Callback called when data is successfully fetched
   */
  onSuccess?: (data: T) => void;

  /**
   * Callback called when an error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Callback called before each poll attempt
   */
  onPoll?: () => void;
}

/**
 * Result returned by the polling hook
 */
export interface UsePollingResult<T> {
  /**
   * The fetched data
   */
  data: T | null;

  /**
   * Whether a fetch is currently in progress
   */
  loading: boolean;

  /**
   * Whether the last fetch resulted in an error
   */
  error: Error | null;

  /**
   * Timestamp of the last successful data update
   */
  lastUpdated: Date | null;

  /**
   * Whether the data is stale (older than staleTime)
   */
  isStale: boolean;

  /**
   * Number of consecutive failed attempts
   */
  retryCount: number;

  /**
   * Whether polling is currently paused
   */
  isPaused: boolean;

  /**
   * Manually trigger a refresh
   */
  refresh: () => Promise<void>;

  /**
   * Pause/resume polling
   */
  togglePause: () => void;

  /**
   * Reset retry counter
   */
  resetRetries: () => void;
}

/**
 * React hook for polling data from an async source with smart features:
 *
 * Features:
 * - Configurable polling interval (via environment variable or prop)
 * - Manual refresh with loading state
 * - "Last updated" timestamp tracking
 * - Optimistic updates: disable polling when tab is not visible
 * - Error handling: exponential backoff on API failures
 * - Visual indicator when data is stale
 *
 * @example
 * ```tsx
 * const { data, loading, error, lastUpdated, refresh, isStale } = usePolling({
 *   fetcher: () => fetch('/api/status').then(r => r.json()),
 *   interval: 5000,
 *   staleTime: 60000,
 * });
 * ```
 *
 * Environment variables:
 * - `NEXT_PUBLIC_POLL_INTERVAL_MS`: Default polling interval in milliseconds (default: 5000)
 */
export function usePolling<T>(
  options: UsePollingOptions<T>
): UsePollingResult<T> {
  // Extract options with defaults
  const {
    fetcher,
    interval: intervalProp,
    enabled = true,
    pollOnlyWhenVisible = true,
    maxRetries = 5,
    baseBackoffDelay = 1000,
    maxBackoffDelay = 30000,
    staleTime = 60000,
    onSuccess,
    onError,
    onPoll,
  } = options;

  // Get default interval from environment variable or use 5000ms
  const defaultInterval = parseInt(
    process.env.NEXT_PUBLIC_POLL_INTERVAL_MS || '5000',
    10
  );
  const interval = intervalProp ?? defaultInterval;

  // State
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Refs for timers and flags
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastFetchTimeRef = useRef<number>(0);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  /**
   * Calculate exponential backoff delay
   */
  const getBackoffDelay = useCallback(
    (attempt: number): number => {
      const delay = baseBackoffDelay * Math.pow(2, attempt);
      return Math.min(delay, maxBackoffDelay);
    },
    [baseBackoffDelay, maxBackoffDelay]
  );

  /**
   * Check if document is visible (for tab visibility optimization)
   */
  const isDocumentVisible = useCallback((): boolean => {
    return typeof document !== 'undefined' && document.visibilityState === 'visible';
  }, []);

  /**
   * Check if data is stale
   */
  const isStale = useCallback((): boolean => {
    if (staleTime === null || !lastUpdated) return false;
    const age = Date.now() - lastUpdated.getTime();
    return age > staleTime;
  }, [lastUpdated, staleTime]);

  /**
   * Main fetch function with error handling and retry logic
   */
  const fetchData = useCallback(
    async (manualRefresh = false): Promise<void> => {
      if (!isMountedRef.current) return;

      // Skip if polling is paused (unless it's a manual refresh)
      if (isPaused && !manualRefresh) return;

      // Skip if tab is not visible (unless it's a manual refresh)
      if (pollOnlyWhenVisible && !isDocumentVisible() && !manualRefresh) {
        return;
      }

      setLoading(true);
      onPoll?.();

      try {
        const result = await fetcher();

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setData(result);
          setError(null);
          setLastUpdated(new Date());
          setRetryCount(0);
          lastFetchTimeRef.current = Date.now();
          onSuccess?.(result);
        }
      } catch (err) {
        if (isMountedRef.current) {
          const error =
            err instanceof Error ? err : new Error('Unknown fetch error');
          setError(error);
          onError?.(error);

          // Increment retry counter
          setRetryCount(prev => {
            const newCount = prev + 1;
            return newCount;
          });

          // Don't auto-retry on manual refresh
          if (!manualRefresh && retryCount + 1 < maxRetries) {
            // Schedule retry with exponential backoff
            const backoffDelay = getBackoffDelay(retryCount);
            if (pollTimeoutRef.current) {
              clearTimeout(pollTimeoutRef.current);
            }
            pollTimeoutRef.current = setTimeout(() => {
              fetchData();
            }, backoffDelay);
          }
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [
      fetcher,
      isPaused,
      pollOnlyWhenVisible,
      isDocumentVisible,
      retryCount,
      maxRetries,
      getBackoffDelay,
      onPoll,
      onSuccess,
      onError,
    ]
  );

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async (): Promise<void> => {
    // Reuse existing refresh promise if one is in progress
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      try {
        await fetchData(true);
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [fetchData]);

  /**
   * Pause/resume polling
   */
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  /**
   * Reset retry counter
   */
  const resetRetries = useCallback(() => {
    setRetryCount(0);
    setError(null);
  }, []);

  /**
   * Schedule next poll
   */
  const scheduleNextPoll = useCallback(() => {
    if (!enabled || isPaused) return;

    // Clear existing timeout
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    // Don't schedule if we've exceeded max retries and have an error
    if (error && retryCount >= maxRetries) {
      return;
    }

    pollTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, interval);
  }, [enabled, isPaused, error, retryCount, maxRetries, interval, fetchData]);

  // Main polling effect
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchData();

    // Schedule polling
    scheduleNextPoll();

    // Cleanup
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
    // Only run on mount and when enabled changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Re-schedule poll after each fetch completes
  useEffect(() => {
    if (!loading && !error) {
      scheduleNextPoll();
    }
  }, [loading, error, scheduleNextPoll]);

  // Handle visibility changes for tab optimization
  useEffect(() => {
    if (!pollOnlyWhenVisible) return;

    const handleVisibilityChange = () => {
      if (isDocumentVisible()) {
        // Tab became visible - fetch data immediately
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollOnlyWhenVisible, isDocumentVisible, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    lastUpdated,
    isStale: isStale(),
    retryCount,
    isPaused,
    refresh,
    togglePause,
    resetRetries,
  };
}
