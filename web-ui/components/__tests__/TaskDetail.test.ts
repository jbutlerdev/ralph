/**
 * Unit tests for TaskDetail component interfaces and logic
 */

import { describe, it, expect } from 'vitest';
import type { TaskDetailProps } from '../TaskDetail';
import type { RalphTask } from '@/lib/plan-utils';

describe('TaskDetail', () => {
  describe('TaskDetailProps interface', () => {
    it('should accept valid task detail props', () => {
      const mockTask: RalphTask = {
        id: 'task-001',
        title: 'Test Task',
        description: 'Test description',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: ['criterion 1'],
        estimatedComplexity: 3,
        tags: ['frontend'],
      };

      const props: TaskDetailProps = {
        task: mockTask,
        open: true,
        onOpenChange: () => {},
        planTasks: [mockTask],
        onNavigateToTask: (taskId: string) => {},
      };

      expect(props.task).toBeDefined();
      expect(props.open).toBe(true);
      expect(props.planTasks).toHaveLength(1);
    });

    it('should allow optional properties', () => {
      const mockTask: RalphTask = {
        id: 'task-001',
        title: 'Test Task',
        description: 'Test description',
        priority: 'medium',
        dependencies: [],
        acceptanceCriteria: [],
      };

      const props: TaskDetailProps = {
        task: mockTask,
        open: false,
        onOpenChange: () => {},
      };

      expect(props.planTasks).toBeUndefined();
      expect(props.onNavigateToTask).toBeUndefined();
    });
  });

  describe('Task complexity levels', () => {
    it('should have all complexity levels from 1 to 5', () => {
      const complexities: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];

      complexities.forEach(complexity => {
        const task: RalphTask = {
          id: `task-${complexity}`,
          title: `Task with complexity ${complexity}`,
          description: 'Test',
          priority: 'medium',
          dependencies: [],
          acceptanceCriteria: [],
          estimatedComplexity: complexity,
        };

        expect(task.estimatedComplexity).toBe(complexity);
        expect(complexity).toBeGreaterThanOrEqual(1);
        expect(complexity).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Task dependencies', () => {
    it('should handle tasks with multiple dependencies', () => {
      const task: RalphTask = {
        id: 'task-005',
        title: 'Task with multiple dependencies',
        description: 'Test',
        priority: 'high',
        dependencies: ['task-001', 'task-002', 'task-003', 'task-004'],
        acceptanceCriteria: [],
      };

      expect(task.dependencies).toHaveLength(4);
      expect(task.dependencies).toContain('task-001');
      expect(task.dependencies).toContain('task-004');
    });

    it('should handle tasks with no dependencies', () => {
      const task: RalphTask = {
        id: 'task-001',
        title: 'Task with no dependencies',
        description: 'Test',
        priority: 'low',
        dependencies: [],
        acceptanceCriteria: [],
      };

      expect(task.dependencies).toHaveLength(0);
    });
  });

  describe('Task acceptance criteria', () => {
    it('should handle tasks with multiple acceptance criteria', () => {
      const task: RalphTask = {
        id: 'task-001',
        title: 'Task with many criteria',
        description: 'Test',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: [
          'First criterion',
          'Second criterion',
          'Third criterion',
          'Fourth criterion',
          'Fifth criterion',
        ],
      };

      expect(task.acceptanceCriteria).toHaveLength(5);
      expect(task.acceptanceCriteria[0]).toBe('First criterion');
    });

    it('should handle tasks with no acceptance criteria', () => {
      const task: RalphTask = {
        id: 'task-001',
        title: 'Task with no criteria',
        description: 'Test',
        priority: 'medium',
        dependencies: [],
        acceptanceCriteria: [],
      };

      expect(task.acceptanceCriteria).toHaveLength(0);
    });
  });

  describe('Task tags', () => {
    it('should handle tasks with multiple tags', () => {
      const task: RalphTask = {
        id: 'task-001',
        title: 'Task with tags',
        description: 'Test',
        priority: 'medium',
        dependencies: [],
        acceptanceCriteria: [],
        tags: ['frontend', 'react', 'typescript', 'testing'],
      };

      expect(task.tags).toBeDefined();
      expect(task.tags).toHaveLength(4);
      expect(task.tags).toContain('typescript');
    });

    it('should handle tasks without tags', () => {
      const task: RalphTask = {
        id: 'task-001',
        title: 'Task without tags',
        description: 'Test',
        priority: 'low',
        dependencies: [],
        acceptanceCriteria: [],
      };

      expect(task.tags).toBeUndefined();
    });
  });

  describe('Priority levels', () => {
    it('should support all priority levels', () => {
      const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

      priorities.forEach(priority => {
        const task: RalphTask = {
          id: `task-${priority}`,
          title: `Task with ${priority} priority`,
          description: 'Test',
          priority: priority,
          dependencies: [],
          acceptanceCriteria: [],
        };

        expect(task.priority).toBe(priority);
      });
    });
  });

  describe('Spec reference', () => {
    it('should handle tasks with spec reference', () => {
      const task: RalphTask = {
        id: 'task-001',
        title: 'Task with spec',
        description: 'Test',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: [],
        specReference: '/docs/spec.md',
      };

      expect(task.specReference).toBe('/docs/spec.md');
    });

    it('should handle tasks without spec reference', () => {
      const task: RalphTask = {
        id: 'task-001',
        title: 'Task without spec',
        description: 'Test',
        priority: 'medium',
        dependencies: [],
        acceptanceCriteria: [],
      };

      expect(task.specReference).toBeUndefined();
    });
  });

  describe('Task navigation callback', () => {
    it('should accept onNavigateToTask callback', () => {
      const mockTask: RalphTask = {
        id: 'task-001',
        title: 'Test',
        description: 'Test',
        priority: 'medium',
        dependencies: [],
        acceptanceCriteria: [],
      };

      const props: TaskDetailProps = {
        task: mockTask,
        open: true,
        onOpenChange: () => {},
        planTasks: [mockTask],
        onNavigateToTask: (taskId: string) => {
          expect(taskId).toBe('task-002');
        },
      };

      expect(props.onNavigateToTask).toBeDefined();
      expect(typeof props.onNavigateToTask).toBe('function');
    });
  });
});
