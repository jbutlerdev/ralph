import { NextResponse } from 'next/server';
import { listAllPlans, loadPlan } from '../../../lib/plan-utils';
import path from 'path';

/**
 * GET /api/plans
 *
 * Lists all available Ralph implementation plans.
 * Searches for IMPLEMENTATION_PLAN.md files in the plans directory.
 */
export async function GET() {
  try {
    // Get project root - in development, this is the Ralph project root
    // In production, this would be configured appropriately
    const projectRoot = path.resolve(process.cwd(), '..');

    const planNames = await listAllPlans(projectRoot);

    // Load each plan to get task counts
    const plans = await Promise.all(
      planNames.map(async (name) => {
        try {
          const planPath = path.join(projectRoot, 'plans', name, 'IMPLEMENTATION_PLAN.md');
          const plan = await loadPlan(planPath);
          return {
            id: name,
            name,
            description: plan.description || 'No description',
            path: `plans/${name}/IMPLEMENTATION_PLAN.md`,
            totalTasks: plan.totalTasks,
            completedTasks: 0, // Tasks don't have status yet
            inProgressTasks: 0,
            failedTasks: 0,
          };
        } catch {
          // If we can't load a plan, return basic info
          return {
            id: name,
            name,
            description: 'No description',
            path: `plans/${name}/IMPLEMENTATION_PLAN.md`,
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            failedTasks: 0,
          };
        }
      })
    );

    // Return response with CORS headers for local development
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
