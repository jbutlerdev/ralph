/**
 * Ralph Logs Reader
 *
 * Reads Claude Code agent logs from .ralph/logs/ directory.
 * Logs are captured during task execution and contain tool results,
 * file changes, and other meaningful events.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Log message types from Claude Code SDK stream-json format
 */
export type LogMessageType =
  | 'assistant'    // AI responses
  | 'user'         // User messages/prompts
  | 'result'       // Execution results
  | 'system'       // System messages
  | 'log';         // Internal log messages

/**
 * Log message entry from .ralph/logs/*.log files
 */
export interface LogMessage {
  timestamp: string;
  type: LogMessageType;
  subtype?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Task log information
 */
export interface TaskLogInfo {
  taskId: string;
  sessionId: string;
  logPath: string;
  exists: boolean;
  messageCount?: number;
  lastModified?: string;
}

/**
 * Parsed log with readable format
 */
export interface ParsedLogEntry {
  id: string;
  timestamp: string;
  type: LogMessageType;
  level?: 'info' | 'warn' | 'error' | 'debug' | 'success';
  content: string;
  rawContent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Ralph logs directory structure
 */
const LOGS_DIR = path.join('.ralph', 'logs');

/**
 * Get log file path for a task
 */
export function getTaskLogPath(
  sessionId: string,
  taskId: string
): string {
  return path.join(LOGS_DIR, `session-${sessionId}-${taskId}.log`);
}

/**
 * Get session log file path
 */
export function getSessionLogPath(sessionId: string): string {
  return path.join(LOGS_DIR, `session-${sessionId}.log`);
}

/**
 * List all available log files
 */
export async function listLogFiles(
  projectRoot: string
): Promise<TaskLogInfo[]> {
  const logsDir = path.join(projectRoot, LOGS_DIR);

  try {
    await fs.access(logsDir);
  } catch {
    return [];
  }

  try {
    const files = await fs.readdir(logsDir);
    const logFiles: TaskLogInfo[] = [];

    for (const file of files) {
      if (!file.endsWith('.log')) continue;

      const logPath = path.join(logsDir, file);
      const stats = await fs.stat(logPath);

      // Parse filename to extract session and task ID
      // Format: session-{sessionId}-{taskId}.log or session-{sessionId}.log
      const match = file.match(/^session-([^-.]+)(?:-([^-.]+))?\.log$/);

      if (match) {
        const [, sessionId, taskId] = match;

        logFiles.push({
          taskId: taskId || 'session',
          sessionId,
          logPath,
          exists: true,
          lastModified: stats.mtime.toISOString(),
        });
      }
    }

    return logFiles;
  } catch (error) {
    console.error('Error listing log files:', error);
    return [];
  }
}

/**
 * Read and parse a log file
 */
export async function readLogFile(
  projectRoot: string,
  sessionId: string,
  taskId?: string
): Promise<ParsedLogEntry[]> {
  const logFileName = taskId
    ? `session-${sessionId}-${taskId}.log`
    : `session-${sessionId}.log`;

  const logPath = path.join(projectRoot, LOGS_DIR, logFileName);

  try {
    await fs.access(logPath);
  } catch {
    return [];
  }

  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    const entries: ParsedLogEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const message = JSON.parse(lines[i]) as LogMessage;
        entries.push(parseLogMessage(message, i));
      } catch {
        // Skip malformed lines
        continue;
      }
    }

    return entries;
  } catch (error) {
    console.error('Error reading log file:', error);
    return [];
  }
}

/**
 * Parse a log message into a readable format
 */
