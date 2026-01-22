/**
 * Ralph Session Logger
 *
 * Logs Claude Code CLI session messages to .ralph/logs/ directory.
 * Captures tool results, file changes, and other meaningful events.
 *
 * Log format follows Claude Code's stream-json output format:
 * - type: 'system' | 'assistant' | 'user' | 'result' | 'log'
 * - Each line is a valid JSON object (NDJSON format)
 */

import * as fs from 'fs/promises';
import { createWriteStream, type WriteStream } from 'fs';
import * as path from 'path';

export interface LogMessage {
  timestamp: string;
  type: string;
  subtype?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tool call information extracted from assistant messages
 */
export interface ToolCall {
  timestamp: string;
  toolName: string;
  toolUseId?: string;
  input?: Record<string, unknown>;
  isComplete: boolean;
}

/**
 * Tool result information extracted from user messages
 */
export interface ToolResult {
  timestamp: string;
  toolUseId: string;
  output?: string;
  isError: boolean;
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

export class SessionLogger {
  private logFilePath: string;
  private writeStream: WriteStream | null = null;

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

  /**
   * Create a write stream for real-time logging
   */
  createWriteStream(): WriteStream {
    if (!this.writeStream) {
      this.writeStream = createWriteStream(this.logFilePath, { flags: 'w' });
    }
    return this.writeStream;
  }

  /**
   * Write a raw line to the log stream
   */
  writeLine(line: string): void {
    if (this.writeStream) {
      this.writeStream.write(line + '\n');
    }
  }

  /**
   * Close the write stream
   */
  closeStream(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
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

  /**
   * Log a raw SDK/CLI message in stream-json format
   */
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

  async close(): Promise<void> {
    this.closeStream();
  }
}

/**
 * Parse a stream-json log file and return conversation messages
 */
export function parseStreamJsonLog(content: string): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  const lines = content.split('\n').filter(line => line.trim());
  let messageIndex = 0;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
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
          metadata: parsed,
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
                  .map((c: any) => c.text || JSON.stringify(c))
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
 * Get summary statistics from parsed messages
 */
export function getConversationStats(messages: ConversationMessage[]): {
  totalMessages: number;
  toolCalls: number;
  toolResults: number;
  textMessages: number;
  errors: number;
  hasResult: boolean;
  resultSuccess: boolean;
  cost?: number;
  turns?: number;
} {
  let toolCalls = 0;
  let toolResults = 0;
  let textMessages = 0;
  let errors = 0;
  let hasResult = false;
  let resultSuccess = false;
  let cost: number | undefined;
  let turns: number | undefined;

  for (const msg of messages) {
    if (msg.type === 'tool_use') toolCalls++;
    else if (msg.type === 'tool_result') {
      toolResults++;
      if (msg.isError) errors++;
    }
    else if (msg.type === 'text') textMessages++;
    else if (msg.type === 'result') {
      hasResult = true;
      resultSuccess = !msg.isError;
      cost = msg.metadata?.totalCostUsd as number | undefined;
      turns = msg.metadata?.numTurns as number | undefined;
    }
    if (msg.isError) errors++;
  }

  return {
    totalMessages: messages.length,
    toolCalls,
    toolResults,
    textMessages,
    errors,
    hasResult,
    resultSuccess,
    cost,
    turns,
  };
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
