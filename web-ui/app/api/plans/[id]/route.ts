/**
 * API Route: GET /api/plans/[id]
 *
 * Returns a specific Ralph implementation plan by ID.
 * The plan ID corresponds to the directory containing IMPLEMENTATION_PLAN.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { planFromMarkdown } from '@/lib/ralph/parser';
import { validateRalphPlan } from '@/lib/ralph/parser';
import { readFile, access, readdir } from 'fs/promises';
import { join } from 'path';

/**
 * Recursively searches for a plan by matching directory name to ID
 */
async function findPlanById(dir: string, targetId: string, basePath: string = dir): Promise<string | null> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip common directories to ignore
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === '.next' ||
        entry.name === 'dist' ||
        entry.name === 'build'
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        // Check if this directory's ID matches
        const dirId = entry.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        if (dirId === targetId) {
          const planPath = join(fullPath, 'IMPLEMENTATION_PLAN.md');
          try {
            await access(planPath);
            return planPath;
          } catch {
            // File doesn't exist, continue searching
          }
        }

        // Recursively search subdirectories
        const result = await findPlanById(fullPath, targetId, basePath);
        if (result) {
          return result;
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return null;
}

/**
 * Extracts plan name from the path
 */
function extractPlanName(path: string): string {
  const parts = path.split('/');
  const dirName = parts[parts.length - 2] || 'Project';
  return dirName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * GET /api/plans/[id]
 *
 * Returns the full implementation plan for the given ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id || id === 'undefined' || id === '[object Object]') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid plan ID',
        },
        { status: 400 }
      );
    }

    // Get the project root from query param or use current working directory
    const searchParams = request.nextUrl.searchParams;
    const projectRoot = searchParams.get('path') || process.cwd();

    // Find the plan file
    const planPath = await findPlanById(projectRoot, id);

    if (!planPath) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plan not found',
          message: `No implementation plan found with ID "${id}"`,
        },
        { status: 404 }
      );
    }

    // Read and parse the plan
    const content = await readFile(planPath, 'utf-8');
    const plan = planFromMarkdown(content);

    // Validate the plan
    const validation = validateRalphPlan(plan);

    return NextResponse.json(
      {
        success: true,
        plan: {
          ...plan,
          id,
          name: extractPlanName(planPath),
          path: planPath,
        },
        validation,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    const errorMessage = (error as Error).message;

    // Determine appropriate status code based on error type
    let statusCode = 500;
    if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
      statusCode = 404;
    } else if (errorMessage.includes('parse') || errorMessage.includes('invalid')) {
      statusCode = 400;
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load plan',
        message: errorMessage,
      },
      { status: statusCode }
    );
  }
}

/**
 * OPTIONS /api/plans/[id]
 *
 * Handles CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
