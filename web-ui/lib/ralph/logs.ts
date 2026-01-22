/**
 * Ralph Logs Reader
 *
 * Reads Claude Code agent logs from .ralph/logs/ directory.
 * Logs are captured during task execution and contain tool results,
 * file changes, and other meaningful events.
 *
 * Log format follows Claude Code's stream-json output format.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Log message types from Claude Code stream-json format
 */
export type LogMessageType =
  | 'assistant'    // AI responses
  | 'user'         // User messages/prompts (tool results)
  | 'result'       // Execution results
  | 'system'       // System messages
  | 'log';         // Internal log messages

/**
 * Raw log entry from stream-json output
 */
export interface RawLogEntry {
  timestamp?: string;
  type: string;
  subtype?: string;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      input?: Record<string, unknown>;
      content?: string | Array<{ text?: string }>;
      is_error?: boolean;
      thinking?: string;
    }>;
  };
  result?: string;
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  session_id?: string;
  model?: string;
  content?: string;
}

/**
 * Conversation message for display
 */
export interface ConversationMessage {
  id: string;
  timestamp: string;
  role: 'assistant' | 'user' | 'system' | 'result';
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'system' | 'result';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  isError?: boolean;
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
 * Parsed log with readable format (legacy format for backward compatibility)
 */
export interface ParsedLogEntry {
  id: string;
  timestamp: string;
  type: LogMessageType;
  level?: 'info' | 'warn' | 'error' | 'debug' | 'success';
  content: string;
  rawContent?: string;
  metadata?: Record<string, unknown>;
  // New fields for conversational display
  role?: 'assistant' | 'user' | 'system' | 'result';
  messageType?: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'system' | 'result';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  isError?: boolean;
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
 * Parse stream-json log content into conversation messages
 */
export function parseStreamJsonLog(content: string): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  const lines = content.split('\n').filter(line => line.trim());
  let messageIndex = 0;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as RawLogEntry;
      const timestamp = parsed.timestamp || new Date().toISOString();

      if (parsed.type === 'system') {
        messages.push({
          id: `msg-${messageIndex++}`,
          timestamp,
          role: 'system',
          type: 'system',
          content: parsed.subtype === 'init'
            ? `Session initialized (model: ${parsed.model || 'unknown'})`
            : `System: ${parsed.subtype || 'message'}`,
          metadata: parsed as unknown as Record<string, unknown>,
        });
      } else if (parsed.type === 'assistant') {
        // Parse assistant message content
        const messageContent = parsed.message?.content;
        if (Array.isArray(messageContent)) {
          for (const block of messageContent) {
            if (block.type === 'text') {
              messages.push({
                id: `msg-${messageIndex++}`,
                timestamp,
                role: 'assistant',
                type: 'text',
                content: block.text || '',
              });
            } else if (block.type === 'tool_use') {
              messages.push({
                id: `msg-${messageIndex++}`,
                timestamp,
                role: 'assistant',
                type: 'tool_use',
                content: `Using tool: ${block.name}`,
                toolName: block.name,
                toolInput: block.input,
              });
            } else if (block.type === 'thinking') {
              messages.push({
                id: `msg-${messageIndex++}`,
                timestamp,
                role: 'assistant',
                type: 'thinking',
                content: block.thinking || '',
              });
            }
          }
        }
      } else if (parsed.type === 'user') {
        // Parse user/tool result message content
        const messageContent = parsed.message?.content;
        if (Array.isArray(messageContent)) {
          for (const block of messageContent) {
            if (block.type === 'tool_result') {
              let resultContent = '';
              if (typeof block.content === 'string') {
                resultContent = block.content;
              } else if (Array.isArray(block.content)) {
                resultContent = block.content
                  .map((c) => c.text || JSON.stringify(c))
                  .join('\n');
              }
              messages.push({
                id: `msg-${messageIndex++}`,
                timestamp,
                role: 'user',
                type: 'tool_result',
                content: resultContent,
                isError: block.is_error || false,
              });
            } else if (block.type === 'text') {
              messages.push({
                id: `msg-${messageIndex++}`,
                timestamp,
                role: 'user',
                type: 'text',
                content: block.text || '',
              });
            }
          }
        }
      } else if (parsed.type === 'result') {
        messages.push({
          id: `msg-${messageIndex++}`,
          timestamp,
          role: 'result',
          type: 'result',
          content: parsed.result || '',
          isError: parsed.subtype !== 'success',
          metadata: {
            subtype: parsed.subtype,
            totalCostUsd: parsed.total_cost_usd,
            numTurns: parsed.num_turns,
            durationMs: parsed.duration_ms,
          },
        });
      } else if (parsed.type === 'log') {
        // Internal log message
        messages.push({
          id: `msg-${messageIndex++}`,
          timestamp,
          role: 'system',
          type: 'system',
          content: parsed.content || '',
        });
      }
    } catch {
      // Non-JSON line, treat as raw output
      messages.push({
        id: `msg-${messageIndex++}`,
        timestamp: new Date().toISOString(),
        role: 'system',
        type: 'system',
        content: line,
      });
    }
  }

  return messages;
}

