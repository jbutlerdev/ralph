/**
 * Log Event Emitter
 *
 * Provides real-time log streaming capability for the Ralph executor.
 * Uses a simple pub/sub pattern to broadcast log events to connected clients.
 */

import { EventEmitter } from 'events';

/**
 * Log entry structure matching the stream-json format
 */
export interface LogEvent {
  sessionId: string;
  taskId: string;
  timestamp: string;
  entry: {
    id: string;
    timestamp: string;
    type: string;
    subtype?: string;
    role?: 'assistant' | 'user' | 'system' | 'result';
    messageType?: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'system' | 'result';
    content: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    isError?: boolean;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Stats update event
 */
export interface StatsEvent {
  sessionId: string;
  taskId: string;
  stats: {
    totalEntries: number;
    toolCalls: number;
    toolResults: number;
    errors: number;
    cost?: number;
    turns?: number;
  };
}

/**
 * Task status change event
 */
export interface TaskStatusEvent {
  sessionId: string;
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: string;
  error?: string;
}

/**
 * Plan status change event (for dashboard updates)
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
 * Global event emitter for log streaming
 */
class LogEventEmitter extends EventEmitter {
  private static instance: LogEventEmitter;

  private constructor() {
    super();
    // Increase max listeners since we may have many SSE clients
    this.setMaxListeners(100);
  }

  static getInstance(): LogEventEmitter {
    if (!LogEventEmitter.instance) {
      LogEventEmitter.instance = new LogEventEmitter();
    }
    return LogEventEmitter.instance;
  }

  /**
   * Emit a log entry event
   */
  emitLog(event: LogEvent): void {
    this.emit('log', event);
    // Also emit to session-specific channel
    this.emit(`log:${event.sessionId}`, event);
    // And task-specific channel
    this.emit(`log:${event.sessionId}:${event.taskId}`, event);
  }

  /**
   * Emit a stats update event
   */
  emitStats(event: StatsEvent): void {
    this.emit('stats', event);
    this.emit(`stats:${event.sessionId}`, event);
    this.emit(`stats:${event.sessionId}:${event.taskId}`, event);
  }

  /**
   * Emit a task status change event
   */
  emitTaskStatus(event: TaskStatusEvent): void {
    this.emit('task-status', event);
    this.emit(`task-status:${event.sessionId}`, event);
  }

  /**
   * Subscribe to log events for a specific session/task
   */
  subscribeToLogs(
    sessionId: string,
    taskId: string | undefined,
    callback: (event: LogEvent) => void
  ): () => void {
    const channel = taskId ? `log:${sessionId}:${taskId}` : `log:${sessionId}`;
    this.on(channel, callback);
    return () => this.off(channel, callback);
  }

  /**
   * Subscribe to stats events for a specific session/task
   */
  subscribeToStats(
    sessionId: string,
    taskId: string | undefined,
    callback: (event: StatsEvent) => void
  ): () => void {
    const channel = taskId ? `stats:${sessionId}:${taskId}` : `stats:${sessionId}`;
    this.on(channel, callback);
    return () => this.off(channel, callback);
  }

  /**
   * Subscribe to task status events for a specific session
   */
  subscribeToTaskStatus(
    sessionId: string,
    callback: (event: TaskStatusEvent) => void
  ): () => void {
    const channel = `task-status:${sessionId}`;
    this.on(channel, callback);
    return () => this.off(channel, callback);
  }

  /**
   * Emit a plan status change event (for dashboard updates)
   */
  emitPlanStatus(event: PlanStatusEvent): void {
    this.emit('plan-status', event);
    this.emit(`plan-status:${event.planId}`, event);
  }

  /**
   * Subscribe to plan status events
   */
  subscribeToPlanStatus(
    planId: string | undefined,
    callback: (event: PlanStatusEvent) => void
  ): () => void {
    const channel = planId ? `plan-status:${planId}` : 'plan-status';
    this.on(channel, callback);
    return () => this.off(channel, callback);
  }
}

// Export singleton instance
export const logEvents = LogEventEmitter.getInstance();

/**
 * Parse a stream-json line into a log event entry
 */
export function parseStreamJsonLine(
  line: string,
  sessionId: string,
  taskId: string,
  messageIndex: number
): LogEvent['entry'] | null {
  try {
    const parsed = JSON.parse(line);
    const timestamp = parsed.timestamp || new Date().toISOString();

    if (parsed.type === 'system') {
      return {
        id: `msg-${messageIndex}`,
        timestamp,
        type: parsed.type,
        subtype: parsed.subtype,
        role: 'system',
        messageType: 'system',
        content: parsed.subtype === 'init'
          ? `Session initialized (model: ${parsed.model || 'unknown'})`
          : `System: ${parsed.subtype || 'message'}`,
        metadata: parsed,
      };
    } else if (parsed.type === 'assistant') {
      const messageContent = parsed.message?.content;
      if (Array.isArray(messageContent)) {
        // Return only the first content block for now
        // (in reality we'd emit multiple events)
        for (const block of messageContent) {
          if (block.type === 'text') {
            return {
              id: `msg-${messageIndex}`,
              timestamp,
              type: parsed.type,
              role: 'assistant',
              messageType: 'text',
              content: block.text || '',
            };
          } else if (block.type === 'tool_use') {
            return {
              id: `msg-${messageIndex}`,
              timestamp,
              type: parsed.type,
              role: 'assistant',
              messageType: 'tool_use',
              content: `Using tool: ${block.name}`,
              toolName: block.name,
              toolInput: block.input,
            };
          } else if (block.type === 'thinking') {
            return {
              id: `msg-${messageIndex}`,
              timestamp,
              type: parsed.type,
              role: 'assistant',
              messageType: 'thinking',
              content: block.thinking || '',
            };
          }
        }
      }
    } else if (parsed.type === 'user') {
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
            return {
              id: `msg-${messageIndex}`,
              timestamp,
              type: parsed.type,
              role: 'user',
              messageType: 'tool_result',
              content: resultContent,
              isError: block.is_error || false,
            };
          } else if (block.type === 'text') {
            return {
              id: `msg-${messageIndex}`,
              timestamp,
              type: parsed.type,
              role: 'user',
              messageType: 'text',
              content: block.text || '',
            };
          }
        }
      }
    } else if (parsed.type === 'result') {
      return {
        id: `msg-${messageIndex}`,
        timestamp,
        type: parsed.type,
        subtype: parsed.subtype,
        role: 'result',
        messageType: 'result',
        content: parsed.result || '',
        isError: parsed.subtype !== 'success',
        metadata: {
          subtype: parsed.subtype,
          totalCostUsd: parsed.total_cost_usd,
          numTurns: parsed.num_turns,
          durationMs: parsed.duration_ms,
        },
      };
    } else if (parsed.type === 'log') {
      return {
        id: `msg-${messageIndex}`,
        timestamp,
        type: parsed.type,
        role: 'system',
        messageType: 'system',
        content: parsed.content || '',
      };
    }

    return null;
  } catch {
    // Non-JSON line
    return {
      id: `msg-${messageIndex}`,
      timestamp: new Date().toISOString(),
      type: 'raw',
      role: 'system',
      messageType: 'system',
      content: line,
    };
  }
}
