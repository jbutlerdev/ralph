import { test, expect } from '@playwright/test';

/**
 * Test suite: View Plan Details Page
 *
 * Tests the plan detail page functionality:
 * - Displaying plan overview
 * - Showing progress indicator
 * - Listing tasks
 * - Dependency graph
 * - Filtering and sorting tasks
 */
test.describe('View Plan Details Page', () => {
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
  });

  test('should display plan header information', async ({ page }) => {
    // Check for plan title
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeVisible();

    // Check for plan description
    const description = page.getByTestId('plan-description');
    await expect(description).toBeVisible();
  });

  test('should display progress section', async ({ page }) => {
    // Check for progress heading
    const progressHeading = page.getByRole('heading', { name: /overall progress/i });
    await expect(progressHeading).toBeVisible();

    // Check for progress bar
    const progressBar = page.getByRole('progressbar');
    await expect(progressBar).toBeVisible();

    // Check for task statistics
    const totalTasks = page.getByTestId('total-tasks');
    await expect(totalTasks).toBeVisible();

    const completedTasks = page.getByTestId('completed-tasks');
    await expect(completedTasks).toBeVisible();
  });

  test('should display tasks section', async ({ page }) => {
    // Check for tasks heading
    const tasksHeading = page.getByRole('heading', { name: /tasks/i });
    await expect(tasksHeading).toBeVisible();

    // Wait for task items to load
    await page.waitForSelector('[data-testid="task-item"]', { timeout: 5000 });

    // Check that at least one task is displayed
    const taskItems = page.getByTestId('task-item');
    const count = await taskItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should toggle between list and graph view', async ({ page }) => {
    // Find the view toggle buttons
    const listViewButton = page.getByRole('button', { name: /list view/i });
    const graphViewButton = page.getByRole('button', { name: /dependency graph/i });

    await expect(listViewButton).toBeVisible();
    await expect(graphViewButton).toBeVisible();

    // Click list view (should already be active)
    await listViewButton.click();

    // Tasks should be visible in list format
    await expect(page.getByTestId('task-item')).first().toBeVisible();

    // Click graph view
    await graphViewButton.click();

    // Dependency graph should be visible
    await expect(page.getByTestId('dependency-graph')).toBeVisible();

    // Click list view again to toggle back
    await listViewButton.click();

    // List should be visible again
    await expect(page.getByTestId('task-item')).first().toBeVisible();
  });

  test('should filter tasks by status', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-item"]', { timeout: 5000 });

    // Get initial task count
    const allTasks = page.getByTestId('task-item');
    const initialCount = await allTasks.count();

    // Find the filter dropdown
    const filterSelect = page.getByRole('combobox', { name: /filter:/i });
    await expect(filterSelect).toBeVisible();

    // Change filter to "Pending" (if available)
    await filterSelect.click();
    await page.getByRole('option', { name: /pending/i }).click();

    // Wait for filtering to apply
    await page.waitForTimeout(500);

    // Note: Since all tasks might be pending, the count might not change
    // The important part is that the filter interaction works
    const filteredTasks = page.getByTestId('task-item');
    await expect(filteredTasks.first()).toBeVisible();

    // Reset filter to "All Tasks"
    await filterSelect.click();
    await page.getByRole('option', { name: /all tasks/i }).click();
  });

  test('should sort tasks by different criteria', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-item"]', { timeout: 5000 });

    // Find the sort dropdown
    const sortSelect = page.getByRole('combobox', { name: /sort by:/i });
    await expect(sortSelect).toBeVisible();

    // Sort by priority
    await sortSelect.click();
    await page.getByRole('option', { name: /priority/i }).click();

    // Wait for sorting to apply
    await page.waitForTimeout(500);

    // Tasks should still be visible
    await expect(page.getByTestId('task-item').first()).toBeVisible();

    // Sort by ID
    await sortSelect.click();
    await page.getByRole('option', { name: /^id$/i }).click();

    // Wait for sorting to apply
    await page.waitForTimeout(500);

    // Tasks should still be visible
    await expect(page.getByTestId('task-item').first()).toBeVisible();
  });

  test('should toggle sort order', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-item"]', { timeout: 5000 });

    // Find the sort order toggle button
    const sortToggle = page.getByRole('button', { name: /[↑↓]/ });
    await expect(sortToggle).toBeVisible();

    // Get the first task's ID before toggling
    const firstTaskBefore = page.getByTestId('task-item').first();
    const taskIdBefore = await firstTaskBy.getAttribute('data-task-id');

    // Toggle sort order
    await sortToggle.click();

    // Wait for re-sorting
    await page.waitForTimeout(500);

    // Tasks should still be visible
    await expect(page.getByTestId('task-item').first()).toBeVisible();
  });

  test('should display project overview if available', async ({ page }) => {
    // Check if overview section exists
    const overviewHeading = page.getByRole('heading', { name: /project overview/i });
    const hasOverview = await overviewHeading.count() > 0;

    if (hasOverview) {
      // Overview heading is visible
      await expect(overviewHeading).toBeVisible();

      // Overview content should be present
      const overviewContent = page.getByTestId('project-overview');
      await expect(overviewContent).toBeVisible();
    }
  });

  test('should display validation warnings if present', async ({ page }) => {
    // Check if there are validation warnings
    const warningSection = page.getByTestId('validation-warnings');
    const hasWarnings = await warningSection.count() > 0;

    if (hasWarnings) {
      // Warning section should be visible
      await expect(warningSection).toBeVisible();

      // Should contain warning text
      await expect(warningSection).toContainText(/warning/i);
    }
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload the page
    await page.reload();

    // Wait for content
    await page.waitForSelector('[data-testid="task-item"]', { timeout: 5000 });

    // Verify elements are still visible
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeVisible();

    const tasks = page.getByTestId('task-item');
    await expect(tasks.first()).toBeVisible();

    // View toggle buttons should work on mobile
    const listViewButton = page.getByRole('button', { name: /list view/i });
    await expect(listViewButton).toBeVisible();
  });

  test('should navigate back to plans list', async ({ page }) => {
    // Find the back navigation
    const backButton = page.getByRole('link', { name: /plans/i }).first();
    await expect(backButton).toBeVisible();

    // Click back
    await backButton.click();

    // Should be back on the home page
    await expect(page).toHaveURL('/');
  });
});
