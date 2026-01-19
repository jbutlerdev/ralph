import { NextResponse } from 'next/server';
import { loadPlan, validateRalphPlan } from '../../../../lib/plan-utils';
import path from 'path';
import { readFile } from 'fs/promises';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/plans/[id]
 *
 * Returns a specific Ralph implementation plan by ID.
 * The ID corresponds to the plan directory name.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Validate the plan ID to prevent directory traversal
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

    // Get project root
    const projectRoot = path.resolve(process.cwd(), '..');
    const planPath = path.join(projectRoot, 'plans', id, 'IMPLEMENTATION_PLAN.md');

    // Try to read the plan file
    let planContent: string;
    try {
      planContent = await readFile(planPath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json(
          {
            success: false,
            error: 'Plan not found',
            message: `No plan found with ID: ${id}`,
          },
          {
            status: 404,
            headers: getCorsHeaders(),
          }
        );
      }
      throw error;
    }

    // Parse the plan from markdown
    const plan = loadPlan(planPath);

    // Validate the plan structure
    const validation = validateRalphPlan(await plan);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid plan format',
          message: 'The plan file contains errors',
          validationErrors: validation.errors,
          warnings: validation.warnings,
        },
        {
          status: 400,
          headers: getCorsHeaders(),
        }
      );
    }

    const parsedPlan = await plan;

    // Return the plan with validation results
    return NextResponse.json(
      {
        success: true,
        plan: {
          id,
          name: parsedPlan.projectName,
          description: parsedPlan.description,
          overview: parsedPlan.overview,
          tasks: parsedPlan.tasks,
          metadata: {
            totalTasks: parsedPlan.totalTasks,
            generatedAt: parsedPlan.generatedAt,
            estimatedDuration: parsedPlan.estimatedDuration,
          },
          validation: {
            valid: validation.valid,
            warnings: validation.warnings,
          },
        },
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      }
    );
  } catch (error) {
    console.error('Error loading plan:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load plan',
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
 * OPTIONS /api/plans/[id]
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
function getCorsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
