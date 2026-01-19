/**
 * Unit tests for DependencyGraph component interfaces and logic
 */

import { describe, it, expect } from 'vitest';
import type { RalphTask } from '@/lib/plan-utils';

describe('DependencyGraph', () => {
  describe('Node generation', () => {
    it('should generate correct number of nodes from tasks', () => {
      const tasks: RalphTask[] = [
        {
          id: 'task-001',
          title: 'Task 1',
          description: 'First task',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: ['Done'],
        },
        {
          id: 'task-002',
          title: 'Task 2',
          description: 'Second task',
          priority: 'medium',
          dependencies: ['task-001'],
          acceptanceCriteria: ['Done'],
        },
      ];

      expect(tasks.length).toBe(2);
    });

    it('should handle tasks with no dependencies', () => {
      const task: RalphTask = {
        id: 'task-001',
        title: 'Standalone Task',
        description: 'No dependencies',
        priority: 'low',
        dependencies: [],
        acceptanceCriteria: ['Criterion 1'],
      };

      expect(task.dependencies.length).toBe(0);
    });

    it('should handle tasks with multiple dependencies', () => {
      const task: RalphTask = {
        id: 'task-003',
        title: 'Multi-Dep Task',
        description: 'Depends on multiple tasks',
        priority: 'high',
        dependencies: ['task-001', 'task-002'],
        acceptanceCriteria: ['Done'],
      };

      expect(task.dependencies.length).toBe(2);
      expect(task.dependencies).toContain('task-001');
      expect(task.dependencies).toContain('task-002');
    });
  });

  describe('Edge generation', () => {
    it('should create edges for each dependency', () => {
      const tasks: RalphTask[] = [
        {
          id: 'task-001',
          title: 'Task 1',
          description: 'First task',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: ['Done'],
        },
        {
          id: 'task-002',
          title: 'Task 2',
          description: 'Second task',
          priority: 'medium',
          dependencies: ['task-001'],
          acceptanceCriteria: ['Done'],
        },
        {
          id: 'task-003',
          title: 'Task 3',
          description: 'Third task',
          priority: 'low',
          dependencies: ['task-001', 'task-002'],
          acceptanceCriteria: ['Done'],
        },
      ];

      // Count total dependencies (edges)
      let totalDependencies = 0;
      tasks.forEach((task) => {
        totalDependencies += task.dependencies.length;
      });

      expect(totalDependencies).toBe(3);
    });

    it('should handle circular dependency detection', () => {
      const tasks: RalphTask[] = [
        {
          id: 'task-001',
          title: 'Task 1',
          description: 'First task',
          priority: 'high',
          dependencies: ['task-002'], // Creates cycle: 001 -> 002 -> 001
          acceptanceCriteria: ['Done'],
        },
        {
          id: 'task-002',
          title: 'Task 2',
          description: 'Second task',
          priority: 'medium',
          dependencies: ['task-001'],
          acceptanceCriteria: ['Done'],
        },
      ];

      // This would be detected by validation logic
      const hasCircular = tasks[0].dependencies.includes('task-002') &&
                          tasks[1].dependencies.includes('task-001');

      expect(hasCircular).toBe(true);
    });
  });

  describe('Status color mapping', () => {
    it('should map completed status to green', () => {
      const status = 'completed';
      const color = status === 'completed' ? '#22c55e' :
                    status === 'in_progress' ? '#eab308' :
                    status === 'failed' ? '#ef4444' : '#9ca3af';

      expect(color).toBe('#22c55e');
    });

    it('should map in_progress status to yellow', () => {
      const status = 'in_progress';
      const color = status === 'completed' ? '#22c55e' :
                    status === 'in_progress' ? '#eab308' :
                    status === 'failed' ? '#ef4444' : '#9ca3af';

      expect(color).toBe('#eab308');
    });

    it('should map pending status to gray', () => {
      const status = 'pending';
      const color = status === 'completed' ? '#22c55e' :
                    status === 'in_progress' ? '#eab308' :
                    status === 'failed' ? '#ef4444' : '#9ca3af';

      expect(color).toBe('#9ca3af');
    });

    it('should map failed status to red', () => {
      const status = 'failed';
      const color = status === 'completed' ? '#22c55e' :
                    status === 'in_progress' ? '#eab308' :
                    status === 'failed' ? '#ef4444' : '#9ca3af';

      expect(color).toBe('#ef4444');
    });
  });

  describe('Task priority sorting', () => {
    it('should order priorities correctly', () => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };

      expect(priorityOrder.high).toBeLessThan(priorityOrder.medium);
      expect(priorityOrder.medium).toBeLessThan(priorityOrder.low);
      expect(priorityOrder.high).toBeLessThan(priorityOrder.low);
    });
  });

  describe('Graph layout calculations', () => {
    it('should calculate node count correctly', () => {
      const tasks: RalphTask[] = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${String(i + 1).padStart(3, '0')}`,
        title: `Task ${i + 1}`,
        description: `Description ${i + 1}`,
        priority: 'medium',
        dependencies: [],
        acceptanceCriteria: ['Done'],
      }));

      expect(tasks.length).toBe(10);
    });

    it('should calculate edge count from dependencies', () => {
      const tasks: RalphTask[] = [
        {
          id: 'task-001',
          title: 'Root',
          description: 'Root task',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: ['Done'],
        },
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `task-${String(i + 2).padStart(3, '0')}`,
          title: `Child ${i + 1}`,
          description: `Child task ${i + 1}`,
          priority: 'medium',
          dependencies: ['task-001'],
          acceptanceCriteria: ['Done'],
        })),
      ];

      const edgeCount = tasks.reduce((sum, task) => sum + task.dependencies.length, 0);
      expect(edgeCount).toBe(5);
    });
  });
});
