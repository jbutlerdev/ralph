import { NextResponse } from 'next/server';
import { readLogFile, getSessionLogs, getLogStats, listLogFiles, type ParsedLogEntry } from '../../../../../lib/ralph/logs';
import { getCurrentSession } from '../../../../../lib/ralph/status';
import path from 'path';

// Registry mode - always use Ralph server's API
const RALPH_SERVER_URL = process.env.RALPH_SERVER_URL || 'http://localhost:3001';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/plans/[id]/logs
 *
 * Returns Claude Code agent logs for a plan.
 * Query parameters:
 * - taskId: Optional - Get logs for a specific task
 * - sessionId: Optional - Get logs for a specific session (default: current session)
 * - level: Optional - Filter by log level (info, warn, error, debug, success)
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const sessionIdParam = searchParams.get('sessionId');
    const levelParam = searchParams.get('level');

    // Validate plan ID to prevent directory traversal
    if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid plan ID',
          message: 'Plan ID contains invalid characters',
        },
        {
          status: 400,
          headers: getCorsHeaders(),
        }
      );
    }

    // Fetch plan from Ralph server to get projectRoot
    const planResponse = await fetch(`${RALPH_SERVER_URL}/plans/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!planResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch plan from Ralph server',
          message: `Plan ${id} not found or server error`,
        },
        { status: planResponse.status, headers: getCorsHeaders() }
      );
    }

    const planData = await planResponse.json();
    const projectRoot = planData.plan.projectRoot;

    if (!projectRoot) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plan does not have a projectRoot',
        },
        {
          status: 400,
          headers: getCorsHeaders(),
        }
      );
    }

    // Get the current session if no specific sessionId is provided
    let sessionId: string | null | undefined = sessionIdParam;
    if (!sessionId) {
      const currentSession = await getCurrentSession(projectRoot);
      sessionId = currentSession?.sessionId;
    }

    // Get logs
    let logs: ParsedLogEntry[];

    if (taskId) {
      // Get logs for a specific task
      logs = await readLogFile(projectRoot, sessionId || 'unknown', taskId);
    } else if (sessionId) {
      // Get all logs for a session
      const sessionLogsMap = await getSessionLogs(projectRoot, sessionId);
      // Flatten all logs from all tasks in the session
      logs = Array.from(sessionLogsMap.values()).flat();
      // Sort by timestamp
      logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } else {
      // Get all available log files
      const logFiles = await listLogFiles(projectRoot);
      // Read all logs
      const allLogs: ParsedLogEntry[] = [];
      for (const logFile of logFiles) {
        const taskLogs = await readLogFile(projectRoot, logFile.sessionId, logFile.taskId);
        allLogs.push(...taskLogs);
      }
      // Sort by timestamp
      logs = allLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    // Filter by level if specified
    if (levelParam) {
      const levels = levelParam.split(',').map(l => l.trim().toLowerCase()) as ParsedLogEntry['level'][];
      logs = logs.filter(log => log.level && levels.includes(log.level));
    }

    // Get statistics
    const stats = getLogStats(logs);

    // Get available log files
    const logFiles = await listLogFiles(projectRoot);

    return NextResponse.json(
      {
        success: true,
        logs,
        stats,
        availableLogs: logFiles.map(log => ({
          taskId: log.taskId,
          sessionId: log.sessionId,
          lastModified: log.lastModified,
        })),
        sessionId,
        taskId,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      }
    );
  } catch (error) {
    console.error('Error reading logs:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to read logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      }
    );
  }
}

/**
 * OPTIONS /api/plans/[id]/logs
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

/**
 * Helper function to get CORS headers
 */
function getCorsHeaders(options?: { allowMethods?: string }): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': options?.allowMethods || 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
