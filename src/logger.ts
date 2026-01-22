/**
 * Ralph Session Logger
 *
 * Logs Claude Code SDK session messages to .ralph/logs/ directory.
 * Captures tool results, file changes, and other meaningful events.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface LogMessage {
  timestamp: string;
  type: string;
  subtype?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export class SessionLogger {
  private logFilePath: string;

  constructor(sessionId: string, projectRoot: string, taskId?: string) {
    const logsDir = path.join(projectRoot, '.ralph', 'logs');
    const logFileName = taskId
      ? `session-${sessionId}-${taskId}.log`
      : `session-${sessionId}.log`;
    this.logFilePath = path.join(logsDir, logFileName);
  }

  async init(): Promise<void> {
    const logDir = path.dirname(this.logFilePath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create log directory: ${error}`);
    }
  }

  private async log(message: LogMessage): Promise<void> {
    const logEntry = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    };
    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      await fs.appendFile(this.logFilePath, logLine, 'utf-8');
    } catch (error) {
      try {
        await this.init();
        await fs.appendFile(this.logFilePath, logLine, 'utf-8');
      } catch {
        // Silently fail
      }
    }
  }

  async logSdkMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== 'object') {
      return;
    }

    const msg = message as Record<string, unknown>;

    // For stream-json format from Claude CLI:
    // - Assistant messages have nested structure: {type: "assistant", message: {...}}
    // - User/tool_result messages have: {type: "user", message: {...}}
    // - Result messages have: {type: "result", subtype: "success", result: "..."}
    // - System messages have: {type: "system", subtype: "init", ...}

    // Extract content based on message type
    let content: string | undefined;
    const subtype = msg.subtype ? String(msg.subtype) : undefined;

    if (msg.type === 'result') {
      // Result messages have the result directly
      content = msg.result ? String(msg.result) : undefined;
    } else if (msg.type === 'system') {
      // System messages don't have content
      content = undefined;
    } else {
      // For assistant and user messages, content is nested in msg.message.content
      const nestedMessage = msg.message as Record<string, unknown> | undefined;
      if (nestedMessage && nestedMessage.content) {
        // Try to stringify the content array
        if (Array.isArray(nestedMessage.content)) {
          content = JSON.stringify(nestedMessage.content);
        } else if (typeof nestedMessage.content === 'string') {
          content = nestedMessage.content;
        } else {
          content = JSON.stringify(nestedMessage.content);
        }
      } else {
        // Fall back to stringifying entire message
        content = JSON.stringify(msg);
      }
    }

    const logEntry: LogMessage = {
      timestamp: new Date().toISOString(),
      type: String(msg.type || 'unknown'),
      subtype,
      content,
    };

    // Include full message in metadata for detailed inspection
    const metadata: Record<string, unknown> = { rawMessage: msg };
    if (Object.keys(msg).length > 0) {
      logEntry.metadata = metadata;
    }

    await this.log(logEntry);
  }

  async logMessage(level: 'info' | 'warn' | 'error' | 'debug', message: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'log',
      content: `[${level.toUpperCase()}] ${message}`,
    });
  }

  getLogPath(): string {
    return this.logFilePath;
  }

  async close(): Promise<void> {}
}

export async function createTaskLogger(
  sessionId: string,
  projectRoot: string,
  taskId: string
): Promise<SessionLogger> {
  const logger = new SessionLogger(sessionId, projectRoot, taskId);
  await logger.init();
  return logger;
}

export async function createSessionLogger(
  sessionId: string,
  projectRoot: string
): Promise<SessionLogger> {
  const logger = new SessionLogger(sessionId, projectRoot);
  await logger.init();
  return logger;
}
