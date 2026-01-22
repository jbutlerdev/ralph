'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * SSE connection states
 */
export type SSEConnectionState =
  | 'connecting'   // Attempting to connect
  | 'connected'    // Successfully connected
  | 'disconnected' // Not connected
  | 'error';       // Connection error

/**
 * Plan status event from Ralph server
 */
export interface PlanStatusEvent {
  planId: string;
  sessionId?: string;
  timestamp: string;
  type: 'task.started' | 'task.completed' | 'task.failed' | 'session.started' | 'session.completed';
  taskId?: string;
  progress?: number;
  completedTasks?: number;
  failedTasks?: number;
  inProgressTasks?: number;
}

/**
 * Task status event from Ralph server
 */
export interface TaskStatusEvent {
  sessionId: string;
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: string;
  error?: string;
}

/**
 * SSE message structure
 */
export interface SSEMessage {
  type: 'connected' | 'plan-status' | 'task-status' | 'heartbeat' | 'error';
  event?: PlanStatusEvent | TaskStatusEvent;
  timestamp?: string;
  message?: string;
}

/**
 * Configuration options for useServerEvents
 */
export interface UseServerEventsOptions {
  /**
   * Plan ID to filter events (optional)
   */
  planId?: string;

  /**
   * Whether to enable SSE connection (default: true)
   */
  enabled?: boolean;

  /**
   * Whether to fallback to polling if SSE fails (default: true)
   */
  fallbackToPolling?: boolean;

  /**
   * Polling interval for fallback (default: 5000ms)
   */
  pollingInterval?: number;

  /**
   * Callback called when a plan status event is received
   */
  onPlanStatus?: (event: PlanStatusEvent) => void;

  /**
   * Callback called when a task status event is received
   */
  onTaskStatus?: (event: TaskStatusEvent) => void;

  /**
   * Callback called when connection state changes
   */
  onConnectionChange?: (state: SSEConnectionState) => void;

  /**
   * Callback called when connection error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Fetcher function for polling fallback
   */
  pollingFetcher?: () => Promise<void>;
}

/**
 * Result returned by useServerEvents
 */
export interface UseServerEventsResult {
  /**
   * Current connection state
   */
  connectionState: SSEConnectionState;

  /**
   * Whether using polling fallback
   */
  usingFallback: boolean;

  /**
   * Timestamp of last event
   */
  lastEventAt: Date | null;

  /**
   * Manually reconnect
   */
  reconnect: () => void;

  /**
   * Disconnect
   */
  disconnect: () => void;
}

/**
 * React hook for SSE connection to Ralph server events
 *
 * Features:
 * - Automatic reconnection on disconnect
 * - Graceful fallback to HTTP polling if SSE unavailable
 * - Connection state tracking
 * - Event-driven message handling for plan and task status updates
 *
 * @example
 * ```tsx
 * const { connectionState } = useServerEvents({
 *   planId: 'web-ui',
 *   onPlanStatus: (event) => {
 *     console.log('Plan status:', event);
 *     refresh(); // Trigger data refresh
 *   },
 * });
 * ```
 */
export function useServerEvents(options: UseServerEventsOptions = {}): UseServerEventsResult {
  const {
    planId,
    enabled = true,
    fallbackToPolling = true,
    pollingInterval = 5000,
    onPlanStatus,
    onTaskStatus,
    onConnectionChange,
    onError,
    pollingFetcher,
  } = options;

  // State
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected');
  const [usingFallback, setUsingFallback] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const isMountedRef = useRef(true);
  const manualCloseRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Update connection state and trigger callback
   */
  const updateConnectionState = useCallback(
    (state: SSEConnectionState) => {
      if (!isMountedRef.current) return;

      setConnectionState(state);
      onConnectionChange?.(state);
    },
    [onConnectionChange]
  );

  /**
   * Start polling fallback
   */
  const startPolling = useCallback(() => {
    if (!fallbackToPolling || !pollingFetcher || pollingIntervalRef.current) {
      return;
    }

    setUsingFallback(true);
    updateConnectionState('connected'); // Show as "connected" since polling is working

    const poll = async () => {
      if (!isMountedRef.current) return;

      try {
        await pollingFetcher();
        setLastEventAt(new Date());
      } catch (error) {
        // Silently fail polling - will retry on next interval
      }
    };

    // Initial poll
    poll();

    // Set up interval
    pollingIntervalRef.current = setInterval(poll, pollingInterval);
  }, [fallbackToPolling, pollingFetcher, pollingInterval, updateConnectionState]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setUsingFallback(false);
  }, []);

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) {
      return;
    }

    manualCloseRef.current = false;
    updateConnectionState('connecting');

    try {
      // Build URL with optional planId filter
      const params = new URLSearchParams();
      if (planId) params.set('planId', planId);
      const url = `/api/events/stream?${params.toString()}`;

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!isMountedRef.current) return;

        updateConnectionState('connected');
        stopPolling(); // Stop polling if SSE connects
      };

      eventSource.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const data = JSON.parse(event.data) as SSEMessage;
          setLastEventAt(new Date());

          if (data.type === 'plan-status' && data.event && onPlanStatus) {
            onPlanStatus(data.event as PlanStatusEvent);
          } else if (data.type === 'task-status' && data.event && onTaskStatus) {
            onTaskStatus(data.event as TaskStatusEvent);
          } else if (data.type === 'error' && data.message) {
            onError?.(new Error(data.message));
          }
          // Ignore 'connected' and 'heartbeat' messages
        } catch (parseError) {
          console.error('Failed to parse SSE message:', parseError);
        }
      };

      eventSource.onerror = () => {
        if (!isMountedRef.current) return;

        eventSourceRef.current?.close();
        eventSourceRef.current = null;

        if (!manualCloseRef.current) {
          // Try to reconnect after a delay
          updateConnectionState('error');

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && !manualCloseRef.current) {
              // Try SSE again, or fallback to polling
              connect();
            }
          }, 3000);

          // Start polling as fallback while reconnecting
          if (fallbackToPolling && pollingFetcher) {
            startPolling();
          }
        }
      };
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      updateConnectionState('error');
      onError?.(error instanceof Error ? error : new Error(String(error)));

      // Fallback to polling
      if (fallbackToPolling && pollingFetcher) {
        startPolling();
      }
    }
  }, [
    enabled,
    planId,
    updateConnectionState,
    onPlanStatus,
    onTaskStatus,
    onError,
    fallbackToPolling,
    pollingFetcher,
    startPolling,
    stopPolling,
  ]);

  /**
   * Manually reconnect
   */
  const reconnect = useCallback(() => {
    manualCloseRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    stopPolling();
    connect();
  }, [connect, stopPolling]);

  /**
   * Disconnect
   */
  const disconnect = useCallback(() => {
    manualCloseRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    stopPolling();
    updateConnectionState('disconnected');
  }, [stopPolling, updateConnectionState]);

  /**
   * Effect: Manage SSE connection lifecycle
   */
  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      disconnect();
      return;
    }

    // Attempt connection
    connect();

    // Cleanup
    return () => {
      isMountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, planId]); // Re-run when enabled or planId changes, connect/disconnect stable refs

  return {
    connectionState,
    usingFallback,
    lastEventAt,
    reconnect,
    disconnect,
  };
}
