import { NextResponse } from 'next/server';
import { loadPlan, validateRalphPlan, type RalphPlan, type RalphTask } from '../../../../lib/plan-utils';
import { planToMarkdown } from '../../../../lib/ralph/parser';
import { getTaskStatus, getPlanStatusSummary, getCurrentSession, type TaskStatus as RuntimeTaskStatus } from '../../../../lib/ralph/status';
import path from 'path';
import { readFile, writeFile } from 'fs/promises';

// Registry mode - always use Ralph server's API
const RALPH_SERVER_URL = process.env.RALPH_SERVER_URL || 'http://localhost:3001';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/plans/[id]
 *
 * Returns a specific Ralph implementation plan by ID from Ralph server registry.
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

    // Fetch from Ralph server
    const response = await fetch(`${RALPH_SERVER_URL}/plans/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch plan from Ralph server',
          message: `Plan ${id} not found or server error`,
        },
        { status: response.status, headers: getCorsHeaders() }
      );
    }

    const data = await response.json();
    const projectRoot = data.plan.projectRoot;

    // Calculate runtime status from .ralph/sessions if we have a projectRoot
    let tasksWithRuntimeStatus = data.plan.tasks;
    let runtimeStatusSummary: {
      completedTasks: number;
      inProgressTasks: number;
      failedTasks: number;
      blockedTasks: number;
      pendingTasks: number;
      progress: number;
      sessionId: string | null;
    } = {
      completedTasks: 0,
      inProgressTasks: 0,
      failedTasks: 0,
      blockedTasks: 0,
      pendingTasks: data.plan.tasks?.length || 0,
      progress: 0,
      sessionId: null,
    };

    if (projectRoot) {
      try {
        // Load the plan with proper parsing to get task objects
        const plan: RalphPlan = {
          projectName: data.plan.projectName,
          description: data.plan.description || '',
          overview: data.plan.overview || '',
          tasks: data.plan.tasks,
          totalTasks: data.plan.totalTasks || data.plan.tasks?.length || 0,
          generatedAt: data.plan.generatedAt || '',
          estimatedDuration: data.plan.estimatedDuration || '',
        };

        const planPath = data.plan.planPath;
        if (!projectRoot || !planPath) {
          // Fallback to defaults if no project root
          return NextResponse.json({
            success: true,
            plan: {
              id,
              ...data.plan,
              runtimeStatus: {
                completedTasks: 0,
                inProgressTasks: 0,
                failedTasks: 0,
                blockedTasks: 0,
                pendingTasks: data.plan.tasks?.length || 0,
                progress: 0,
                sessionId: null,
              },
            },
          }, { status: 200, headers: getCorsHeaders() });
        }
        // Calculate runtime status from session files
        const taskStatusMap = await getTaskStatus(plan, projectRoot, planPath);
        const statusSummary = await getPlanStatusSummary(plan, projectRoot, planPath);
        const currentSession = await getCurrentSession(projectRoot, planPath);

        // Attach runtime status and acceptance criteria to each task
        tasksWithRuntimeStatus = plan.tasks.map(task => {
          const statusInfo = taskStatusMap.get(task.id);
          return {
            ...task,
            runtimeStatus: (statusInfo?.status || 'pending') as RuntimeTaskStatus,
            // Use acceptance criteria from status info (includes session data)
            acceptanceCriteria: statusInfo?.acceptanceCriteria || task.acceptanceCriteria,
          };
        });

        // Build runtime status summary
        runtimeStatusSummary = {
          completedTasks: statusSummary.completed,
          inProgressTasks: statusSummary.inProgress,
          failedTasks: statusSummary.failed,
          blockedTasks: statusSummary.blocked,
          pendingTasks: statusSummary.pending,
          progress: statusSummary.percentage,
          sessionId: currentSession?.sessionId ?? null,
        };
      } catch (error) {
        console.error('Error calculating runtime status:', error);
        // Fall back to default values if calculation fails
      }
    }

    // Transform to match our expected format
    return NextResponse.json(
      {
        success: true,
        plan: {
          id,
          name: data.plan.projectName,
          description: data.plan.description || 'No description',
          overview: data.plan.overview || '',
          tasks: tasksWithRuntimeStatus,
          metadata: {
            totalTasks: data.plan.totalTasks || data.plan.tasks?.length || 0,
            generatedAt: data.plan.generatedAt || '',
            estimatedDuration: data.plan.estimatedDuration || '',
          },
          validation: {
            valid: true,
            warnings: [],
          },
          projectRoot: data.plan.projectRoot,
          runtimeStatus: runtimeStatusSummary,
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
 * PATCH /api/plans/[id]
 *
 * Updates a task's status in the plan markdown file.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

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
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
        }
      );
    }

    const { taskId, status, updateType, metadata, criterionIndex, criterionCompleted } = body;

    // Handle metadata updates (project name and description)
    if (updateType === 'metadata') {
      // Validate metadata
      if (!metadata || typeof metadata !== 'object') {
        return NextResponse.json(
          {
            success: false,
            error: 'Metadata is required for metadata update type',
          },
          {
            status: 400,
            headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
          }
        );
      }

      console.log('[DEBUG] Metadata update request:', JSON.stringify({ updateType, metadata }));

      // Fetch plan from Ralph server to get the correct projectRoot from registry
      const serverResponse = await fetch(`${RALPH_SERVER_URL}/plans/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!serverResponse.ok) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch plan from Ralph server',
          },
          { status: serverResponse.status, headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }) }
        );
      }

      const serverData = await serverResponse.json();
      const projectRoot = serverData.plan.projectRoot;
      const planPath = serverData.plan.planPath;
      if (!projectRoot || !planPath) {
        return NextResponse.json(
          {
            success: false,
            error: 'Plan does not have a projectRoot or planPath',
          },
          {
            status: 400,
            headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
          }
        );
      }

      // Read current plan file
      let content = await readFile(planPath, 'utf-8');

      console.log('[DEBUG] Original content (lines 1-10):', content.split('\n').slice(0, 10).join('\n'));

      // Update description (Overview) FIRST - before we add/modify Project field
      if (metadata.description !== undefined) {
        console.log('[DEBUG] Updating description to:', metadata.description);
        // Match from "## Overview" header up to (but not including) ## Tasks or **Project:**
        // We use [\s\S]*? to match everything (including newlines) until we hit our stop condition
        const overviewSectionMatch = content.match(/(## Overview\s*\n)([\s\S]*?)(?=\n\n## Tasks|\n\*\*Project:)/m);
        if (overviewSectionMatch) {
          content = content.replace(overviewSectionMatch[0], overviewSectionMatch[1] + metadata.description);
          console.log('[DEBUG] Updated description successfully');
        } else {
          console.log('[DEBUG] Could not find Overview section to update');
        }
      }

      // Then update **Project:** field AFTER description is done
      if (metadata.projectName !== undefined) {
        console.log('[DEBUG] Updating Project name to:', metadata.projectName);
        const projectFieldRegex = /\*\*Project:\*\*\s*(.+)?$/m;
        if (projectFieldRegex.test(content)) {
          // Replace existing **Project:** field
          content = content.replace(projectFieldRegex, `**Project:** ${metadata.projectName}`);
          console.log('[DEBUG] Replaced existing Project field');
        } else {
          // Add **Project:** field after Overview description, before ## Tasks
          // We insert it right after the description (with a newline) and before ## Tasks
          const beforeTasksMatch = content.match(/(## Overview\s*\n[\s\S]*?)(?=\n\n## Tasks)/m);
          if (beforeTasksMatch) {
            content = content.replace(beforeTasksMatch[0], `${beforeTasksMatch[0]}\n**Project:** ${metadata.projectName}`);
            console.log('[DEBUG] Added new Project field after Overview');
          } else {
            console.log('[DEBUG] Could not find place to insert Project field');
          }
        }
        console.log('[DEBUG] After Project update (lines 1-10):', content.split('\n').slice(0, 10).join('\n'));
      }

      // Write back to file
      await writeFile(planPath, content, 'utf-8');

      console.log('[DEBUG] File written successfully');

      return NextResponse.json(
        {
          success: true,
          message: 'Plan metadata updated successfully',
        },
        { headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }) }
      );
    }

    // Handle acceptance criteria toggle
    if (updateType === 'acceptanceCriteria') {
      if (!taskId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Task ID is required',
          },
          {
            status: 400,
            headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
          }
        );
      }

      if (typeof criterionIndex !== 'number' || criterionIndex < 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Criterion index is required and must be a non-negative number',
          },
          {
            status: 400,
            headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
          }
        );
      }

      // Fetch plan from Ralph server to get correct projectRoot
      const serverResponse = await fetch(`${RALPH_SERVER_URL}/plans/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!serverResponse.ok) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch plan from Ralph server',
          },
          { status: serverResponse.status, headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }) }
        );
      }

      const serverData = await serverResponse.json();
      const projectRoot = serverData.plan.projectRoot;
      const planPath = serverData.plan.planPath;
      if (!projectRoot || !planPath) {
        return NextResponse.json(
          {
            success: false,
            error: 'Plan does not have a projectRoot or planPath',
          },
          {
            status: 400,
            headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
          }
        );
      }

      // Read plan
      const plan = await loadPlan(planPath, projectRoot);
      const taskIndex = plan.tasks.findIndex(t => t.id === taskId);

      if (taskIndex === -1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Task not found',
          },
          {
            status: 404,
            headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
          }
        );
      }

      // Update acceptance criterion completion state
      const task = plan.tasks[taskIndex];
      if (criterionIndex >= task.acceptanceCriteria.length) {
        return NextResponse.json(
          {
            success: false,
            error: `Criterion index ${criterionIndex} out of bounds (max: ${task.acceptanceCriteria.length - 1})`,
          },
          {
            status: 400,
            headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
          }
        );
      }

      // Update the completion state - treat criterion as object with text and completed
      const criteria = Array.isArray(task.acceptanceCriteria) ? [...task.acceptanceCriteria] : [];
      const criterion = criteria[criterionIndex];
      if (typeof criterion === 'object' && criterion !== null && 'completed' in criterion) {
        criteria[criterionIndex] = { ...criterion, completed: criterionCompleted ?? !criterion.completed };
      } else {
        // Legacy string format - convert to object
        criteria[criterionIndex] = {
          text: String(criterion),
          completed: criterionCompleted ?? false
        };
      }
      plan.tasks[taskIndex] = {
        ...task,
        acceptanceCriteria: criteria,
      };

      // Validate and write
      const validation = validateRalphPlan(plan);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid plan after update',
            validationErrors: validation.errors,
            warnings: validation.warnings,
          },
          {
            status: 400,
            headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
          }
        );
      }

      const markdown = planToMarkdown(plan);
      await writeFile(planPath, markdown, 'utf-8');

      // Get runtime status and return
      const taskStatusMap = await getTaskStatus(plan, projectRoot, planPath);
      const statusSummary = await getPlanStatusSummary(plan, projectRoot, planPath);
      const currentSession = await getCurrentSession(projectRoot, planPath);

      const tasksWithStatus = plan.tasks.map(task => {
        const statusInfo = taskStatusMap.get(task.id);
        return {
          ...task,
          runtimeStatus: (statusInfo?.status || 'pending') as RuntimeTaskStatus,
          acceptanceCriteria: statusInfo?.acceptanceCriteria || task.acceptanceCriteria,
        };
      });

      return NextResponse.json(
        {
          success: true,
          plan: {
            id,
            name: plan.projectName,
            description: plan.description,
            overview: plan.overview,
            tasks: tasksWithStatus,
            metadata: {
              totalTasks: plan.totalTasks,
              generatedAt: plan.generatedAt,
              estimatedDuration: plan.estimatedDuration,
            },
            validation: {
              valid: validation.valid,
              warnings: validation.warnings,
            },
            runtimeStatus: {
              completedTasks: statusSummary.completed,
              inProgressTasks: statusSummary.inProgress,
              failedTasks: statusSummary.failed,
              blockedTasks: statusSummary.blocked,
              pendingTasks: statusSummary.pending,
              progress: statusSummary.percentage,
              sessionId: currentSession?.sessionId ?? null,
            },
          },
        },
        {
          status: 200,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
        }
      );
    }

    // Handle task status updates (existing behavior)
    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task ID is required',
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
        }
      );
    }

    const validPlanStatuses: RalphTask['status'][] = ['To Do', 'In Progress', 'Implemented', 'Needs Re-Work', 'Verified'];
    if (status && !validPlanStatuses.includes(status as RalphTask['status'])) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validPlanStatuses.join(', ')}`,
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
        }
      );
    }

    // Fetch plan from Ralph server to get the correct projectRoot from registry
    const serverResponse = await fetch(`${RALPH_SERVER_URL}/plans/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!serverResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch plan from Ralph server',
          message: `Plan ${id} not found or server error`,
        },
        { status: serverResponse.status, headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }) }
      );
    }

    const serverData = await serverResponse.json();
    const projectRoot = serverData.plan.projectRoot;
    const planPath = serverData.plan.planPath;
    if (!projectRoot || !planPath) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plan does not have a projectRoot or planPath',
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
        }
      );
    }

    // Read the plan
    const plan = await loadPlan(planPath, projectRoot);
    const taskIndex = plan.tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task not found',
        },
        {
          status: 404,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
        }
      );
    }

    // Update task status if provided
    if (status) {
      plan.tasks[taskIndex].status = status;
    }

    // Validate the updated plan
    const validation = validateRalphPlan(plan);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid plan after update',
          validationErrors: validation.errors,
          warnings: validation.warnings,
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
        }
      );
    }

    // Write back to file
    const markdown = planToMarkdown(plan);
    await writeFile(planPath, markdown, 'utf-8');

    // Get runtime status
    const taskStatusMap = await getTaskStatus(plan, projectRoot, planPath);
    const statusSummary = await getPlanStatusSummary(plan, projectRoot, planPath);
    const currentSession = await getCurrentSession(projectRoot, planPath);

    // Return updated plan
    const tasksWithStatus = plan.tasks.map(task => {
      const statusInfo = taskStatusMap.get(task.id);
      return {
        ...task,
        runtimeStatus: (statusInfo?.status || 'pending') as RuntimeTaskStatus,
        acceptanceCriteria: statusInfo?.acceptanceCriteria || task.acceptanceCriteria,
      };
    });

    return NextResponse.json(
      {
        success: true,
        plan: {
          id,
          name: plan.projectName,
          description: plan.description,
          overview: plan.overview,
          tasks: tasksWithStatus,
          metadata: {
            totalTasks: plan.totalTasks,
            generatedAt: plan.generatedAt,
            estimatedDuration: plan.estimatedDuration,
          },
          validation: {
            valid: validation.valid,
            warnings: validation.warnings,
          },
          runtimeStatus: {
            completedTasks: statusSummary.completed,
            inProgressTasks: statusSummary.inProgress,
            failedTasks: statusSummary.failed,
            blockedTasks: statusSummary.blocked,
            pendingTasks: statusSummary.pending,
            progress: statusSummary.percentage,
            sessionId: currentSession?.sessionId ?? null,
          },
        },
      },
      {
        status: 200,
        headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
      }
    );
  } catch (error) {
    console.error('Error updating plan:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: getCorsHeaders({ allowMethods: 'GET, PATCH, OPTIONS' }),
      }
    );
  }
}

/**
 * PUT /api/plans/[id]/tasks/[taskId]
 *
 * Updates or creates a task in the plan.
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task ID is required',
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, OPTIONS' }),
        }
      );
    }

    const body = await request.json();

    // Validate the plan ID to prevent directory traversal
    if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid plan ID',
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, OPTIONS' }),
        }
      );
    }

    // Validate task ID format
    if (!taskId.match(/^task-\d+$/)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid task ID format. Must be task-XXX format.',
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, OPTIONS' }),
        }
      );
    }

    // Validate request body
    if (!body.title) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task title is required',
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, OPTIONS' }),
        }
      );
    }

    // Fetch plan from Ralph server to get the correct projectRoot from registry
    const serverResponse = await fetch(`${RALPH_SERVER_URL}/plans/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!serverResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch plan from Ralph server',
          message: `Plan ${id} not found or server error`,
        },
        { status: serverResponse.status, headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, OPTIONS' }) }
      );
    }

    const serverData = await serverResponse.json();
    const projectRoot = serverData.plan.projectRoot;
    const planPath = serverData.plan.planPath;
    if (!projectRoot || !planPath) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plan does not have a projectRoot or planPath',
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, OPTIONS' }),
        }
      );
    }

    // Read the plan
    const plan = await loadPlan(planPath, projectRoot);
    const existingTaskIndex = plan.tasks.findIndex(t => t.id === taskId);

    const taskData: RalphTask = {
      id: taskId,
      title: body.title,
      description: body.description || '',
      priority: body.priority || 'medium',
      status: (body.status || 'To Do') as RalphTask['status'],
      dependencies: body.dependencies || [],
      acceptanceCriteria: body.acceptanceCriteria || [],
      tags: body.tags,
      estimatedComplexity: body.estimatedComplexity,
    };

    if (existingTaskIndex >= 0) {
      // Update existing task
      plan.tasks[existingTaskIndex] = taskData;
    } else {
      // Add new task
      plan.tasks.push(taskData);
      plan.totalTasks = plan.tasks.length;
    }

    // Validate the updated plan
    const validation = validateRalphPlan(plan);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid plan after update',
          validationErrors: validation.errors,
          warnings: validation.warnings,
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, OPTIONS' }),
        }
      );
    }

    // Write back to file
    const markdown = planToMarkdown(plan);
    await writeFile(planPath, markdown, 'utf-8');

    // Get runtime status
    const taskStatusMap = await getTaskStatus(plan, projectRoot, planPath);
    const statusSummary = await getPlanStatusSummary(plan, projectRoot, planPath);
    const currentSession = await getCurrentSession(projectRoot, planPath);

    // Return updated plan
    const tasksWithStatus = plan.tasks.map(task => {
      const statusInfo = taskStatusMap.get(task.id);
      return {
        ...task,
        runtimeStatus: (statusInfo?.status || 'pending') as RuntimeTaskStatus,
        acceptanceCriteria: statusInfo?.acceptanceCriteria || task.acceptanceCriteria,
      };
    });

    return NextResponse.json(
      {
        success: true,
        plan: {
          id,
          name: plan.projectName,
          description: plan.description,
          overview: plan.overview,
          tasks: tasksWithStatus,
          metadata: {
            totalTasks: plan.totalTasks,
            generatedAt: plan.generatedAt,
            estimatedDuration: plan.estimatedDuration,
          },
          validation: {
            valid: validation.valid,
            warnings: validation.warnings,
          },
          runtimeStatus: {
            completedTasks: statusSummary.completed,
            inProgressTasks: statusSummary.inProgress,
            failedTasks: statusSummary.failed,
            blockedTasks: statusSummary.blocked,
            pendingTasks: statusSummary.pending,
            progress: statusSummary.percentage,
            sessionId: currentSession?.sessionId ?? null,
          },
        },
      },
      {
        status: 200,
        headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, OPTIONS' }),
      }
    );
  } catch (error) {
    console.error('Error updating task:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update task',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, OPTIONS' }),
      }
    );
  }
}

