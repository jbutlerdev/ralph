/**
 * Unit tests for PlanList component interfaces and logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { PlanData, PlansApiResponse } from '../PlanList';

describe('PlanList', () => {
  describe('PlanData interface', () => {
    it('should accept valid plan data', () => {
      const plan: PlanData = {
        id: 'test-plan',
        name: 'Test Plan',
        description: 'A test plan',
        path: 'plans/test/IMPLEMENTATION_PLAN.md',
        totalTasks: 10,
        completedTasks: 5,
        inProgressTasks: 2,
        failedTasks: 1,
      };

      expect(plan.id).toBe('test-plan');
      expect(plan.name).toBe('Test Plan');
      expect(plan.description).toBe('A test plan');
      expect(plan.path).toBe('plans/test/IMPLEMENTATION_PLAN.md');
      expect(plan.totalTasks).toBe(10);
      expect(plan.completedTasks).toBe(5);
      expect(plan.inProgressTasks).toBe(2);
      expect(plan.failedTasks).toBe(1);
    });

    it('should accept plan data without optional task stats', () => {
      const plan: PlanData = {
        id: 'minimal-plan',
        name: 'Minimal Plan',
        description: 'A minimal plan',
        path: 'plans/minimal/IMPLEMENTATION_PLAN.md',
      };

      expect(plan.totalTasks).toBeUndefined();
      expect(plan.completedTasks).toBeUndefined();
      expect(plan.inProgressTasks).toBeUndefined();
      expect(plan.failedTasks).toBeUndefined();
    });
  });

  describe('PlansApiResponse interface', () => {
    it('should accept successful response with plans', () => {
      const response: PlansApiResponse = {
        success: true,
        plans: [
          {
            id: 'plan-1',
            name: 'Plan 1',
            description: 'First plan',
            path: 'plans/1/IMPLEMENTATION_PLAN.md',
          },
          {
            id: 'plan-2',
            name: 'Plan 2',
            description: 'Second plan',
            path: 'plans/2/IMPLEMENTATION_PLAN.md',
          },
        ],
        count: 2,
      };

      expect(response.success).toBe(true);
      expect(response.plans).toHaveLength(2);
      expect(response.count).toBe(2);
      expect(response.error).toBeUndefined();
      expect(response.message).toBeUndefined();
    });

    it('should accept successful response with empty plans array', () => {
      const response: PlansApiResponse = {
        success: true,
        plans: [],
        count: 0,
      };

      expect(response.success).toBe(true);
      expect(response.plans).toEqual([]);
      expect(response.count).toBe(0);
    });

    it('should accept error response', () => {
      const response: PlansApiResponse = {
        success: false,
        error: 'Failed to load plans',
        message: 'Directory not found',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to load plans');
      expect(response.message).toBe('Directory not found');
      expect(response.plans).toBeUndefined();
      expect(response.count).toBeUndefined();
    });
  });

  describe('plan data transformations', () => {
    it('should correctly extract plan IDs from API response', () => {
      const apiResponse: PlansApiResponse = {
        success: true,
        plans: [
          {
            id: 'web-ui',
            name: 'Web UI',
            description: 'Web UI for Ralph',
            path: 'plans/web-ui/IMPLEMENTATION_PLAN.md',
          },
          {
            id: 'mobile-app',
            name: 'Mobile App',
            description: 'Mobile application',
            path: 'plans/mobile-app/IMPLEMENTATION_PLAN.md',
          },
        ],
        count: 2,
      };

      const ids = apiResponse.plans?.map((plan) => plan.id) || [];

      expect(ids).toEqual(['web-ui', 'mobile-app']);
    });

    it('should handle plans with missing task statistics', () => {
      const plans: PlanData[] = [
        {
          id: 'plan-with-stats',
          name: 'Plan with Stats',
          description: 'Has all stats',
          path: 'plans/with-stats/IMPLEMENTATION_PLAN.md',
          totalTasks: 10,
          completedTasks: 5,
          inProgressTasks: 2,
          failedTasks: 1,
        },
        {
          id: 'plan-without-stats',
          name: 'Plan without Stats',
          description: 'Missing stats',
          path: 'plans/without-stats/IMPLEMENTATION_PLAN.md',
        },
      ];

      const withStats = plans.find((p) => p.totalTasks !== undefined);
      const withoutStats = plans.find((p) => p.totalTasks === undefined);

      expect(withStats?.id).toBe('plan-with-stats');
      expect(withStats?.totalTasks).toBe(10);
      expect(withoutStats?.id).toBe('plan-without-stats');
      expect(withoutStats?.totalTasks).toBeUndefined();
    });
  });

  describe('API response parsing', () => {
    it('should parse valid API response', () => {
      const json = `{
        "success": true,
        "plans": [
          {
            "id": "test",
            "name": "Test",
            "description": "Test plan",
            "path": "plans/test/IMPLEMENTATION_PLAN.md"
          }
        ],
        "count": 1
      }`;

      const response: PlansApiResponse = JSON.parse(json);

      expect(response.success).toBe(true);
      expect(response.plans).toHaveLength(1);
      expect(response.count).toBe(1);
    });

    it('should parse error response', () => {
      const json = `{
        "success": false,
        "error": "Not found",
        "message": "Plan does not exist"
      }`;

      const response: PlansApiResponse = JSON.parse(json);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Not found');
      expect(response.message).toBe('Plan does not exist');
    });
  });

  describe('empty state detection', () => {
    it('should detect empty plans array', () => {
      const plans: PlanData[] = [];
      const isEmpty = plans.length === 0;

      expect(isEmpty).toBe(true);
    });

    it('should detect non-empty plans array', () => {
      const plans: PlanData[] = [
        {
          id: 'test',
          name: 'Test',
          description: 'Test',
          path: 'plans/test/IMPLEMENTATION_PLAN.md',
        },
      ];
      const isEmpty = plans.length === 0;

      expect(isEmpty).toBe(false);
    });

    it('should correctly pluralize plan count text', () => {
      const plans: PlanData[] = [
        { id: '1', name: 'One', description: 'First', path: 'plans/1/IMPLEMENTATION_PLAN.md' },
        { id: '2', name: 'Two', description: 'Second', path: 'plans/2/IMPLEMENTATION_PLAN.md' },
      ];

      const count = plans.length;
      const plural = count !== 1 ? 's' : '';

      expect(count).toBe(2);
      expect(plural).toBe('s');
      expect(`Showing ${count} plan${plural}`).toBe('Showing 2 plans');
    });

    it('should use singular form for single plan', () => {
      const plans: PlanData[] = [
        { id: '1', name: 'One', description: 'First', path: 'plans/1/IMPLEMENTATION_PLAN.md' },
      ];

      const count = plans.length;
      const plural = count !== 1 ? 's' : '';

      expect(count).toBe(1);
      expect(plural).toBe('');
      expect(`Showing ${count} plan${plural}`).toBe('Showing 1 plan');
    });
  });
});
