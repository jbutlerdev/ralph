import { NextResponse } from 'next/server';

// Registry mode - always use Ralph server's API
const RALPH_SERVER_URL = process.env.RALPH_SERVER_URL || 'http://localhost:3001';

/**
 * GET /api/plans
 *
 * Lists all available Ralph implementation plans from the Ralph server registry.
 */
export async function GET() {
  try {
    // Forward request to Ralph server
    const response = await fetch(`${RALPH_SERVER_URL}/plans`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch plans from Ralph server',
          message: error.message || response.statusText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform the response to match our expected format
    const plans = data.plans.map((plan: any) => ({
      id: plan.id,
      name: plan.title || plan.id,
      description: plan.description || 'No description',
      path: plan.path,
      projectRoot: plan.projectRoot,
      totalTasks: plan.totalTasks || 0,
      completedTasks: plan.completedTasks ?? 0,
      inProgressTasks: plan.inProgressTasks ?? 0,
      blockedTasks: plan.blockedTasks ?? 0,
      pendingTasks: plan.pendingTasks ?? 0,
      failedTasks: plan.failedTasks ?? 0,
      progress: plan.progress ?? 0,
      registeredAt: plan.registeredAt,
      lastAccessed: plan.lastAccessed,
    }));

    return NextResponse.json(
      {
        success: true,
        plans,
        count: plans.length,
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    console.error('Error listing plans:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list plans',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

/**
 * OPTIONS /api/plans
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
