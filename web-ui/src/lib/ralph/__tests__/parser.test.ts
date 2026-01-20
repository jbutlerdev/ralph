/**
 * Unit tests for Ralph Plan Parser
 */

import { describe, it, expect } from 'vitest';
import {
  planFromMarkdown,
  sortTasksByDependencies,
  getNextTask,
  calculateProgress,
} from '../parser';
import type { RalphPlan, RalphTask } from '../types';

describe('planFromMarkdown', () => {
  it('should parse a simple markdown plan', () => {
    const markdown = `# Implementation Plan

## Overview

Build a web UI for Ralph

---

## Tasks

### Task 1: Create UI components
**ID:** task-001
**Priority:** high

**Description:**
Create React components for the UI

**Acceptance Criteria:**
- [ ] Component renders
- [ ] Props work correctly

---

*Generated on 2024-01-18*`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].id).toBe('task-001');
    expect(plan.tasks[0].title).toBe('Create UI components');
    expect(plan.tasks[0].priority).toBe('high');
    expect(plan.tasks[0].description).toBe('Create React components for the UI');
    expect(plan.tasks[0].acceptanceCriteria).toHaveLength(2);
  });

  it('should parse tasks with dependencies', () => {
    const markdown = `# Implementation Plan

## Tasks

### Task 1: Setup
**ID:** task-001
**Priority:** high
**Dependencies:**

**Description:**
Setup project

**Acceptance Criteria:**
- [ ] Initialized

---

### Task 2: Build
**ID:** task-002
**Priority:** medium
**Dependencies:** task-001

**Description:**
Build feature

**Acceptance Criteria:**
- [ ] Built

---`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[1].dependencies).toEqual(['task-001']);
  });

  it('should parse tasks with status', () => {
    const markdown = `# Implementation Plan

## Tasks

### Task 1: Complete task
**ID:** task-001
**Priority:** high
**Status:** Implemented

**Description:**
A completed task

**Acceptance Criteria:**
- [ ] Done

---

### Task 2: Pending task
**ID:** task-002
**Priority:** medium
**Status:** To Do

**Description:**
A pending task

**Acceptance Criteria:**
- [ ] Not done

---`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks[0].status).toBe('Implemented');
    expect(plan.tasks[1].status).toBe('To Do');
  });

  it('should default to "To Do" status when status is invalid', () => {
    const markdown = `# Implementation Plan

## Tasks

### Task 1: Invalid status task
**ID:** task-001
**Priority:** high
**Status:** InvalidStatus

**Description:**
A task with invalid status

**Acceptance Criteria:**
- [ ] Done

---`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks[0].status).toBe('To Do');
  });

  it('should parse multiple tasks correctly', () => {
    const markdown = `# Implementation Plan

## Tasks

### Task 1: First task
**ID:** task-001
**Priority:** high

**Description:**
First task

**Acceptance Criteria:**
- [ ] Done

---

### Task 2: Second task
**ID:** task-002
**Priority:** medium

**Description:**
Second task

**Acceptance Criteria:**
- [ ] Done

---

### Task 3: Third task
**ID:** task-003
**Priority:** low

**Description:**
Third task

**Acceptance Criteria:**
- [ ] Done

---`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks).toHaveLength(3);
    expect(plan.tasks[0].id).toBe('task-001');
    expect(plan.tasks[1].id).toBe('task-002');
    expect(plan.tasks[2].id).toBe('task-003');
  });

  it('should handle tasks without explicit IDs', () => {
    const markdown = `# Implementation Plan

## Tasks

### First task
**Priority:** high

**Description:**
First task

**Acceptance Criteria:**
- [ ] Done

---

### Second task
**Priority:** medium

**Description:**
Second task

**Acceptance Criteria:**
- [ ] Done

---`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[0].id).toBe('task-001');
    expect(plan.tasks[1].id).toBe('task-002');
  });

  it('should parse multiline descriptions', () => {
    const markdown = `# Implementation Plan

## Tasks

### Task 1: Multi-line description
**ID:** task-001
**Priority:** high

**Description:**
First line of description
Second line of description
Third line of description

**Acceptance Criteria:**
- [ ] Done

---`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks[0].description).toBe(
      'First line of description\nSecond line of description\nThird line of description'
    );
  });

  it('should parse tasks with spec reference', () => {
    const markdown = `# Implementation Plan

## Tasks

### Task 1: Spec referenced task
**ID:** task-001
**Priority:** high
**Spec Reference:** [Spec File](specs/spec.md)

**Description:**
A task with spec reference

**Acceptance Criteria:**
- [ ] Done

---`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks[0].specReference).toBe('specs/spec.md');
  });

  it('should handle multiple dependencies separated by commas', () => {
    const markdown = `# Implementation Plan

## Tasks

### Task 1: Base task
**ID:** task-001
**Priority:** high

**Description:**
Base task

**Acceptance Criteria:**
- [ ] Done

---

### Task 2: Dependent task
**ID:** task-002
**Priority:** medium
**Dependencies:** task-001, task-003

**Description:**
Depends on multiple tasks

**Acceptance Criteria:**
- [ ] Done

---

### Task 3: Another base task
**ID:** task-003
**Priority:** medium

**Description:**
Another base task

**Acceptance Criteria:**
- [ ] Done

---`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks[1].dependencies).toEqual(['task-001', 'task-003']);
  });

  it('should handle empty markdown gracefully', () => {
    const markdown = `# Implementation Plan

## Tasks

`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks).toHaveLength(0);
    expect(plan.projectName).toBe('Project');
    expect(plan.totalTasks).toBe(0);
  });
});

