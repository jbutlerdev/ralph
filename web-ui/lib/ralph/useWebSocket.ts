'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePolling } from './usePolling';

/**
 * WebSocket connection states
 */
export type WSConnectionState =
  | 'connecting'   // Attempting to connect
  | 'connected'    // Successfully connected
  | 'disconnected' // Not connected
  | 'error';       // Connection error

/**
 * WebSocket message types (matching server)
 */
export type WSMessageType =
  | 'task.completed'
  | 'task.started'
  | 'task.failed'
  | 'session.changed'
  | 'checkpoint.created'
  | 'error'
  | 'ping'
  | 'pong';

/**
 * Base WebSocket message structure
 */
export interface WSMessage {
  type: WSMessageType;
  timestamp: string;
  data: unknown;
}

/**
 * Task event data
 */
export interface TaskEventData {
  taskId: string;
  sessionId: string;
  timestamp?: string;
  error?: string;
}

/**
 * Session change data
 */
export interface SessionChangeData {
  sessionId: string;
  completedTasks: string[];
  failedTasks: string[];
  currentTaskId: string | null;
  lastActivity: string;
  connected?: boolean;
  projectRoot?: string;
}

/**
 * Checkpoint created data
 */
export interface CheckpointData {
  sessionId: string;
  checkpointPath: string;
  timestamp: string;
}

/**
 * Configuration options for useWebSocket
 */
export interface UseWebSocketOptions {
  /**
   * WebSocket server URL (default: derived from current location)
   */
  url?: string;

  /**
   * Whether to enable WebSocket connection (default: true)
   */
  enabled?: boolean;

  /**
   * Whether to fallback to polling if WebSocket fails (default: true)
   */
  fallbackToPolling?: boolean;

  /**
   * Polling interval for fallback (default: 5000ms)
   */
  pollingInterval?: number;

  /**
   * Reconnection attempt settings
   */
  reconnect?: {
    /**
     * Whether to automatically reconnect (default: true)
     */
    enabled?: boolean;

    /**
     * Maximum number of reconnection attempts (default: 10)
     * Set to Infinity for unlimited attempts
     */
    maxAttempts?: number;

    /**
     * Initial reconnection delay in milliseconds (default: 1000)
     */
    initialDelay?: number;

    /**
     * Maximum reconnection delay in milliseconds (default: 30000)
     */
    maxDelay?: number;

    /**
     * Whether to use exponential backoff (default: true)
     */
    exponentialBackoff?: boolean;
  };

  /**
   * Callback called when a message is received
   */
  onMessage?: (message: WSMessage) => void;

  /**
   * Callback called when connection state changes
   */
  onConnectionChange?: (state: WSConnectionState) => void;

  /**
   * Callback called when connection error occurs
   */
  onError?: (error: Event) => void;

  /**
   * Fetcher function for polling fallback
   */
  pollingFetcher?: () => Promise<unknown>;
}

/**
 * Result returned by useWebSocket
 */
export interface UseWebSocketResult {
  /**
   * Current connection state
   */
  connectionState: WSConnectionState;

  /**
   * Whether using polling fallback
   */
  usingFallback: boolean;

  /**
   * Number of reconnection attempts
   */
  reconnectAttempts: number;

  /**
   * Last message received
   */
  lastMessage: WSMessage | null;

  /**
   * Timestamp of last message
   */
  lastMessageAt: Date | null;

  /**
   * Send a message to the server
   */
  send: (message: Omit<WSMessage, 'timestamp'>) => boolean;

  /**
   * Manually reconnect
   */
  reconnect: () => void;

  /**
   * Disconnect and disable reconnection
   */
  disconnect: () => void;

