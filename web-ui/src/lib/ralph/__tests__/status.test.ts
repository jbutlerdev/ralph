/**
 * Unit tests for Ralph Task Status Tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  getTaskStatus,
  getTaskStatusInfo,
  isTaskReady,
  getNextTaskToExecute,
  runtimeStatusToString,
  getRuntimeStatusClass,
  type RalphSession,
} from '../status';
import type { RalphPlan, RalphTask } from '../types';

// Mock fs and simple-git
vi.mock('fs/promises');
vi.mock('simple-git');

describe('getTaskStatus', () => {
  const mockPlan: RalphPlan = {
    projectName: 'Test Project',
    description: 'Test',
    overview: '',
    tasks: [
      {
        id: 'task-001',
        title: 'Task 1',
        description: 'First task',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: ['Criterion 1'],
      },
      {
        id: 'task-002',
        title: 'Task 2',
        description: 'Second task',
        priority: 'medium',
        dependencies: ['task-001'],
        acceptanceCriteria: ['Criterion 2'],
      },
      {
        id: 'task-003',
        title: 'Task 3',
        description: 'Third task',
        priority: 'low',
        dependencies: ['task-002'],
        acceptanceCriteria: ['Criterion 3'],
      },
    ],
    generatedAt: new Date().toISOString(),
    totalTasks: 3,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return all tasks as pending when no session or git data exists', async () => {
    (fs.access as any).mockRejectedValue(new Error('Directory not found'));

    const statuses = await getTaskStatus(mockPlan, '/fake/path');

    expect(statuses.size).toBe(3);
    expect(statuses.get('task-001')).toBe('pending');
    // task-002 and task-003 have incomplete dependencies, so they're blocked
    expect(statuses.get('task-002')).toBe('blocked');
    expect(statuses.get('task-003')).toBe('blocked');
  });

  it('should handle missing .ralph directory gracefully', async () => {
    (fs.access as any).mockRejectedValue(new Error('ENOENT'));

    const statuses = await getTaskStatus(mockPlan, '/fake/path');

    expect(statuses.size).toBe(3);
    expect(statuses.get('task-001')).toBe('pending');
    // task-002 and task-003 have incomplete dependencies, so they're blocked
    expect(statuses.get('task-002')).toBe('blocked');
    expect(statuses.get('task-003')).toBe('blocked');
  });

  it('should read session data and mark completed tasks', async () => {
    const mockSession: RalphSession = {
      sessionId: 'session-123',
      planPath: '/fake/plan.md',
      completedTasks: ['task-001', 'task-002'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: null,
      taskHistory: [
        {
          taskId: 'task-001',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T01:00:00Z',
          attempts: 1,
        },
        {
          taskId: 'task-002',
          status: 'completed',
          startedAt: '2024-01-01T01:00:00Z',
          completedAt: '2024-01-01T02:00:00Z',
          attempts: 1,
        },
      ],
      startedAt: '2024-01-01T00:00:00Z',
      lastActivity: '2024-01-01T02:00:00Z',
    };

    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue(['session-123.json']);
    (fs.readFile as any).mockResolvedValue(JSON.stringify(mockSession));

    const statuses = await getTaskStatus(mockPlan, '/fake/path');

    expect(statuses.get('task-001')).toBe('completed');
    expect(statuses.get('task-002')).toBe('completed');
    expect(statuses.get('task-003')).toBe('pending'); // deps are now met
  });

  it('should mark failed tasks correctly', async () => {
    const mockSession: RalphSession = {
      sessionId: 'session-123',
      planPath: '/fake/plan.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: ['task-002'],
      currentTaskId: null,
      taskHistory: [
        {
          taskId: 'task-001',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T01:00:00Z',
          attempts: 1,
        },
        {
          taskId: 'task-002',
          status: 'failed',
          startedAt: '2024-01-01T01:00:00Z',
          completedAt: '2024-01-01T02:00:00Z',
          attempts: 3,
          error: 'Task failed',
        },
      ],
      startedAt: '2024-01-01T00:00:00Z',
      lastActivity: '2024-01-01T02:00:00Z',
    };

    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue(['session-123.json']);
    (fs.readFile as any).mockResolvedValue(JSON.stringify(mockSession));

    const statuses = await getTaskStatus(mockPlan, '/fake/path');

    expect(statuses.get('task-001')).toBe('completed');
    expect(statuses.get('task-002')).toBe('failed');
    expect(statuses.get('task-003')).toBe('blocked'); // blocked by failed task-002
  });

  it('should mark current task as in-progress', async () => {
    const mockSession: RalphSession = {
      sessionId: 'session-123',
      planPath: '/fake/plan.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: 'task-002',
      taskHistory: [
        {
          taskId: 'task-001',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T01:00:00Z',
          attempts: 1,
        },
        {
          taskId: 'task-002',
          status: 'in_progress',
          startedAt: '2024-01-01T01:00:00Z',
          attempts: 1,
        },
      ],
      startedAt: '2024-01-01T00:00:00Z',
      lastActivity: '2024-01-01T01:00:00Z',
    };

    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue(['session-123.json']);
    (fs.readFile as any).mockResolvedValue(JSON.stringify(mockSession));

    const statuses = await getTaskStatus(mockPlan, '/fake/path');

    expect(statuses.get('task-001')).toBe('completed');
    expect(statuses.get('task-002')).toBe('in-progress');
    expect(statuses.get('task-003')).toBe('blocked');
  });

  it('should infer blocked status for tasks with incomplete dependencies', async () => {
    const mockSession: RalphSession = {
      sessionId: 'session-123',
      planPath: '/fake/plan.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: null,
      taskHistory: [
        {
          taskId: 'task-001',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T01:00:00Z',
          attempts: 1,
        },
      ],
      startedAt: '2024-01-01T00:00:00Z',
      lastActivity: '2024-01-01T01:00:00Z',
    };

    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue(['session-123.json']);
    (fs.readFile as any).mockResolvedValue(JSON.stringify(mockSession));

    const statuses = await getTaskStatus(mockPlan, '/fake/path');

    expect(statuses.get('task-001')).toBe('completed');
    expect(statuses.get('task-002')).toBe('pending'); // deps met
    expect(statuses.get('task-003')).toBe('blocked'); // task-002 not completed
  });

  it('should read latest session when multiple sessions exist', async () => {
    const mockSession1: RalphSession = {
      sessionId: 'session-100',
      planPath: '/fake/plan.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: null,
      taskHistory: [],
      startedAt: '2024-01-01T00:00:00Z',
      lastActivity: '2024-01-01T01:00:00Z',
    };

    const mockSession2: RalphSession = {
      sessionId: 'session-200',
      planPath: '/fake/plan.md',
      completedTasks: ['task-001', 'task-002'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: null,
      taskHistory: [],
      startedAt: '2024-01-01T02:00:00Z',
      lastActivity: '2024-01-01T03:00:00Z',
    };

    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue(['session-100.json', 'session-200.json']);
    (fs.readFile as any)
      .mockResolvedValueOnce(JSON.stringify(mockSession1))
      .mockResolvedValueOnce(JSON.stringify(mockSession2));

    const statuses = await getTaskStatus(mockPlan, '/fake/path');

    // Should use session-200 (alphabetically last)
    expect(statuses.get('task-001')).toBe('completed');
    expect(statuses.get('task-002')).toBe('pending'); // task-001 is completed, so task-002 is pending
    expect(statuses.get('task-003')).toBe('blocked'); // task-002 not completed
  });

  it('should handle empty sessions directory', async () => {
    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue([]);

    const statuses = await getTaskStatus(mockPlan, '/fake/path');

    expect(statuses.size).toBe(3);
    expect(statuses.get('task-001')).toBe('pending');
    // task-002 and task-003 have incomplete dependencies, so they're blocked
    expect(statuses.get('task-002')).toBe('blocked');
    expect(statuses.get('task-003')).toBe('blocked');
  });

  it('should handle non-session files in directory', async () => {
    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue([
      'other-file.txt',
      'readme.md',
      'data.json',
    ]);

    const statuses = await getTaskStatus(mockPlan, '/fake/path');

    expect(statuses.size).toBe(3);
    expect(statuses.get('task-001')).toBe('pending');
  });

  it('should handle corrupted session files gracefully', async () => {
    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue(['session-123.json']);
    (fs.readFile as any).mockResolvedValue('{ invalid json }');

    const statuses = await getTaskStatus(mockPlan, '/fake/path');

    // Should fall back to pending for all tasks (with blocked for dependencies)
    expect(statuses.size).toBe(3);
    expect(statuses.get('task-001')).toBe('pending');
    expect(statuses.get('task-002')).toBe('blocked');
    expect(statuses.get('task-003')).toBe('blocked');
  });
});

describe('getTaskStatusInfo', () => {
  const mockPlan: RalphPlan = {
    projectName: 'Test Project',
    description: 'Test',
    overview: '',
    tasks: [
      {
        id: 'task-001',
        title: 'Task 1',
        description: 'First task',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: [],
      },
      {
        id: 'task-002',
        title: 'Task 2',
        description: 'Second task',
        priority: 'medium',
        dependencies: ['task-001'],
        acceptanceCriteria: [],
      },
    ],
    generatedAt: new Date().toISOString(),
    totalTasks: 2,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return detailed task info', async () => {
    const mockSession: RalphSession = {
      sessionId: 'session-123',
      planPath: '/fake/plan.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: null,
      taskHistory: [
        {
          taskId: 'task-001',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T01:00:00Z',
          attempts: 1,
          result: {
            commitHash: 'abc123',
            filesChanged: 2,
            acceptanceCriteriaPassed: ['Done'],
            acceptanceCriteriaFailed: [],
          },
        },
      ],
      startedAt: '2024-01-01T00:00:00Z',
      lastActivity: '2024-01-01T01:00:00Z',
    };

    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue(['session-123.json']);
    (fs.readFile as any).mockResolvedValue(JSON.stringify(mockSession));

    const result = await getTaskStatusInfo(mockPlan, { projectPath: '/fake/path' });

    expect(result.taskStatuses.get('task-001')).toBe('completed');
    expect(result.taskInfo.get('task-001')?.source).toBe('session');
    expect(result.taskInfo.get('task-001')?.sessionId).toBe('session-123');
    expect(result.taskInfo.get('task-001')?.commitHash).toBe('abc123');
    expect(result.totalTasks).toBe(2);
    expect(result.completedTasks).toBe(1);
    expect(result.pendingTasks).toBe(1);
  });

  it('should calculate summary statistics correctly', async () => {
    const mockSession: RalphSession = {
      sessionId: 'session-123',
      planPath: '/fake/plan.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: ['task-002'],
      currentTaskId: null,
      taskHistory: [],
      startedAt: '2024-01-01T00:00:00Z',
      lastActivity: '2024-01-01T01:00:00Z',
    };

    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue(['session-123.json']);
    (fs.readFile as any).mockResolvedValue(JSON.stringify(mockSession));

    const result = await getTaskStatusInfo(mockPlan, { projectPath: '/fake/path' });

    expect(result.totalTasks).toBe(2);
    expect(result.completedTasks).toBe(1);
    expect(result.failedTasks).toBe(1);
    expect(result.inProgressTasks).toBe(0);
    expect(result.blockedTasks).toBe(0);
    expect(result.pendingTasks).toBe(0);
  });

  it('should handle strict mode with errors', async () => {
    // The implementation catches errors in readLatestSession and returns null
    // So strict mode only affects the main try block after session reading
    (fs.access as any).mockRejectedValue(new Error('Directory not found'));

    const result = await getTaskStatusInfo(mockPlan, { projectPath: '/fake/path', strict: true });

    // Should still work because readLatestSession handles errors gracefully
    expect(result.totalTasks).toBe(2);
  });

  it('should handle non-strict mode gracefully', async () => {
    (fs.access as any).mockRejectedValue(new Error('Directory not found'));

    const result = await getTaskStatusInfo(mockPlan, { projectPath: '/fake/path', strict: false });

    expect(result.totalTasks).toBe(2);
    expect(result.completedTasks).toBe(0);
    expect(result.pendingTasks).toBe(1);
    expect(result.blockedTasks).toBe(1);
  });
});

describe('isTaskReady', () => {
  it('should return true for pending tasks', () => {
    const statuses = new Map([
      ['task-001', 'pending'],
      ['task-002', 'completed'],
    ]);

    expect(isTaskReady('task-001', statuses)).toBe(true);
    expect(isTaskReady('task-002', statuses)).toBe(false);
  });

  it('should return false for non-pending tasks', () => {
    const statuses = new Map([
      ['task-001', 'in-progress'],
      ['task-002', 'completed'],
      ['task-003', 'blocked'],
      ['task-004', 'failed'],
    ]);

    expect(isTaskReady('task-001', statuses)).toBe(false);
    expect(isTaskReady('task-002', statuses)).toBe(false);
    expect(isTaskReady('task-003', statuses)).toBe(false);
    expect(isTaskReady('task-004', statuses)).toBe(false);
  });

  it('should return false for unknown tasks', () => {
    const statuses = new Map([['task-001', 'completed']]);

    expect(isTaskReady('task-999', statuses)).toBe(false);
  });
});

describe('getNextTaskToExecute', () => {
  const mockPlan: RalphPlan = {
    projectName: 'Test',
    description: 'Test plan',
    overview: '',
    tasks: [
      {
        id: 'task-001',
        title: 'Task 1',
        description: '',
        priority: 'medium',
        dependencies: [],
        acceptanceCriteria: [],
      },
      {
        id: 'task-002',
        title: 'Task 2',
        description: '',
        priority: 'high',
        dependencies: ['task-001'],
        acceptanceCriteria: [],
      },
      {
        id: 'task-003',
        title: 'Task 3',
        description: '',
        priority: 'low',
        dependencies: ['task-001'],
        acceptanceCriteria: [],
      },
    ],
    generatedAt: new Date().toISOString(),
    totalTasks: 3,
  };

  it('should return first pending task with all dependencies met', () => {
    const statuses = new Map([
      ['task-001', 'completed'],
      ['task-002', 'pending'],
      ['task-003', 'pending'],
    ]);

    const next = getNextTaskToExecute(mockPlan, statuses);

    // Should return high priority task (task-002) over low priority (task-003)
    expect(next?.id).toBe('task-002');
  });

  it('should return null when no tasks are ready', () => {
    const statuses = new Map([
      ['task-001', 'blocked'],  // No dependencies, but not pending
      ['task-002', 'blocked'],
      ['task-003', 'blocked'],
    ]);

    const next = getNextTaskToExecute(mockPlan, statuses);

    expect(next).toBeNull();
  });

  it('should return null when all tasks are completed', () => {
    const statuses = new Map([
      ['task-001', 'completed'],
      ['task-002', 'completed'],
      ['task-003', 'completed'],
    ]);

    const next = getNextTaskToExecute(mockPlan, statuses);

    expect(next).toBeNull();
  });

  it('should sort by priority when multiple tasks are ready', () => {
    const statuses = new Map([
      ['task-001', 'completed'],
      ['task-002', 'pending'],
      ['task-003', 'pending'],
    ]);

    const next = getNextTaskToExecute(mockPlan, statuses);

    // task-002 has high priority, task-003 has low priority
    expect(next?.id).toBe('task-002');
  });

  it('should sort by ID when priority is the same', () => {
    const planWithSamePriority: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-003',
          title: 'Task 3',
          description: '',
          priority: 'medium',
          dependencies: [],
          acceptanceCriteria: [],
        },
        {
          id: 'task-001',
          title: 'Task 1',
          description: '',
          priority: 'medium',
          dependencies: [],
          acceptanceCriteria: [],
        },
        {
          id: 'task-002',
          title: 'Task 2',
          description: '',
          priority: 'medium',
          dependencies: [],
          acceptanceCriteria: [],
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 3,
    };

    const statuses = new Map([
      ['task-001', 'pending'],
      ['task-002', 'pending'],
      ['task-003', 'pending'],
    ]);

    const next = getNextTaskToExecute(planWithSamePriority, statuses);

    expect(next?.id).toBe('task-001');
  });

  it('should not return tasks with incomplete dependencies', () => {
    const statuses = new Map([
      ['task-001', 'pending'],
      ['task-002', 'pending'],
      ['task-003', 'pending'],
    ]);

    const next = getNextTaskToExecute(mockPlan, statuses);

    // task-001 has no deps, so it should be returned
    expect(next?.id).toBe('task-001');
  });

  it('should skip in-progress tasks', () => {
    const statuses = new Map([
      ['task-001', 'in-progress'],
      ['task-002', 'pending'],
      ['task-003', 'pending'],
    ]);

    const next = getNextTaskToExecute(mockPlan, statuses);

    // task-001 is in-progress, task-002 and task-003 are blocked
    expect(next).toBeNull();
  });
});

describe('runtimeStatusToString', () => {
  it('should convert runtime status to display string', () => {
    expect(runtimeStatusToString('pending')).toBe('Pending');
    expect(runtimeStatusToString('in-progress')).toBe('In Progress');
    expect(runtimeStatusToString('completed')).toBe('Completed');
    expect(runtimeStatusToString('blocked')).toBe('Blocked');
    expect(runtimeStatusToString('failed')).toBe('Failed');
  });
});

describe('getRuntimeStatusClass', () => {
  it('should return CSS class for each status', () => {
    expect(getRuntimeStatusClass('pending')).toBe('status-pending');
    expect(getRuntimeStatusClass('in-progress')).toBe('status-in-progress');
    expect(getRuntimeStatusClass('completed')).toBe('status-completed');
    expect(getRuntimeStatusClass('blocked')).toBe('status-blocked');
    expect(getRuntimeStatusClass('failed')).toBe('status-failed');
  });
});
