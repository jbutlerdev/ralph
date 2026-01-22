import { NextResponse } from 'next/server';

// Registry mode - always use Ralph server's API
const RALPH_SERVER_URL = process.env.RALPH_SERVER_URL || 'http://localhost:3001';

/**
 * POST /api/plans/[id]/restart
 *
 * Restarts execution of a Ralph implementation plan.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;

    // Get request body (optional execution options)
    const body = await request.json();

    // Forward request to Ralph server
    const response = await fetch(`${RALPH_SERVER_URL}/plans/${encodeURIComponent(planId)}/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } else {
          // Response is not JSON, read text for debugging
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch {
        // Failed to parse error body, use status text
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to restart plan execution',
          message: errorMessage,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(
      {
        success: true,
        sessionId: data.sessionId,
        status: data.status,
        plan: data.plan,
        projectRoot: data.projectRoot,
        message: data.message,
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    console.error('Error restarting plan:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to restart plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

/**
 * OPTIONS /api/plans/[id]/restart
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
