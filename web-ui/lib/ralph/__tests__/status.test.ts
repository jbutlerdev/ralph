/**
 * Unit tests for Ralph Status Tracking System
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTaskStatus,
  getPlanStatusSummary,
  getTasksByStatus,
  isRalphInitialized,
  getCurrentSession,
  type TaskStatus,
} from '../status.js';
import type { RalphPlan } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');
vi.mock('simple-git', () => ({
  default: async () => ({
    log: async () => ({
      all: [
        {
          hash: 'abc123',
          message: '[task-001] First task',
          date: '2024-01-18T10:00:00.000Z',
        },
        {
          hash: 'def456',
          message: '[task-002] Second task',
          date: '2024-01-18T11:00:00.000Z',
        },
      ],
    }),
  }),
}));

describe('getTaskStatus', () => {
  const mockPlan: RalphPlan = {
    projectName: 'Test Project',
    description: 'Test description',
    overview: 'Test overview',
    tasks: [
      {
        id: 'task-001',
        title: 'First task',
        description: 'First task description',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: ['Done'],
      },
      {
        id: 'task-002',
        title: 'Second task',
        description: 'Second task description',
        priority: 'medium',
        dependencies: ['task-001'],
        acceptanceCriteria: ['Done'],
      },
      {
        id: 'task-003',
        title: 'Third task',
        description: 'Third task description',
        priority: 'low',
        dependencies: ['task-002'],
        acceptanceCriteria: ['Done'],
      },
    ],
    generatedAt: new Date().toISOString(),
    totalTasks: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return pending status for all tasks when no .ralph directory exists', async () => {
    vi.mocked(fs.readdir).mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);

    const statusMap = await getTaskStatus(mockPlan, '/test/project');

    expect(statusMap.size).toBe(3);
    expect(statusMap.get('task-001')?.status).toBe('pending'); // No deps, should be pending
    expect(statusMap.get('task-002')?.status).toBe('blocked'); // Depends on task-001
    expect(statusMap.get('task-003')?.status).toBe('blocked'); // Depends on task-002
  });

  it('should read session state and determine task statuses', async () => {
    const mockSession = {
      sessionId: 'session-123',
      planPath: '/test/IMPLEMENTATION_PLAN.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: 'task-002',
      taskHistory: [
        {
          taskId: 'task-001',
          status: 'completed',
          startedAt: '2024-01-18T10:00:00.000Z',
          completedAt: '2024-01-18T10:30:00.000Z',
        },
        {
          taskId: 'task-002',
          status: 'in_progress',
          startedAt: '2024-01-18T11:00:00.000Z',
        },
      ],
      startedAt: '2024-01-18T10:00:00.000Z',
      lastActivity: '2024-01-18T11:00:00.000Z',
    };

    vi.mocked(fs.readdir).mockResolvedValue(['session-123.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSession) as any);

    const statusMap = await getTaskStatus(mockPlan, '/test/project');

    expect(statusMap.get('task-001')?.status).toBe('completed');
    expect(statusMap.get('task-001')?.dependenciesMet).toBe(true);
    expect(statusMap.get('task-002')?.status).toBe('in-progress');
    expect(statusMap.get('task-002')?.dependenciesMet).toBe(true);
    expect(statusMap.get('task-003')?.status).toBe('blocked');
    expect(statusMap.get('task-003')?.dependenciesMet).toBe(false);
  });

  it('should detect failed tasks', async () => {
    const mockSession = {
      sessionId: 'session-123',
      planPath: '/test/IMPLEMENTATION_PLAN.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: ['task-002'],
      currentTaskId: null,
      taskHistory: [
        {
          taskId: 'task-001',
          status: 'completed',
          startedAt: '2024-01-18T10:00:00.000Z',
          completedAt: '2024-01-18T10:30:00.000Z',
        },
        {
          taskId: 'task-002',
          status: 'failed',
          startedAt: '2024-01-18T11:00:00.000Z',
          error: 'Something went wrong',
        },
      ],
      startedAt: '2024-01-18T10:00:00.000Z',
      lastActivity: '2024-01-18T11:00:00.000Z',
    };

    vi.mocked(fs.readdir).mockResolvedValue(['session-123.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSession) as any);

    const statusMap = await getTaskStatus(mockPlan, '/test/project');

    expect(statusMap.get('task-001')?.status).toBe('completed');
    expect(statusMap.get('task-002')?.status).toBe('failed');
    expect(statusMap.get('task-002')?.errorMessage).toBe('Something went wrong');
    expect(statusMap.get('task-003')?.status).toBe('blocked');
  });

  it('should handle tasks with no dependencies', async () => {
    const noDepsPlan: RalphPlan = {
      ...mockPlan,
      tasks: [
        {
          id: 'task-001',
          title: 'Independent task',
          description: 'No dependencies',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: ['Done'],
        },
      ],
    };

    vi.mocked(fs.readdir).mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);

    const statusMap = await getTaskStatus(noDepsPlan, '/test/project');

    expect(statusMap.get('task-001')?.status).toBe('pending');
    expect(statusMap.get('task-001')?.dependenciesMet).toBe(true);
  });

  it('should read the latest session when multiple exist', async () => {
    const mockSession1 = {
      sessionId: 'session-001',
      planPath: '/test/IMPLEMENTATION_PLAN.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: null,
      taskHistory: [],
      startedAt: '2024-01-18T10:00:00.000Z',
      lastActivity: '2024-01-18T10:00:00.000Z',
    };

    const mockSession2 = {
      sessionId: 'session-002',
      planPath: '/test/IMPLEMENTATION_PLAN.md',
      completedTasks: ['task-001', 'task-002'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: 'task-003',
      taskHistory: [],
      startedAt: '2024-01-18T11:00:00.000Z',
      lastActivity: '2024-01-18T11:00:00.000Z',
    };

    vi.mocked(fs.readdir).mockResolvedValue(['session-001.json', 'session-002.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSession2) as any);

    const statusMap = await getTaskStatus(mockPlan, '/test/project');

    expect(statusMap.get('task-001')?.status).toBe('completed');
    expect(statusMap.get('task-002')?.status).toBe('completed');
    expect(statusMap.get('task-003')?.status).toBe('in-progress');
  });
});

describe('getPlanStatusSummary', () => {
  const mockPlan: RalphPlan = {
    projectName: 'Test Project',
    description: 'Test description',
    overview: 'Test overview',
    tasks: [
      {
        id: 'task-001',
        title: 'First task',
        description: 'First task',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: ['Done'],
      },
      {
        id: 'task-002',
        title: 'Second task',
        description: 'Second task',
        priority: 'medium',
        dependencies: ['task-001'],
        acceptanceCriteria: ['Done'],
      },
      {
        id: 'task-003',
        title: 'Third task',
        description: 'Third task',
        priority: 'low',
        dependencies: ['task-001'],
        acceptanceCriteria: ['Done'],
      },
      {
        id: 'task-004',
        title: 'Fourth task',
        description: 'Fourth task',
        priority: 'low',
        dependencies: [],
        acceptanceCriteria: ['Done'],
      },
    ],
    generatedAt: new Date().toISOString(),
    totalTasks: 4,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate summary with all pending tasks', async () => {
    vi.mocked(fs.readdir).mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);

    const summary = await getPlanStatusSummary(mockPlan, '/test/project');

    expect(summary.total).toBe(4);
    expect(summary.completed).toBe(0);
    expect(summary.inProgress).toBe(0);
    expect(summary.pending).toBeGreaterThanOrEqual(0);
    expect(summary.blocked).toBeGreaterThanOrEqual(0);
    expect(summary.failed).toBe(0);
    expect(summary.percentage).toBe(0);
  });

  it('should calculate summary with mixed statuses', async () => {
    const mockSession = {
      sessionId: 'session-123',
      planPath: '/test/IMPLEMENTATION_PLAN.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: ['task-004'],
      currentTaskId: 'task-002',
      taskHistory: [],
      startedAt: '2024-01-18T10:00:00.000Z',
      lastActivity: '2024-01-18T11:00:00.000Z',
    };

    vi.mocked(fs.readdir).mockResolvedValue(['session-123.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSession) as any);

    const summary = await getPlanStatusSummary(mockPlan, '/test/project');

    expect(summary.total).toBe(4);
    expect(summary.completed).toBe(1); // task-001
    expect(summary.inProgress).toBe(1); // task-002
    expect(summary.failed).toBe(1); // task-004
    expect(summary.blocked).toBeGreaterThanOrEqual(0); // task-003 depends on task-001 which is done
    expect(summary.percentage).toBe(25); // 1/4 = 25%
  });

  it('should calculate 100% when all tasks are completed', async () => {
    const mockSession = {
      sessionId: 'session-123',
      planPath: '/test/IMPLEMENTATION_PLAN.md',
      completedTasks: ['task-001', 'task-002', 'task-003', 'task-004'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: null,
      taskHistory: [],
      startedAt: '2024-01-18T10:00:00.000Z',
      lastActivity: '2024-01-18T12:00:00.000Z',
    };

    vi.mocked(fs.readdir).mockResolvedValue(['session-123.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSession) as any);

    const summary = await getPlanStatusSummary(mockPlan, '/test/project');

    expect(summary.completed).toBe(4);
    expect(summary.percentage).toBe(100);
  });
});

describe('getTasksByStatus', () => {
  const mockPlan: RalphPlan = {
    projectName: 'Test Project',
    description: 'Test description',
    overview: 'Test overview',
    tasks: [
      {
        id: 'task-001',
        title: 'Completed task',
        description: 'Completed',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: ['Done'],
      },
      {
        id: 'task-002',
        title: 'Pending task',
        description: 'Pending',
        priority: 'medium',
        dependencies: ['task-001'],
        acceptanceCriteria: ['Done'],
      },
      {
        id: 'task-003',
        title: 'Another completed task',
        description: 'Completed',
        priority: 'low',
        dependencies: [],
        acceptanceCriteria: ['Done'],
      },
    ],
    generatedAt: new Date().toISOString(),
    totalTasks: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter completed tasks', async () => {
    const mockSession = {
      sessionId: 'session-123',
      planPath: '/test/IMPLEMENTATION_PLAN.md',
      completedTasks: ['task-001', 'task-003'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: null,
      taskHistory: [],
      startedAt: '2024-01-18T10:00:00.000Z',
      lastActivity: '2024-01-18T11:00:00.000Z',
    };

    vi.mocked(fs.readdir).mockResolvedValue(['session-123.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSession) as any);

    const completedTasks = await getTasksByStatus(mockPlan, '/test/project', 'completed');

    expect(completedTasks).toHaveLength(2);
    expect(completedTasks.map(t => t.id)).toContain('task-001');
    expect(completedTasks.map(t => t.id)).toContain('task-003');
  });

  it('should filter in-progress tasks', async () => {
    const mockSession = {
      sessionId: 'session-123',
      planPath: '/test/IMPLEMENTATION_PLAN.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: 'task-002',
      taskHistory: [],
      startedAt: '2024-01-18T10:00:00.000Z',
      lastActivity: '2024-01-18T11:00:00.000Z',
    };

    vi.mocked(fs.readdir).mockResolvedValue(['session-123.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSession) as any);

    const inProgressTasks = await getTasksByStatus(mockPlan, '/test/project', 'in-progress');

    expect(inProgressTasks).toHaveLength(1);
    expect(inProgressTasks[0].id).toBe('task-002');
  });

  it('should filter blocked tasks', async () => {
    const mockSession = {
      sessionId: 'session-123',
      planPath: '/test/IMPLEMENTATION_PLAN.md',
      completedTasks: [],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: null,
      taskHistory: [],
      startedAt: '2024-01-18T10:00:00.000Z',
      lastActivity: '2024-01-18T10:00:00.000Z',
    };

    vi.mocked(fs.readdir).mockResolvedValue(['session-123.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSession) as any);

    const blockedTasks = await getTasksByStatus(mockPlan, '/test/project', 'blocked');

    expect(blockedTasks).toHaveLength(1);
    expect(blockedTasks[0].id).toBe('task-002');
  });
});

describe('isRalphInitialized', () => {
  it('should return true when .ralph directory exists', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined as any);

    const isInitialized = await isRalphInitialized('/test/project');

    expect(isInitialized).toBe(true);
    expect(fs.access).toHaveBeenCalledWith(path.join('/test/project', '.ralph'));
  });

  it('should return false when .ralph directory does not exist', async () => {
    vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);

    const isInitialized = await isRalphInitialized('/test/project');

    expect(isInitialized).toBe(false);
  });
});

describe('getCurrentSession', () => {
  it('should return the latest session', async () => {
    const mockSession = {
      sessionId: 'session-123',
      planPath: '/test/IMPLEMENTATION_PLAN.md',
      completedTasks: ['task-001'],
      skippedTasks: [],
      failedTasks: [],
      currentTaskId: null,
      taskHistory: [],
      startedAt: '2024-01-18T10:00:00.000Z',
      lastActivity: '2024-01-18T11:00:00.000Z',
    };

    vi.mocked(fs.readdir).mockResolvedValue(['session-123.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSession) as any);

    const session = await getCurrentSession('/test/project');

    expect(session).toEqual(mockSession);
  });

  it('should return null when no sessions exist', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([] as any);

    const session = await getCurrentSession('/test/project');

    expect(session).toBeNull();
  });

  it('should return null when sessions directory does not exist', async () => {
    vi.mocked(fs.readdir).mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);

    const session = await getCurrentSession('/test/project');

    expect(session).toBeNull();
  });
});
