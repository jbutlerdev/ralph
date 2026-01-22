'use client';

import { useState, useEffect } from 'react';
import {
  Terminal,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  XCircle,
  AlertTriangle,
  Bug,
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
}

export interface TaskLogsProps {
  planId: string;
  taskId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  info: <Info className="h-3.5 w-3.5 text-blue-500" />,
  warn: <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />,
  error: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  debug: <Bug className="h-3.5 w-3.5 text-gray-400" />,
  success: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
};

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
  warn: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
  error: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  debug: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800',
  success: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
};

export function TaskLogs({ planId, taskId, open, onOpenChange }: TaskLogsProps) {
  const [logs, setLogs] = useState<ParsedLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open, planId, taskId]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (taskId) params.set('taskId', taskId);
      if (filterLevel !== 'all') params.set('level', filterLevel);

      const response = await fetch(`/api/plans/${encodeURIComponent(planId)}/logs?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        setError(error.message || 'Failed to fetch logs');
        setLogs([]);
        return;
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

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

  const truncateContent = (content: string, maxLength = 200) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  const hasRawContent = (entry: ParsedLogEntry) => {
    return entry.rawContent && entry.rawContent.length > (entry.content?.length || 0) + 50;
  };

  const levelOptions = [
    { value: 'all', label: 'All' },
    { value: 'info', label: 'Info' },
    { value: 'warn', label: 'Warnings' },
    { value: 'error', label: 'Errors' },
    { value: 'debug', label: 'Debug' },
    { value: 'success', label: 'Success' },
  ];

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
          </div>

          <div className="flex items-center gap-2">
            {/* Filter */}
            <div className="flex items-center gap-1">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterLevel}
                onChange={(e) => {
                  setFilterLevel(e.target.value);
                }}
                className="text-sm bg-transparent border border-input rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {levelOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

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
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Terminal className="h-12 w-12 mb-4 opacity-50" />
              <p>No logs available</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {logs.map((entry) => {
                const level = entry.level || 'info';
                const icon = LEVEL_ICONS[level];
                const colorClass = LEVEL_COLORS[level];
                const isExpanded = expandedEntries.has(entry.id);
                const hasMore = hasRawContent(entry);

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'rounded-lg border p-3 font-mono text-sm transition-all',
                      colorClass
                    )}
                  >
                    {/* Entry header */}
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 mt-0.5">
                        {icon}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase">
                            {level}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {entry.type}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>

                        <div className="whitespace-pre-wrap break-words leading-relaxed">
                          {isExpanded || !hasMore
                            ? entry.content
                            : truncateContent(entry.content)
                          }
                        </div>

                        {/* Expand/collapse button */}
                        {hasMore && (
                          <button
                            onClick={() => toggleExpand(entry.id)}
                            className="mt-2 flex items-center gap-1 text-xs font-medium hover:underline focus:outline-none"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                Show more ({(entry.rawContent?.length || 0) - (entry.content?.length || 0)} more chars)
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
