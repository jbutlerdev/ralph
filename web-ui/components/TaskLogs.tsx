'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  XCircle,
  Bot,
  User,
  Settings,
  Wrench,
  Code,
  Brain,
  DollarSign,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ParsedLogEntry {
  id: string;
  timestamp: string;
  type: string;
  level?: 'info' | 'warn' | 'error' | 'debug' | 'success';
  content: string;
  rawContent?: string;
  metadata?: Record<string, unknown>;
  role?: 'assistant' | 'user' | 'system' | 'result';
  messageType?: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'system' | 'result';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  isError?: boolean;
}

export interface LogStats {
  totalEntries: number;
  byLevel: Record<string, number>;
  byType: Record<string, number>;
  byRole?: Record<string, number>;
  timeRange: {
    earliest: string | null;
    latest: string | null;
  };
  toolCalls?: number;
  toolResults?: number;
  errors?: number;
  hasResult?: boolean;
  resultSuccess?: boolean;
  cost?: number;
  turns?: number;
}

export interface TaskLogsProps {
  planId: string;
  taskId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Role-based styling
const ROLE_STYLES: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
  assistant: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    icon: <Bot className="h-4 w-4 text-blue-500" />,
  },
  user: {
    bg: 'bg-gray-50 dark:bg-gray-950/30',
    border: 'border-gray-200 dark:border-gray-800',
    icon: <User className="h-4 w-4 text-gray-500" />,
  },
  system: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    icon: <Settings className="h-4 w-4 text-purple-500" />,
  },
  result: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
  },
};

// Message type icons
const TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <Info className="h-3.5 w-3.5 text-blue-500" />,
  tool_use: <Wrench className="h-3.5 w-3.5 text-orange-500" />,
  tool_result: <Code className="h-3.5 w-3.5 text-gray-500" />,
  thinking: <Brain className="h-3.5 w-3.5 text-purple-500" />,
  system: <Settings className="h-3.5 w-3.5 text-purple-500" />,
  result: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
};