/**
 * DELETE /api/plans/[id]/tasks/[taskId]
 *
 * Deletes a task from the plan.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task ID is required',
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, DELETE, OPTIONS' }),
        }
      );
    }

    // Validate the plan ID to prevent directory traversal
    if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid plan ID',
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, DELETE, OPTIONS' }),
        }
      );
    }

    // Fetch plan from Ralph server to get the correct projectRoot from registry
    const serverResponse = await fetch(`${RALPH_SERVER_URL}/plans/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!serverResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch plan from Ralph server',
          message: `Plan ${id} not found or server error`,
        },
        { status: serverResponse.status, headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, DELETE, OPTIONS' }) }
      );
    }

    const serverData = await serverResponse.json();
    const projectRoot = serverData.plan.projectRoot;
    const planPath = serverData.plan.planPath;
    if (!projectRoot || !planPath) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plan does not have a projectRoot or planPath',
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, DELETE, OPTIONS' }),
        }
      );
    }

    // Read the plan
    const plan = await loadPlan(planPath, projectRoot);
    const taskIndex = plan.tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task not found',
        },
        {
          status: 404,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, DELETE, OPTIONS' }),
        }
      );
    }

    // Check if other tasks depend on this task
    const dependents = plan.tasks.filter(t => t.dependencies.includes(taskId));
    if (dependents.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete task with dependencies',
          message: `Tasks ${dependents.map(t => t.id).join(', ')} depend on this task`,
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, DELETE, OPTIONS' }),
        }
      );
    }

    // Remove the task
    plan.tasks.splice(taskIndex, 1);
    plan.totalTasks = plan.tasks.length;

    // Validate the updated plan
    const validation = validateRalphPlan(plan);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid plan after deletion',
          validationErrors: validation.errors,
          warnings: validation.warnings,
        },
        {
          status: 400,
          headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, DELETE, OPTIONS' }),
        }
      );
    }

    // Write back to file
    const markdown = planToMarkdown(plan);
    await writeFile(planPath, markdown, 'utf-8');

    // Get runtime status
    const taskStatusMap = await getTaskStatus(plan, projectRoot, planPath);
    const statusSummary = await getPlanStatusSummary(plan, projectRoot, planPath);
    const currentSession = await getCurrentSession(projectRoot, planPath);

    // Return updated plan
    const tasksWithStatus = plan.tasks.map(task => {
      const statusInfo = taskStatusMap.get(task.id);
      return {
        ...task,
        runtimeStatus: (statusInfo?.status || 'pending') as RuntimeTaskStatus,
        acceptanceCriteria: statusInfo?.acceptanceCriteria || task.acceptanceCriteria,
      };
    });

    return NextResponse.json(
      {
        success: true,
        plan: {
          id,
          name: plan.projectName,
          description: plan.description,
          overview: plan.overview,
          tasks: tasksWithStatus,
          metadata: {
            totalTasks: plan.totalTasks,
            generatedAt: plan.generatedAt,
            estimatedDuration: plan.estimatedDuration,
          },
          validation: {
            valid: validation.valid,
            warnings: validation.warnings,
          },
          runtimeStatus: {
            completedTasks: statusSummary.completed,
            inProgressTasks: statusSummary.inProgress,
            failedTasks: statusSummary.failed,
            blockedTasks: statusSummary.blocked,
            pendingTasks: statusSummary.pending,
            progress: statusSummary.percentage,
            sessionId: currentSession?.sessionId ?? null,
          },
        },
      },
      {
        status: 200,
        headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, DELETE, OPTIONS' }),
      }
    );
  } catch (error) {
    console.error('Error deleting task:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete task',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: getCorsHeaders({ allowMethods: 'GET, PATCH, PUT, DELETE, OPTIONS' }),
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
function getCorsHeaders(options?: { allowMethods?: string }): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': options?.allowMethods || 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