describe('sortTasksByDependencies', () => {
  it('should sort independent tasks', () => {
    const tasks: RalphTask[] = [
      { id: 'task-002', title: 'Task 2', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
      { id: 'task-001', title: 'Task 1', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
      { id: 'task-003', title: 'Task 3', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
    ];

    const sorted = sortTasksByDependencies(tasks);

    // Order can vary but all tasks should be present
    expect(sorted).toHaveLength(3);
  });

  it('should sort tasks with dependencies', () => {
    const tasks: RalphTask[] = [
      {
        id: 'task-003',
        title: 'Task 3',
        description: '',
        priority: 'high',
        dependencies: ['task-001', 'task-002'],
        acceptanceCriteria: [],
      },
      {
        id: 'task-001',
        title: 'Task 1',
        description: '',
        priority: 'high',
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
    ];

    const sorted = sortTasksByDependencies(tasks);

    expect(sorted[0].id).toBe('task-001');
    expect(sorted[1].id).toBe('task-002');
    expect(sorted[2].id).toBe('task-003');
  });

  it('should throw on circular dependencies', () => {
    const tasks: RalphTask[] = [
      {
        id: 'task-001',
        title: 'Task 1',
        description: '',
        priority: 'high',
        dependencies: ['task-002'],
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
    ];

    expect(() => sortTasksByDependencies(tasks)).toThrow('Circular dependency detected');
  });

  it('should handle complex dependency chains', () => {
    const tasks: RalphTask[] = [
      { id: 'task-004', title: 'Task 4', description: '', priority: 'high', dependencies: ['task-001'], acceptanceCriteria: [] },
      { id: 'task-002', title: 'Task 2', description: '', priority: 'high', dependencies: ['task-001'], acceptanceCriteria: [] },
      { id: 'task-003', title: 'Task 3', description: '', priority: 'high', dependencies: ['task-002'], acceptanceCriteria: [] },
      { id: 'task-001', title: 'Task 1', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
    ];

    const sorted = sortTasksByDependencies(tasks);

    expect(sorted[0].id).toBe('task-001'); // No dependencies
    // task-004 and task-002 both depend on task-001, so their order is determined by input order
    expect(sorted[1].id).toBe('task-004'); // Appears first in input array
    expect(sorted[2].id).toBe('task-002'); // Appears second in input array
    expect(sorted[3].id).toBe('task-003'); // Depends on task-002, must come after it
  });

  it('should handle single task', () => {
    const tasks: RalphTask[] = [
      { id: 'task-001', title: 'Task 1', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
    ];

    const sorted = sortTasksByDependencies(tasks);

    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe('task-001');
  });

  it('should handle empty array', () => {
    const tasks: RalphTask[] = [];

    const sorted = sortTasksByDependencies(tasks);

    expect(sorted).toHaveLength(0);
  });
});

describe('getNextTask', () => {
  const plan: RalphPlan = {
    projectName: 'Test',
    description: 'Test plan',
    overview: '',
    tasks: [
      {
        id: 'task-001',
        title: 'Task 1',
        description: '',
        priority: 'high',
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
        priority: 'high',
        dependencies: ['task-002'],
        acceptanceCriteria: [],
      },
    ],
    generatedAt: new Date().toISOString(),
    totalTasks: 3,
  };

  it('should return the first task when nothing is completed', () => {
    const completed = new Set<string>();
    const next = getNextTask(plan, completed);

    expect(next?.id).toBe('task-001');
  });

  it('should return next task after first is completed', () => {
    const completed = new Set<string>(['task-001']);
    const next = getNextTask(plan, completed);

    expect(next?.id).toBe('task-002');
  });

  it('should return third task after dependencies are met', () => {
    const completed = new Set<string>(['task-001', 'task-002']);
    const next = getNextTask(plan, completed);

    expect(next?.id).toBe('task-003');
  });

  it('should return null when all tasks are completed', () => {
    const completed = new Set<string>(['task-001', 'task-002', 'task-003']);
    const next = getNextTask(plan, completed);

    expect(next).toBeNull();
  });

  it('should return null when no tasks have met dependencies', () => {
    const partialPlan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-001',
          title: 'Task 1',
          description: '',
          priority: 'high',
          dependencies: ['task-002'],
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
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 2,
    };

    const completed = new Set<string>();
    const next = getNextTask(partialPlan, completed);

    expect(next).toBeNull();
  });

  it('should skip tasks with "Implemented" status', () => {
    const planWithStatus: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-001',
          title: 'Task 1',
          description: '',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: [],
          status: 'Implemented',
        },
        {
          id: 'task-002',
          title: 'Task 2',
          description: '',
          priority: 'high',
          dependencies: ['task-001'],
          acceptanceCriteria: [],
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 2,
    };

    const completed = new Set<string>();
    const next = getNextTask(planWithStatus, completed);

    // task-002 should be returned because task-001 is implemented
    expect(next?.id).toBe('task-002');
  });

  it('should skip tasks with "Verified" status', () => {
    const planWithStatus: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-001',
          title: 'Task 1',
          description: '',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: [],
          status: 'Verified',
        },
        {
          id: 'task-002',
          title: 'Task 2',
          description: '',
          priority: 'high',
          dependencies: ['task-001'],
          acceptanceCriteria: [],
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 2,
    };

    const completed = new Set<string>();
    const next = getNextTask(planWithStatus, completed);

    expect(next?.id).toBe('task-002');
  });

  it('should skip tasks with "In Progress" status', () => {
    const planWithStatus: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-001',
          title: 'Task 1',
          description: '',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: [],
          status: 'In Progress',
        },
        {
          id: 'task-002',
          title: 'Task 2',
          description: '',
          priority: 'high',
          dependencies: ['task-001'],
          acceptanceCriteria: [],
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 2,
    };

    const completed = new Set<string>();
    const next = getNextTask(planWithStatus, completed);

    expect(next?.id).toBe('task-002');
  });

  it('should return task with "Needs Re-Work" status', () => {
    const planWithStatus: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-001',
          title: 'Task 1',
          description: '',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: [],
          status: 'Needs Re-Work',
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 1,
    };

    const completed = new Set<string>();
    const next = getNextTask(planWithStatus, completed);

    expect(next?.id).toBe('task-001');
  });

  it('should return task with "To Do" status', () => {
    const planWithStatus: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-001',
          title: 'Task 1',
          description: '',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: [],
          status: 'To Do',
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 1,
    };

    const completed = new Set<string>();
    const next = getNextTask(planWithStatus, completed);

    expect(next?.id).toBe('task-001');
  });

  it('should respect completedTaskIds over task status', () => {
    const planWithStatus: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-001',
          title: 'Task 1',
          description: '',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: [],
          status: 'To Do',
        },
        {
          id: 'task-002',
          title: 'Task 2',
          description: '',
          priority: 'high',
          dependencies: ['task-001'],
          acceptanceCriteria: [],
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 2,
    };

    const completed = new Set<string>(['task-001']);
    const next = getNextTask(planWithStatus, completed);

    expect(next?.id).toBe('task-002');
  });
});

