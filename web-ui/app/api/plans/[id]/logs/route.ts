import { NextResponse } from 'next/server';

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
 * Proxies to the main Ralph server's /logs endpoint.
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);

  // We need to find the sessionId to pass to the server.
  // The client might provide it, but if not, we need to get it from the latest session for this plan.
  let sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    try {
      const planResponse = await fetch(`${RALPH_SERVER_URL}/plans/${id}`);
      if (planResponse.ok) {
        const planData = await planResponse.json();
        // The server doesn't directly expose the session ID per plan,
        // so we'll just let the server figure it out if we don't have one.
        // This relies on the server's /logs endpoint being able to find the latest session.
      }
    } catch (e) {
      // ignore, we'll proceed without a session ID
    }
  }


  const serverParams = new URLSearchParams(searchParams);
  serverParams.set('planId', id);

  try {
    const response = await fetch(`${RALPH_SERVER_URL}/logs?${serverParams.toString()}`);

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch logs from Ralph server',
          message: error.message || response.statusText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect to Ralph server for logs',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
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
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