  /**
   * Polling result (if using fallback)
   */
  polling?: ReturnType<typeof usePolling<unknown>>;
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  useExponential: boolean
): number {
  if (!useExponential) {
    return initialDelay;
  }
  const delay = initialDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * React hook for WebSocket connection with automatic reconnection and polling fallback
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Graceful fallback to HTTP polling if WebSocket unavailable
 * - Connection state tracking
 * - Event-driven message handling
 * - Manual send/reconnect/disconnect controls
 *
 * @example
 * ```tsx
 * const { connectionState, lastMessage, send } = useWebSocket({
 *   onMessage: (msg) => console.log('Received:', msg),
 *   pollingFetcher: () => fetch('/api/status').then(r => r.json()),
 * });
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketResult {
  const {
    url: urlProp,
    enabled = true,
    fallbackToPolling = true,
    pollingInterval = 5000,
    reconnect: reconnectOptions = {},
    onMessage,
    onConnectionChange,
    onError,
    pollingFetcher,
  } = options;

  const reconnectConfig = {
    enabled: reconnectOptions.enabled ?? true,
    maxAttempts: reconnectOptions.maxAttempts ?? Infinity,
    initialDelay: reconnectOptions.initialDelay ?? 1000,
    maxDelay: reconnectOptions.maxDelay ?? 30000,
    exponentialBackoff: reconnectOptions.exponentialBackoff ?? true,
  };

  // Derive WebSocket URL from current location if not provided
  const getWebSocketUrl = useCallback(() => {
    if (urlProp) return urlProp;

    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/ws`;
    }

    return 'ws://localhost:3002/ws';
  }, [urlProp]);

  // State
  const [connectionState, setConnectionState] = useState<WSConnectionState>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [lastMessageAt, setLastMessageAt] = useState<Date | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const manualCloseRef = useRef(false);

  // Polling hook for fallback
  const polling = usePolling<unknown>({
    fetcher: pollingFetcher || (() => Promise.resolve(null)),
    interval: pollingInterval,
    enabled: usingFallback && enabled && !!pollingFetcher,
  });

  /**
   * Update connection state and trigger callback
   */
  const updateConnectionState = useCallback(
    (state: WSConnectionState) => {
      if (!isMountedRef.current) return;

      setConnectionState(state);
      onConnectionChange?.(state);

      // Update fallback mode based on connection state
      if (state === 'connected') {
        setUsingFallback(false);
      } else if (fallbackToPolling && reconnectAttempts >= reconnectConfig.maxAttempts) {
        setUsingFallback(true);
      }
    },
    [onConnectionChange, fallbackToPolling, reconnectAttempts, reconnectConfig.maxAttempts]
  );

  /**
   * Clear reconnect timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Schedule reconnection attempt
   */
  const scheduleReconnect = useCallback(() => {
    if (!reconnectConfig.enabled || reconnectAttempts >= reconnectConfig.maxAttempts) {
      if (fallbackToPolling && pollingFetcher) {
        setUsingFallback(true);
        updateConnectionState('disconnected');
      }
      return;
    }

    clearReconnectTimeout();

    const delay = getBackoffDelay(
      reconnectAttempts,
      reconnectConfig.initialDelay,
      reconnectConfig.maxDelay,
      reconnectConfig.exponentialBackoff
    );

    updateConnectionState('connecting');

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !manualCloseRef.current) {
        setReconnectAttempts(prev => prev + 1);
        connect();
      }
    }, delay);
  }, [
    reconnectAttempts,
    reconnectConfig,
    fallbackToPolling,
    pollingFetcher,
    updateConnectionState,
    clearReconnectTimeout,
  ]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      updateConnectionState('connecting');

      ws.onopen = () => {
        if (!isMountedRef.current) return;

        console.log('WebSocket connected');
        setReconnectAttempts(0);
        updateConnectionState('connected');
        clearReconnectTimeout();
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!isMountedRef.current) return;

        try {
          const message = JSON.parse(event.data) as WSMessage;
          setLastMessage(message);
          setLastMessageAt(new Date());
          onMessage?.(message);

          // Respond to pings
          if (message.type === 'ping') {
            send({ type: 'pong', data: null });
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error: Event) => {
        if (!isMountedRef.current) return;

        console.error('WebSocket error:', error);
        onError?.(error);
        updateConnectionState('error');
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;

        console.log('WebSocket disconnected');
        wsRef.current = null;

        if (!manualCloseRef.current) {
          scheduleReconnect();
        } else {
          updateConnectionState('disconnected');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      updateConnectionState('error');

      if (fallbackToPolling) {
        scheduleReconnect();
      }
    }
  }, [
    enabled,
    getWebSocketUrl,
    updateConnectionState,
    onMessage,
    onError,
    scheduleReconnect,
    clearReconnectTimeout,
    fallbackToPolling,
  ]);

  /**
   * Send message to server
   */
  const send = useCallback((message: Omit<WSMessage, 'timestamp'>): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const fullMessage: WSMessage = {
        ...message,
        timestamp: new Date().toISOString(),
      };
      ws.send(JSON.stringify(fullMessage));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }, []);

  /**
   * Manually reconnect
   */
  const reconnect = useCallback(() => {
    manualCloseRef.current = false;
    setReconnectAttempts(0);
    setUsingFallback(false);
    clearReconnectTimeout();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    connect();
  }, [connect, clearReconnectTimeout]);

  /**
   * Disconnect and disable auto-reconnect
   */
  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    clearReconnectTimeout();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    updateConnectionState('disconnected');
  }, [clearReconnectTimeout, updateConnectionState]);

  /**
   * Effect: Manage WebSocket connection lifecycle
   */
  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    // Attempt connection
    connect();

    // Cleanup
    return () => {
      isMountedRef.current = false;
      clearReconnectTimeout();

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled]); // Only re-run on enabled change

  return {
    connectionState,
    usingFallback,
    reconnectAttempts,
    lastMessage,
    lastMessageAt,
    send,
    reconnect,
    disconnect,
    polling: usingFallback ? polling : undefined,
  };
}
