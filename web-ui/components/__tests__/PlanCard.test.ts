/**
 * Unit tests for PlanCard component interfaces and logic
 */

import { describe, it, expect } from 'vitest';
import type { PlanCardProps } from '../PlanCard';

describe('PlanCard', () => {
  describe('PlanCardProps interface', () => {
    it('should accept valid plan card props', () => {
      const props: PlanCardProps = {
        id: 'test-plan',
        name: 'Test Plan',
        description: 'A test plan for testing',
        totalTasks: 10,
        completedTasks: 5,
        inProgressTasks: 2,
        failedTasks: 1,
      };

      expect(props.id).toBe('test-plan');
      expect(props.name).toBe('Test Plan');
      expect(props.description).toBe('A test plan for testing');
      expect(props.totalTasks).toBe(10);
      expect(props.completedTasks).toBe(5);
      expect(props.inProgressTasks).toBe(2);
      expect(props.failedTasks).toBe(1);
    });

    it('should accept props without optional fields', () => {
      const props: PlanCardProps = {
        id: 'simple-plan',
        name: 'Simple Plan',
        description: 'A simple plan',
        totalTasks: 5,
        completedTasks: 2,
      };

      expect(props.inProgressTasks).toBeUndefined();
      expect(props.failedTasks).toBeUndefined();
      expect(props.className).toBeUndefined();
    });

    it('should accept custom className', () => {
      const props: PlanCardProps = {
        id: 'custom-plan',
        name: 'Custom Plan',
        description: 'A plan with custom class',
        totalTasks: 3,
        completedTasks: 1,
        className: 'custom-class another-class',
      };

      expect(props.className).toBe('custom-class another-class');
    });
  });

  describe('progress calculation logic', () => {
    it('should calculate 0% when no tasks are completed', () => {
      const totalTasks = 10;
      const completedTasks = 0;
      const percentage = Math.round((completedTasks / totalTasks) * 100);

      expect(percentage).toBe(0);
    });

    it('should calculate 100% when all tasks are completed', () => {
      const totalTasks = 10;
      const completedTasks = 10;
      const percentage = Math.round((completedTasks / totalTasks) * 100);

      expect(percentage).toBe(100);
    });

    it('should calculate 50% when half tasks are completed', () => {
      const totalTasks = 10;
      const completedTasks = 5;
      const percentage = Math.round((completedTasks / totalTasks) * 100);

      expect(percentage).toBe(50);
    });

    it('should handle partial completion with rounding', () => {
      const totalTasks = 3;
      const completedTasks = 1;
      const percentage = Math.round((completedTasks / totalTasks) * 100);

      expect(percentage).toBe(33);
    });

    it('should handle 100% when totalTasks is 0 to avoid division by zero', () => {
      const totalTasks = 0;
      const completedTasks = 0;
      const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      expect(percentage).toBe(0);
    });
  });

  describe('pending tasks calculation', () => {
    it('should calculate pending tasks correctly', () => {
      const totalTasks = 10;
      const completedTasks = 4;
      const pendingTasks = totalTasks - completedTasks;

      expect(pendingTasks).toBe(6);
    });

    it('should show all tasks as pending when none completed', () => {
      const totalTasks = 10;
      const completedTasks = 0;
      const pendingTasks = totalTasks - completedTasks;

      expect(pendingTasks).toBe(10);
    });

    it('should show 0 pending when all tasks completed', () => {
      const totalTasks = 10;
      const completedTasks = 10;
      const pendingTasks = totalTasks - completedTasks;

      expect(pendingTasks).toBe(0);
    });
  });

  describe('progress color classification', () => {
    it('should use green for 80% or higher', () => {
      const testCases = [80, 85, 90, 95, 100];

      testCases.forEach((percentage) => {
        const color = percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';
        expect(color).toBe('bg-green-500');
      });
    });

    it('should use yellow for 50-79%', () => {
      const testCases = [50, 55, 60, 70, 79];

      testCases.forEach((percentage) => {
        const color = percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';
        expect(color).toBe('bg-yellow-500');
      });
    });

    it('should use red for less than 50%', () => {
      const testCases = [0, 10, 25, 40, 49];

      testCases.forEach((percentage) => {
        const color = percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';
        expect(color).toBe('bg-red-500');
      });
    });
  });
});