describe('calculateProgress', () => {
  const plan: RalphPlan = {
    projectName: 'Test',
    description: 'Test plan',
    overview: '',
    tasks: [
      { id: 'task-001', title: 'Task 1', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
      { id: 'task-002', title: 'Task 2', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
      { id: 'task-003', title: 'Task 3', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
      { id: 'task-004', title: 'Task 4', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
    ],
    generatedAt: new Date().toISOString(),
    totalTasks: 4,
  };

  it('should calculate 0% when no tasks are completed', () => {
    const completed = new Set<string>();
    const progress = calculateProgress(plan, completed);

    expect(progress.completed).toBe(0);
    expect(progress.total).toBe(4);
    expect(progress.percentage).toBe(0);
  });

  it('should calculate 25% when one task is completed', () => {
    const completed = new Set<string>(['task-001']);
    const progress = calculateProgress(plan, completed);

    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(4);
    expect(progress.percentage).toBe(25);
  });

  it('should calculate 50% when two tasks are completed', () => {
    const completed = new Set<string>(['task-001', 'task-002']);
    const progress = calculateProgress(plan, completed);

    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.percentage).toBe(50);
  });

  it('should calculate 100% when all tasks are completed', () => {
    const completed = new Set<string>(['task-001', 'task-002', 'task-003', 'task-004']);
    const progress = calculateProgress(plan, completed);

    expect(progress.completed).toBe(4);
    expect(progress.total).toBe(4);
    expect(progress.percentage).toBe(100);
  });

  it('should handle rounding correctly', () => {
    const partialPlan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        { id: 'task-001', title: 'Task 1', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
        { id: 'task-002', title: 'Task 2', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
        { id: 'task-003', title: 'Task 3', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 3,
    };

    const completed = new Set<string>(['task-001']);
    const progress = calculateProgress(partialPlan, completed);

    expect(progress.percentage).toBe(33); // 1/3 ≈ 33.33, rounds to 33
  });

  it('should handle empty plan', () => {
    const emptyPlan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [],
      generatedAt: new Date().toISOString(),
      totalTasks: 0,
    };

    const completed = new Set<string>();
    const progress = calculateProgress(emptyPlan, completed);

    expect(progress.completed).toBe(0);
    expect(progress.total).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('should return 75% when 3 of 4 tasks completed', () => {
    const completed = new Set<string>(['task-001', 'task-002', 'task-003']);
    const progress = calculateProgress(plan, completed);

    expect(progress.completed).toBe(3);
    expect(progress.total).toBe(4);
    expect(progress.percentage).toBe(75);
  });
});
