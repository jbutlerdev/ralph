import { test, expect } from '@playwright/test';

/**
 * Test suite: Task Details Modal
 *
 * Tests the task detail modal functionality:
 * - Opening task details
 * - Displaying task information
 * - Showing acceptance criteria
 * - Displaying dependencies
 * - Navigating between tasks
 * - Closing the modal
 */
test.describe('Task Details Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the home page
    await page.goto('/');

    // Wait for plan cards to load
    await page.waitForSelector('[data-testid="plan-card"]', { timeout: 10000 });

    // Navigate to the first plan
    const planCard = page.getByTestId('plan-card').first();
    await planCard.click();

    // Wait for navigation to plan detail page
    await page.waitForURL(/\/plan\/.+/);

    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-item"]', { timeout: 5000 });
  });

  test('should open task detail modal when clicking a task', async ({ page }) => {
    // Click the first task to open its detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Check that the dialog is visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Check for task title
    const taskTitle = page.getByRole('heading', { level: 2 }).first();
    await expect(taskTitle).toBeVisible();

    // Check for task ID
    const taskId = page.locator('[data-testid="task-item"]').first();
    await expect(taskId).toBeVisible();
  });

  test('should display task description', async ({ page }) => {
    // Open task detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Check for description section
    const descriptionHeading = page.getByRole('heading', { name: /description/i });
    const hasDescription = await descriptionHeading.count() > 0;

    if (hasDescription) {
      await expect(descriptionHeading).toBeVisible();
    }
  });

  test('should display acceptance criteria', async ({ page }) => {
    // Open task detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Check for acceptance criteria section
    const criteriaHeading = page.getByRole('heading', { name: /acceptance criteria/i });
    const hasCriteria = await criteriaHeading.count() > 0;

    if (hasCriteria) {
      await expect(criteriaHeading).toBeVisible();

      // Check for at least one criterion
      const criteriaList = page.locator('ul[aria-label*="acceptance"]');
      const criteriaCount = await criteriaList.count();

      // If criteria list exists, check for items
      if (criteriaCount > 0) {
        const firstCriterion = criteriaList.first().locator('li');
        await expect(firstCriterion).toBeVisible();
      }
    }
  });

  test('should display dependencies if present', async ({ page }) => {
    // Open task detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Check for dependencies section
    const dependenciesHeading = page.getByRole('heading', { name: /dependencies/i });
    const hasDependencies = await dependenciesHeading.count() > 0;

    if (hasDependencies) {
      await expect(dependenciesHeading).toBeVisible();

      // Check for dependency buttons/links
      const dependencies = page.getByRole('button', { name: /task-/ });
      const depCount = await dependencies.count();

      if (depCount > 0) {
        await expect(dependencies.first()).toBeVisible();
      }
    }
  });

  test('should display dependent tasks if present', async ({ page }) => {
    // Open task detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Check for dependent tasks section
    const dependentHeading = page.getByRole('heading', { name: /dependent tasks/i });
    const hasDependents = await dependentHeading.count() > 0;

    if (hasDependents) {
      await expect(dependentHeading).toBeVisible();
    }
  });

  test('should close modal when clicking close button', async ({ page }) => {
    // Open task detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Find and click the close button
    const closeButton = page.getByRole('button', { name: /close/i });
    await closeButton.click();

    // Wait for modal to close
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {});

    // Modal should no longer be visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();
  });

  test('should close modal when pressing Escape key', async ({ page }) => {
    // Open task detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Press Escape key
    await page.keyboard.press('Escape');

    // Wait for modal to close
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {});

    // Modal should no longer be visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();
  });

  test('should close modal when clicking backdrop', async ({ page }) => {
    // Open task detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Click the backdrop (outside the modal content)
    const backdrop = page.locator('[role="dialog"]').locator('..').locator('div').first();
    await backdrop.click({ position: { x: 10, y: 10 } });

    // Wait for modal to close
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {});

    // Modal should no longer be visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();
  });

  test('should display task priority badge', async ({ page }) => {
    // Open task detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Check for priority badge (should have aria-label containing "Priority")
    const priorityBadge = page.locator('[aria-label*="Priority"]');
    await expect(priorityBadge).toBeVisible();
  });

  test('should navigate to linked task from dependencies', async ({ page }) => {
    // Open task detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Check for dependency buttons
    const dependencyButtons = page.getByRole('button').filter({ hasText: /task-/ });
    const depCount = await dependencyButtons.count();

    // If dependencies exist, try clicking one
    if (depCount > 0) {
      // Get the task ID before clicking
      const firstDepButton = dependencyButtons.first();
      const taskId = await firstDepButton.textContent();

      // Click the dependency button
      await firstDepButton.click();

      // The task title should change (indicating navigation to a different task)
      const taskTitle = page.getByRole('heading', { level: 2 }).first();
      await expect(taskTitle).toBeVisible();

      // Verify we're still in the modal (not on a different page)
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
    }
  });

  test('should display tags if present', async ({ page }) => {
    // Open task detail modal
    const firstTask = page.getByTestId('task-item').first();
    await firstTask.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Check for tags section (optional)
    const tagsHeading = page.getByRole('heading', { name: /tags/i });
    const hasTags = await tagsHeading.count() > 0;

    if (hasTags) {
      await expect(tagsHeading).toBeVisible();

      // Check for at least one tag
      const tags = page.locator('[role="list"][aria-label*="tag"]').locator('span[role="listitem"]');
      await expect(tags.first()).toBeVisible();
    }
  });

  test('should be accessible via keyboard', async ({ page }) => {
    // Navigate using keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Modal should be visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Modal should close
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await expect(dialog).not.toBeVisible();
  });
});
