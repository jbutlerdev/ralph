/**
 * API Route: GET /api/plans
 *
 * Lists all available Ralph implementation plans by searching for
 * IMPLEMENTATION_PLAN.md files in the project directory.
 */

import { NextRequest, NextResponse } from 'next/server';
import { planFromMarkdown } from '@/lib/ralph/parser';
import { validateRalphPlan } from '@/lib/ralph/parser';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Plan summary returned by the list endpoint
 */
interface PlanSummary {
  id: string;
  name: string;
  path: string;
  totalTasks: number;
  generatedAt?: string;
  isValid: boolean;
  errors: string[];
}

/**
 * Recursively searches for IMPLEMENTATION_PLAN.md files
 */
async function findPlans(dir: string, basePath: string = dir): Promise<string[]> {
  const plans: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip node_modules and .git directories
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
        // Recursively search subdirectories
        const subPlans = await findPlans(fullPath, basePath);
        plans.push(...subPlans);
      } else if (entry.name === 'IMPLEMENTATION_PLAN.md') {
        // Calculate relative path from base
        const relativePath = fullPath;
        plans.push(relativePath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return plans;
}

/**
 * Generates a plan ID from the file path
 */
function generatePlanId(path: string): string {
  // Use the parent directory name as the plan ID
  const parts = path.split('/');
  const dirName = parts[parts.length - 2] || 'root';
  return dirName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
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
 * GET /api/plans
 *
 * Returns a list of all available implementation plans.
 */
export async function GET(request: NextRequest) {
  try {
    // Get the project root from query param or use current working directory
    const searchParams = request.nextUrl.searchParams;
    const projectRoot = searchParams.get('path') || process.cwd();

    // Find all IMPLEMENTATION_PLAN.md files
    const planPaths = await findPlans(projectRoot);

    // Read and parse each plan
    const plans: PlanSummary[] = [];

    for (const planPath of planPaths) {
      try {
        const content = await readFile(planPath, 'utf-8');
        const plan = planFromMarkdown(content);

        const validation = validateRalphPlan(plan);

        plans.push({
          id: generatePlanId(planPath),
          name: extractPlanName(planPath),
          path: planPath,
          totalTasks: plan.totalTasks,
          generatedAt: plan.generatedAt,
          isValid: validation.valid,
          errors: validation.errors,
        });
      } catch (error) {
        // Include failed parses with error info
        plans.push({
          id: generatePlanId(planPath),
          name: extractPlanName(planPath),
          path: planPath,
          totalTasks: 0,
          isValid: false,
          errors: [(error as Error).message],
        });
      }
    }

    // Sort plans by name
    plans.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(
      {
        success: true,
        count: plans.length,
        plans,
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
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list plans',
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/plans
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