export function TaskLogs({ planId, taskId, open, onOpenChange }: TaskLogsProps) {
  const [logs, setLogs] = useState<ParsedLogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch logs via REST API
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (taskId) params.set('taskId', taskId);

      const response = await fetch(`/api/plans/${encodeURIComponent(planId)}/logs?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch logs');
        setLogs([]);
        setStats(null);
        return;
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      setLogs([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [planId, taskId]);

  // Start polling as fallback
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(() => {
      fetchLogs();
    }, 2000); // Poll every 2 seconds
  }, [fetchLogs]);

  // Start SSE streaming for live updates
  const startStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const params = new URLSearchParams();
    if (taskId) params.set('taskId', taskId);
    // Use the session ID from the REST fetch if we have it
    if (sessionId) params.set('sessionId', sessionId);

    const url = `/api/plans/${encodeURIComponent(planId)}/logs/stream?${params.toString()}`;

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsStreaming(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'log') {
            setLogs(prev => [...prev, data.entry]);
            // Update stats incrementally
            if (data.entry.messageType === 'tool_use') {
              setStats(prev => prev ? { ...prev, toolCalls: (prev.toolCalls || 0) + 1 } : null);
            }
          } else if (data.type === 'stats') {
            setStats(data.stats);
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        setIsStreaming(false);
        eventSource.close();
        eventSourceRef.current = null;
        // Fall back to polling
        startPolling();
      };
    } catch (err) {
      console.error('Failed to start SSE:', err);
      // Fall back to polling
      startPolling();
    }
  }, [planId, taskId, sessionId, startPolling]);

  // Stop streaming/polling
  const stopUpdates = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Effect: Manage connection lifecycle
  useEffect(() => {
    if (open) {
      fetchLogs();
      // Try SSE first, fall back to polling
      startStreaming();
    } else {
      stopUpdates();
    }

    return () => {
      stopUpdates();
    };
  }, [open, planId, taskId, fetchLogs, startStreaming, stopUpdates]);

  // Effect: Auto-scroll
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const toggleExpand = (entryId: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const truncateContent = (content: string, maxLength = 500) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  const shouldTruncate = (content: string, maxLength = 500) => {
    return content.length > maxLength;
  };

  const formatToolInput = (input: Record<string, unknown> | undefined) => {
    if (!input) return null;
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  const renderEntry = (entry: ParsedLogEntry) => {
    const role = entry.role || 'system';
    const messageType = entry.messageType || 'text';
    const roleStyle = ROLE_STYLES[role] || ROLE_STYLES.system;
    const typeIcon = TYPE_ICONS[messageType] || TYPE_ICONS.text;
    const isExpanded = expandedEntries.has(entry.id);
    const needsTruncation = shouldTruncate(entry.content);

    // Handle error styling
    const isError = entry.isError || entry.level === 'error';
    const errorStyle = isError ? 'border-red-400 dark:border-red-600' : '';

    return (
      <div
        key={entry.id}
        className={cn(
          'rounded-lg border p-3 font-mono text-sm transition-all mb-2',
          roleStyle.bg,
          roleStyle.border,
          errorStyle
        )}
      >
        {/* Entry header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="flex-shrink-0">{roleStyle.icon}</span>
          <span className="font-semibold capitalize text-xs">{role}</span>
          {messageType !== 'text' && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {typeIcon}
                {messageType.replace('_', ' ')}
              </span>
            </>
          )}
          {entry.toolName && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                {entry.toolName}
              </span>
            </>
          )}
          {isError && (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              Error
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatTimestamp(entry.timestamp)}
          </span>
        </div>

        {/* Content */}
        <div className="whitespace-pre-wrap break-words leading-relaxed pl-6">
          {isExpanded || !needsTruncation
            ? entry.content
            : truncateContent(entry.content)
          }
        </div>

        {/* Tool input (for tool_use messages) */}
        {entry.toolInput && isExpanded && (
          <div className="mt-2 pl-6">
            <div className="text-xs text-muted-foreground mb-1">Tool Input:</div>
            <pre className="text-xs bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto">
              {formatToolInput(entry.toolInput)}
            </pre>
          </div>
        )}

        {/* Result metadata */}
        {messageType === 'result' && entry.metadata && (
          <div className="mt-2 pl-6 flex items-center gap-4 text-xs text-muted-foreground">
            {typeof entry.metadata.totalCostUsd === 'number' && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${entry.metadata.totalCostUsd.toFixed(4)}
              </span>
            )}
            {typeof entry.metadata.numTurns === 'number' && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {entry.metadata.numTurns} turns
              </span>
            )}
          </div>
        )}

        {/* Expand/collapse button */}
        {(needsTruncation || entry.toolInput) && (
          <button
            onClick={() => toggleExpand(entry.id)}
            className="mt-2 pl-6 flex items-center gap-1 text-xs font-medium hover:underline focus:outline-none text-muted-foreground"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show more
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={cn(
      'fixed inset-0 z-50',
      open ? 'flex' : 'hidden'
    )}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full h-full bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              {taskId ? `Task Logs: ${taskId}` : 'Execution Logs'}
            </h2>
            <span className="text-sm text-muted-foreground">
              ({logs.length} entries)
            </span>
            {/* Streaming indicator */}
            {isStreaming ? (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Wifi className="h-3 w-3 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <WifiOff className="h-3 w-3" />
                Polling
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Stats summary */}
            {stats && (
              <div className="flex items-center gap-3 mr-4 text-xs text-muted-foreground">
                {stats.toolCalls !== undefined && stats.toolCalls > 0 && (
                  <span className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    {stats.toolCalls} tools
                  </span>
                )}
                {stats.cost !== undefined && stats.cost > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${stats.cost.toFixed(4)}
                  </span>
                )}
                {stats.turns !== undefined && stats.turns > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {stats.turns} turns
                  </span>
                )}
              </div>
            )}

            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                autoScroll ? 'bg-accent' : 'hover:bg-accent'
              )}
              title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
            >
              <ChevronDown className={cn(
                'h-4 w-4 text-muted-foreground',
                autoScroll && 'text-primary'
              )} />
            </button>

            {/* Refresh */}
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              title="Refresh logs"
            >
              <RefreshCw className={cn(
                'h-4 w-4 text-muted-foreground',
                loading && 'animate-spin'
              )} />
            </button>

            {/* Close */}
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              title="Close"
            >
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading logs...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <AlertCircle className="h-6 w-6 mr-2 text-destructive" />
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Terminal className="h-12 w-12 mb-4 opacity-50" />
              <p>No logs available</p>
              <p className="text-sm mt-1">Logs will appear here once a task is executed</p>
            </div>
          ) : (
            <div className="p-4">
              {logs.map(entry => renderEntry(entry))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
