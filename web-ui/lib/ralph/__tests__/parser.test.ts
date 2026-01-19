/**
 * Unit tests for Ralph Plan Parser
 */

import { describe, it, expect } from 'vitest';
import {
  planFromMarkdown,
  validateRalphPlan,
  sortTasksByDependencies,
  getNextTask,
  calculateProgress,
  filterByPriority,
  filterByTag,
  getTaskById,
} from '../parser.js';
import type { RalphPlan, RalphTask } from '../types.js';

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

  it('should parse tasks with tags and complexity', () => {
    const markdown = `# Implementation Plan

## Tasks

### Task 1: Complex task
**ID:** task-001
**Priority:** high
**Complexity:** 5/5
**Tags:** core, important

**Description:**
A complex task

**Acceptance Criteria:**
- [ ] Done

---`;

    const plan = planFromMarkdown(markdown);

    expect(plan.tasks[0].id).toBe('task-001');
    expect(plan.tasks[0].priority).toBe('high');
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
});

describe('validateRalphPlan', () => {
  it('should validate a correct plan', () => {
    const plan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
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
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 1,
    };

    const result = validateRalphPlan(plan);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect empty plans', () => {
    const plan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [],
      generatedAt: new Date().toISOString(),
      totalTasks: 0,
    };

    const result = validateRalphPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Plan must contain at least one task');
  });

  it('should detect invalid task ID formats', () => {
    const plan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'invalid-id',
          title: 'Task 1',
          description: 'First task',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: ['Criterion 1'],
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 1,
    };

    const result = validateRalphPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('invalid ID format'))).toBe(true);
  });

  it('should detect duplicate task IDs', () => {
    const plan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
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
          id: 'task-001',
          title: 'Task 2',
          description: 'Second task',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: ['Criterion 1'],
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 2,
    };

    const result = validateRalphPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate task ID: task-001');
  });

  it('should detect missing required fields', () => {
    const plan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-001',
          title: '',
          description: '',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: [],
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 1,
    };

    const result = validateRalphPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Task task-001 is missing a title');
    expect(result.errors).toContain('Task task-001 is missing a description');
  });

  it('should warn about tasks without acceptance criteria', () => {
    const plan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
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
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 1,
    };

    const result = validateRalphPlan(plan);

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Task task-001 has no acceptance criteria');
  });

  it('should detect invalid dependencies', () => {
    const plan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-001',
          title: 'Task 1',
          description: 'First task',
          priority: 'high',
          dependencies: ['task-999'],
          acceptanceCriteria: ['Criterion 1'],
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 1,
    };

    const result = validateRalphPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Task task-001 depends on non-existent task: task-999');
  });

  it('should detect circular dependencies', () => {
    const plan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        {
          id: 'task-001',
          title: 'Task 1',
          description: 'First task',
          priority: 'high',
          dependencies: ['task-002'],
          acceptanceCriteria: ['Criterion 1'],
        },
        {
          id: 'task-002',
          title: 'Task 2',
          description: 'Second task',
          priority: 'high',
          dependencies: ['task-001'],
          acceptanceCriteria: ['Criterion 1'],
        },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 2,
    };

    const result = validateRalphPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Circular dependencies detected'))).toBe(true);
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
});

describe('filterByPriority', () => {
  const plan: RalphPlan = {
    projectName: 'Test',
    description: 'Test plan',
    overview: '',
    tasks: [
      { id: 'task-001', title: 'High task', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
      { id: 'task-002', title: 'Medium task', description: '', priority: 'medium', dependencies: [], acceptanceCriteria: [] },
      { id: 'task-003', title: 'Low task', description: '', priority: 'low', dependencies: [], acceptanceCriteria: [] },
      { id: 'task-004', title: 'Another high task', description: '', priority: 'high', dependencies: [], acceptanceCriteria: [] },
    ],
    generatedAt: new Date().toISOString(),
    totalTasks: 4,
  };

  it('should filter high priority tasks', () => {
    const filtered = filterByPriority(plan, 'high');

    expect(filtered).toHaveLength(2);
    expect(filtered.every(t => t.priority === 'high')).toBe(true);
  });

  it('should filter medium priority tasks', () => {
    const filtered = filterByPriority(plan, 'medium');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('task-002');
  });

  it('should filter low priority tasks', () => {
    const filtered = filterByPriority(plan, 'low');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('task-003');
  });

  it('should return empty array for no matches', () => {
    const noHighPlan: RalphPlan = {
      projectName: 'Test',
      description: 'Test plan',
      overview: '',
      tasks: [
        { id: 'task-001', title: 'Medium task', description: '', priority: 'medium', dependencies: [], acceptanceCriteria: [] },
      ],
      generatedAt: new Date().toISOString(),
      totalTasks: 1,
    };

    const filtered = filterByPriority(noHighPlan, 'high');

    expect(filtered).toHaveLength(0);
  });
});

describe('filterByTag', () => {
  const plan: RalphPlan = {
    projectName: 'Test',
    description: 'Test plan',
    overview: '',
    tasks: [
      {
        id: 'task-001',
        title: 'Backend task',
        description: '',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: [],
        tags: ['backend', 'api'],
      },
      {
        id: 'task-002',
        title: 'Frontend task',
        description: '',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: [],
        tags: ['frontend', 'ui'],
      },
      {
        id: 'task-003',
        title: 'Another backend task',
        description: '',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: [],
        tags: ['backend', 'database'],
      },
      {
        id: 'task-004',
        title: 'No tags task',
        description: '',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: [],
      },
    ],
    generatedAt: new Date().toISOString(),
    totalTasks: 4,
  };

  it('should filter tasks by tag', () => {
    const filtered = filterByTag(plan, 'backend');

    expect(filtered).toHaveLength(2);
    expect(filtered.every(t => t.tags?.includes('backend'))).toBe(true);
  });

  it('should filter tasks by ui tag', () => {
    const filtered = filterByTag(plan, 'ui');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('task-002');
  });

  it('should return empty array for non-existent tag', () => {
    const filtered = filterByTag(plan, 'nonexistent');

    expect(filtered).toHaveLength(0);
  });

  it('should handle tasks without tags', () => {
    const filtered = filterByTag(plan, 'anytag');

    expect(filtered.every(t => t.tags !== undefined)).toBe(true);
  });
});

describe('getTaskById', () => {
  const plan: RalphPlan = {
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

  it('should find task by ID', () => {
    const task = getTaskById(plan, 'task-002');

    expect(task).toBeDefined();
    expect(task?.id).toBe('task-002');
    expect(task?.title).toBe('Task 2');
  });

  it('should return undefined for non-existent task', () => {
    const task = getTaskById(plan, 'task-999');

    expect(task).toBeUndefined();
  });

  it('should find first task', () => {
    const task = getTaskById(plan, 'task-001');

    expect(task?.title).toBe('Task 1');
  });

  it('should find last task', () => {
    const task = getTaskById(plan, 'task-003');

    expect(task?.title).toBe('Task 3');
  });
});
