/**
 * Custom Next.js server with WebSocket support
 *
 * This custom server integrates Next.js with the Ralph WebSocket server
 * to enable real-time updates for task execution status.
 *
 * The Web UI always uses the Ralph server registry for multi-project support.
 *
 * Usage:
 *   npm run dev         # Start with WebSocket on default port (3002)
 *   PORT=3001 npm run dev # Start on custom port
 *
 * Environment variables:
 *   - PORT: Server port (default: 3002)
 *   - HOST: Server host (default: 0.0.0.0)
 *   - WS_PATH: WebSocket path (default: /ws)
 *   - WS_HEARTBEAT_INTERVAL: WebSocket heartbeat interval in ms (default: 30000)
 *   - RALPH_SERVER_URL: Ralph server URL (default: http://localhost:3001)
 *
 * Registry Mode:
 *   The Web UI proxies all plan requests to the Ralph server's registry.
 *   Plans from multiple projects can be managed through a single interface.
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { RalphWSServer } from './server/ws-server.js';
import path from 'path';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3002', 10);
const host = process.env.HOST || '0.0.0.0';
const wsPath = process.env.WS_PATH || '/ws';
const heartbeatInterval = parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10);

// Determine Ralph project root (default to parent directory)
const ralphProjectRoot = process.env.RALPH_PROJECT_ROOT || path.resolve(__dirname, '..');

const app = next({ dev });
const handle = app.getRequestHandler();

let wsServer: RalphWSServer | null = null;

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // Parse URL
      const parsedUrl = parse(req.url!, true);

      // Let Next.js handle the request
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Start WebSocket server
  wsServer = new RalphWSServer({
    server,
    projectRoot: ralphProjectRoot,
    path: wsPath,
    heartbeatInterval,
  });
  wsServer.start()
    .then(() => {
      console.log('WebSocket server started successfully');
    })
    .catch((err) => {
      console.error('Failed to start WebSocket server:', err);
      // Continue without WebSocket - fallback to polling
    });

  server
    .listen(port, host, () => {
      console.log(`> Ready on http://${host}:${port}`);
      console.log(`> WebSocket available at ws://${host}:${port}${wsPath}`);
      console.log(`> Ralph project root: ${ralphProjectRoot}`);
    })
    .on('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    if (wsServer) {
      await wsServer.stop();
      console.log('WebSocket server stopped');
    }

    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
});