/**
 * Convert conversation messages to legacy ParsedLogEntry format
 */
function conversationToLegacy(messages: ConversationMessage[]): ParsedLogEntry[] {
  return messages.map((msg) => {
    let level: ParsedLogEntry['level'] = 'info';
    let legacyType: LogMessageType = 'assistant';

    if (msg.role === 'system') {
      legacyType = 'system';
      level = 'debug';
    } else if (msg.role === 'assistant') {
      legacyType = 'assistant';
      level = 'info';
    } else if (msg.role === 'user') {
      legacyType = 'user';
      level = msg.isError ? 'error' : 'debug';
    } else if (msg.role === 'result') {
      legacyType = 'result';
      level = msg.isError ? 'error' : 'success';
    }

    return {
      id: msg.id,
      timestamp: msg.timestamp,
      type: legacyType,
      level,
      content: msg.content,
      rawContent: msg.content,
      metadata: msg.metadata,
      // Include new fields
      role: msg.role,
      messageType: msg.type,
      toolName: msg.toolName,
      toolInput: msg.toolInput,
      isError: msg.isError,
    };
  });
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
    const conversationMessages = parseStreamJsonLog(content);
    return conversationToLegacy(conversationMessages);
  } catch (error) {
    console.error('Error reading log file:', error);
    return [];
  }
}

/**
 * Read log file and return conversation messages
 */
export async function readLogFileAsConversation(
  projectRoot: string,
  sessionId: string,
  taskId?: string
): Promise<ConversationMessage[]> {
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
    return parseStreamJsonLog(content);
  } catch (error) {
    console.error('Error reading log file:', error);
    return [];
  }
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
  byRole: Record<string, number>;
  timeRange: {
    earliest: string | null;
    latest: string | null;
  };
  toolCalls: number;
  toolResults: number;
  errors: number;
  hasResult: boolean;
  resultSuccess: boolean;
  cost?: number;
  turns?: number;
}

export function getLogStats(logs: ParsedLogEntry[]): LogStats {
  const stats: LogStats = {
    totalEntries: logs.length,
    byLevel: {},
    byType: {},
    byRole: {},
    timeRange: {
      earliest: null,
      latest: null,
    },
    toolCalls: 0,
    toolResults: 0,
    errors: 0,
    hasResult: false,
    resultSuccess: false,
  };

  for (const log of logs) {
    // Count by level
    stats.byLevel[log.level || 'info'] = (stats.byLevel[log.level || 'info'] || 0) + 1;

    // Count by type
    stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;

    // Count by role
    if (log.role) {
      stats.byRole[log.role] = (stats.byRole[log.role] || 0) + 1;
    }

    // Track tool calls and results
    if (log.messageType === 'tool_use') stats.toolCalls++;
    if (log.messageType === 'tool_result') stats.toolResults++;

    // Track errors
    if (log.isError || log.level === 'error') stats.errors++;

    // Track result
    if (log.messageType === 'result' || log.type === 'result') {
      stats.hasResult = true;
      stats.resultSuccess = !log.isError;
      if (log.metadata) {
        stats.cost = log.metadata.totalCostUsd as number | undefined;
        stats.turns = log.metadata.numTurns as number | undefined;
      }
    }

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