function parseLogMessage(
  message: LogMessage,
  index: number
): ParsedLogEntry {
  const { timestamp, type, subtype, content, metadata } = message;

  let level: ParsedLogEntry['level'] = 'info';
  let parsedContent = content || '';

  // Determine log level and format content based on message type
  if (type === 'result') {
    if (subtype === 'success') {
      level = 'success';
      parsedContent = content || 'Task completed successfully';
    } else if (subtype === 'error_during_execution') {
      level = 'error';
      const errors = (metadata?.rawMessage as Record<string, unknown>)?.errors;
      parsedContent = `Task failed: ${Array.isArray(errors) ? errors.join(', ') : 'Unknown error'}`;
    }
  } else if (type === 'log') {
    // Extract level from log content: "[INFO] message", "[ERROR] message", etc.
    const logMatch = content?.match(/^\[(INFO|WARN|ERROR|DEBUG|SUCCESS)\]\s*(.*)$/i);
    if (logMatch) {
      const [, logLevel, logContent] = logMatch;
      level = logLevel.toLowerCase() as ParsedLogEntry['level'];
      parsedContent = logContent;
    }
  } else if (type === 'system') {
    level = 'debug';
    parsedContent = subtype ? `System: ${subtype}` : 'System message';
  } else if (type === 'assistant') {
    level = 'info';
    // Parse assistant content for readability
    if (content) {
      try {
        const contentArray = JSON.parse(content);
        if (Array.isArray(contentArray)) {
          // Extract text from content blocks
          const textBlocks = contentArray
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
          parsedContent = textBlocks || content;
        }
      } catch {
        parsedContent = content;
      }
    }
  } else if (type === 'user') {
    level = 'debug';
    parsedContent = content || 'User message';
  }

  return {
    id: `log-${index}`,
    timestamp,
    type,
    level,
    content: parsedContent,
    rawContent: content,
    metadata,
  };
}

/**
 * Get logs for a specific task
 * Searches for logs matching the task ID across all sessions
 */
export async function getTaskLogs(
  projectRoot: string,
  taskId: string
): Promise<ParsedLogEntry[]> {
  const logFiles = await listLogFiles(projectRoot);

  // Find log files matching the task ID
  const matchingLogs = logFiles.filter(log => log.taskId === taskId);

  if (matchingLogs.length === 0) {
    return [];
  }

  // Read the most recent log file for this task
  const sortedLogs = matchingLogs.sort((a, b) => {
    const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
    const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
    return bTime - aTime; // Most recent first
  });

  const mostRecent = sortedLogs[0];
  return await readLogFile(projectRoot, mostRecent.sessionId, mostRecent.taskId);
}

/**
 * Get all logs for a session (all tasks)
 */
export async function getSessionLogs(
  projectRoot: string,
  sessionId: string
): Promise<Map<string, ParsedLogEntry[]>> {
  const logFiles = await listLogFiles(projectRoot);

  // Find all log files for this session
  const sessionLogs = logFiles.filter(log => log.sessionId === sessionId);

  const logsMap = new Map<string, ParsedLogEntry[]>();

  for (const logInfo of sessionLogs) {
    const entries = await readLogFile(projectRoot, logInfo.sessionId, logInfo.taskId);
    logsMap.set(logInfo.taskId, entries);
  }

  return logsMap;
}

/**
 * Filter log entries by level
 */
export function filterLogsByLevel(
  logs: ParsedLogEntry[],
  levels: ParsedLogEntry['level'][]
): ParsedLogEntry[] {
  return logs.filter(log => levels.includes(log.level));
}

/**
 * Get log statistics
 */
export interface LogStats {
  totalEntries: number;
  byLevel: Record<string, number>;
  byType: Record<string, number>;
  timeRange: {
    earliest: string | null;
    latest: string | null;
  };
}

export function getLogStats(logs: ParsedLogEntry[]): LogStats {
  const stats: LogStats = {
    totalEntries: logs.length,
    byLevel: {},
    byType: {},
    timeRange: {
      earliest: null,
      latest: null,
    },
  };

  for (const log of logs) {
    // Count by level
    stats.byLevel[log.level || 'info'] = (stats.byLevel[log.level || 'info'] || 0) + 1;

    // Count by type
    stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;

    // Track time range
    const timestamp = new Date(log.timestamp).getTime();
    if (!stats.timeRange.earliest || timestamp < new Date(stats.timeRange.earliest).getTime()) {
      stats.timeRange.earliest = log.timestamp;
    }
    if (!stats.timeRange.latest || timestamp > new Date(stats.timeRange.latest).getTime()) {
      stats.timeRange.latest = log.timestamp;
    }
  }

  return stats;
}
