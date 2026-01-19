/**
 * Ralph WebSocket Server
 *
 * Provides real-time updates for Ralph task execution by watching the `.ralph/`
 * directory for changes and broadcasting updates to connected clients.
 *
 * Events broadcasted:
 * - task.completed: When a task completes successfully
 * - task.started: When a task begins execution
 * - task.failed: When a task fails
 * - session.changed: When session state changes
 * - checkpoint.created: When a checkpoint is created
 */

import { WebSocketServer, WebSocket } from 'ws';
import chokidar, { type FSWatcher } from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as http from 'http';

/**
 * WebSocket message types
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
 * Server configuration
 */
export interface WSServerConfig {
  /**
   * HTTP server to attach WebSocket server to
   */
  server?: http.Server;

  /**
   * Port to listen on (if not attaching to existing server)
   */
  port?: number;

  /**
   * Host to bind to
   */
  host?: string;

  /**
   * Path to the Ralph project root (contains .ralph directory)
   */
  projectRoot: string;

  /**
   * WebSocket path
   */
  path?: string;

  /**
   * Heartbeat interval in milliseconds (default: 30000)
   */
  heartbeatInterval?: number;
}

/**
 * Ralph WebSocket Server class
 */
export class RalphWSServer {
  private wss?: WebSocketServer;
  private watcher?: FSWatcher;
  private config: WSServerConfig;
  private heartbeatTimer?: NodeJS.Timeout;
  private projectRoot: string;
  private ralphDir: string;
  private clients: Set<WebSocket> = new Set();

  constructor(config: WSServerConfig) {
    this.config = config;
    this.projectRoot = path.resolve(config.projectRoot);
    this.ralphDir = path.join(this.projectRoot, '.ralph');
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    // Verify .ralph directory exists
    try {
      await fs.access(this.ralphDir);
    } catch {
      console.warn(`.ralph directory not found at ${this.ralphDir}. Server will start but may not broadcast events.`);
    }

    // Create WebSocket server
    if (this.config.server) {
      // Attach to existing HTTP server
      this.wss = new WebSocketServer({
        server: this.config.server,
        path: this.config.path || '/ws',
      });
      console.log(`WebSocket server attached to HTTP server at path ${this.config.path || '/ws'}`);
    } else {
      // Create standalone server
      const port = this.config.port || 3002;
      const host = this.config.host || 'localhost';
      this.wss = new WebSocketServer({
        port,
        host,
        path: this.config.path || '/ws',
      });
      console.log(`WebSocket server listening on ws://${host}:${port}${this.config.path || '/ws'}`);
    }

    // Setup connection handler
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    // Start file watcher
    await this.startWatcher();

    // Start heartbeat
    this.startHeartbeat();

    console.log('Ralph WebSocket server started');
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    // Stop file watcher
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }

    // Close all client connections
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = undefined;
    }

    console.log('Ralph WebSocket server stopped');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    console.log(`New WebSocket connection (${this.clients.size + 1} total)`);

    // Add to clients set
    this.clients.add(ws);

    // Send welcome message
    this.sendToClient(ws, {
      type: 'session.changed',
      timestamp: new Date().toISOString(),
      data: {
        connected: true,
        projectRoot: this.projectRoot,
      },
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      this.clients.delete(ws);
      console.log(`WebSocket connection closed (${this.clients.size} remaining)`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.clients.delete(ws);
    });

    // Respond to pings
    ws.on('ping', () => {
      ws.pong();
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(ws: WebSocket, message: WSMessage): void {
    switch (message.type) {
      case 'ping':
        this.sendToClient(ws, {
          type: 'pong',
          timestamp: new Date().toISOString(),
          data: null,
        });
        break;
      default:
        console.log('Unhandled message type:', message.type);
    }
  }

  /**
   * Start watching .ralph directory for changes
   */
  private async startWatcher(): Promise<void> {
    const sessionsDir = path.join(this.ralphDir, 'sessions');
    const checkpointsDir = path.join(this.ralphDir, 'checkpoints');

    // Watch directories
    const watchPaths = [sessionsDir, checkpointsDir];

    this.watcher = chokidar.watch(watchPaths, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    // Handle session file changes
    this.watcher.on('change', async (filePath: string) => {
      await this.handleFileChange(filePath);
    });

    this.watcher.on('add', async (filePath: string) => {
      await this.handleFileChange(filePath);
    });

    console.log(`Watching for changes in: ${watchPaths.join(', ')}`);
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(filePath: string): Promise<void> {
    try {
      const relativePath = path.relative(this.ralphDir, filePath);
      const sessionsDir = 'sessions';
      const checkpointsDir = 'checkpoints';

      if (relativePath.startsWith(sessionsDir)) {
        // Session file changed
        await this.handleSessionChange(filePath);
      } else if (relativePath.startsWith(checkpointsDir)) {
        // Checkpoint created/changed
        await this.handleCheckpointChange(filePath);
      }
    } catch (error) {
      console.error('Error handling file change:', error);
      this.broadcastError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle session file change
   */
  private async handleSessionChange(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const session = JSON.parse(content) as {
        sessionId: string;
        completedTasks: string[];
        failedTasks: string[];
        currentTaskId: string | null;
        taskHistory: Array<{
          taskId: string;
          status: string;
          startedAt?: string;
          completedAt?: string;
          error?: string;
        }>;
        lastActivity: string;
      };

      // Check for newly completed tasks
      const taskHistory = session.taskHistory || [];
      const recentTasks = taskHistory.slice(-5); // Check last 5 tasks

      for (const task of recentTasks) {
        if (task.status === 'completed') {
          this.broadcast({
            type: 'task.completed',
            timestamp: new Date().toISOString(),
            data: {
              taskId: task.taskId,
              sessionId: session.sessionId,
              timestamp: task.completedAt,
            } as TaskEventData,
          });
        } else if (task.status === 'in_progress') {
          this.broadcast({
            type: 'task.started',
            timestamp: new Date().toISOString(),
            data: {
              taskId: task.taskId,
              sessionId: session.sessionId,
              timestamp: task.startedAt,
            } as TaskEventData,
          });
        } else if (task.status === 'failed') {
          this.broadcast({
            type: 'task.failed',
            timestamp: new Date().toISOString(),
            data: {
              taskId: task.taskId,
              sessionId: session.sessionId,
              error: task.error,
              timestamp: task.startedAt,
            } as TaskEventData,
          });
        }
      }

      // Broadcast session change
      this.broadcast({
        type: 'session.changed',
        timestamp: new Date().toISOString(),
        data: {
          sessionId: session.sessionId,
          completedTasks: session.completedTasks || [],
          failedTasks: session.failedTasks || [],
          currentTaskId: session.currentTaskId,
          lastActivity: session.lastActivity,
        } as SessionChangeData,
      });
    } catch (error) {
      console.error('Error handling session change:', error);
    }
  }

  /**
   * Handle checkpoint file change
   */
  private async handleCheckpointChange(filePath: string): Promise<void> {
    try {
      const filename = path.basename(filePath);
      const sessionId = filename.split('.')[0];

      this.broadcast({
        type: 'checkpoint.created',
        timestamp: new Date().toISOString(),
        data: {
          sessionId,
          checkpointPath: filePath,
          timestamp: new Date().toISOString(),
        } as CheckpointData,
      });
    } catch (error) {
      console.error('Error handling checkpoint change:', error);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (error) {
          console.error('Error sending to client:', error);
          this.clients.delete(client);
        }
      }
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending to client:', error);
      }
    }
  }

  /**
   * Broadcast error to all clients
   */
  private broadcastError(errorMessage: string): void {
    this.broadcast({
      type: 'error',
      timestamp: new Date().toISOString(),
      data: { error: errorMessage },
    });
  }

  /**
   * Start heartbeat to detect stale connections
   */
  private startHeartbeat(): void {
    const interval = this.config.heartbeatInterval || 30000;

    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        } else {
          this.clients.delete(client);
        }
      });
    }, interval);
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

/**
 * Create and start a Ralph WebSocket server
 */
export async function startWSServer(config: WSServerConfig): Promise<RalphWSServer> {
  const server = new RalphWSServer(config);
  await server.start();
  return server;
}

/**
 * Start server from command line
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || process.cwd();
  const port = parseInt(args[1] || '3002', 10);
  const host = args[2] || 'localhost';

  console.log(`Starting Ralph WebSocket server...`);
  console.log(`Project root: ${projectRoot}`);
  console.log(`Listening on: ${host}:${port}`);

  const server = await startWSServer({
    projectRoot,
    port,
    host,
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
