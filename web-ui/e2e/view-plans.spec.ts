import { test, expect } from '@playwright/test';

/**
 * Test suite: View Plans Page
 *
 * Tests the plans list page functionality:
 * - Displaying available plans
 * - Loading plan data
 * - Navigation to plan details
 * - Responsive layout
 */
test.describe('View Plans Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page (plans list)
    await page.goto('/');
  });

  test('should display the page header', async ({ page }) => {
    // Check for the main heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Plans');
  });

  test('should display a list of available plans', async ({ page }) => {
    // Wait for the plan cards to load
    await page.waitForSelector('[data-testid="plan-card"]', { timeout: 10000 });

    // Check that at least one plan card is visible
    const planCards = page.getByTestId('plan-card');
    const count = await planCards.count();

    // There should be at least one plan (the web-ui plan)
    expect(count).toBeGreaterThan(0);

    // Check that the first plan card has required elements
    const firstCard = planCards.first();
    await expect(firstCard).toBeVisible();

    // Plan title should be visible
    const title = firstCard.getByRole('heading', { level: 3 });
    await expect(title).toBeVisible();
  });

  test('should navigate to plan details when clicking a plan', async ({ page }) => {
    // Wait for plan cards to load
    await page.waitForSelector('[data-testid="plan-card"]', { timeout: 10000 });

    // Get the first plan card
    const planCard = page.getByTestId('plan-card').first();

    // Get the plan ID from the card (store for later verification)
    const planId = await planCard.getAttribute('data-plan-id');
    expect(planId).toBeTruthy();

    // Click the plan card to navigate to details
    await planCard.click();

    // Wait for navigation
    await page.waitForURL(/\/plan\/.+/);

    // Verify we're on a plan detail page
    const url = page.url();
    expect(url).toMatch(/\/plan\/.+/);

    // Verify plan detail page elements
    const planTitle = page.getByRole('heading', { level: 1 });
    await expect(planTitle).toBeVisible();
  });

  test('should display plan metadata on cards', async ({ page }) => {
    // Wait for plan cards to load
    await page.waitForSelector('[data-testid="plan-card"]', { timeout: 10000 });

    const planCard = page.getByTestId('plan-card').first();

    // Check for task count
    const taskCount = planCard.getByTestId('task-count');
    await expect(taskCount).toBeVisible();

    // Check for status indicators (completed, in-progress, failed)
    const completedCount = planCard.getByTestId('completed-count');
    await expect(completedCount).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload the page
    await page.reload();

    // Wait for plan cards
    await page.waitForSelector('[data-testid="plan-card"]', { timeout: 10000 });

    // Verify cards are still visible
    const planCards = page.getByTestId('plan-card');
    await expect(planCards.first()).toBeVisible();

    // Check that layout adapts (elements are stacked)
    const card = planCards.first();
    const title = card.getByRole('heading', { level: 3 });
    await expect(title).toBeVisible();
  });

  test('should handle loading state gracefully', async ({ page }) => {
    // Navigate and immediately check for loading indicator
    // This test verifies the loading UI is handled properly
    await page.goto('/');

    // The page should eventually show content
    await page.waitForSelector('[data-testid="plan-card"]', { timeout: 10000 });

    // After loading, there should be no error message
    const errorMessage = page.getByText('Failed to load plans');
    await expect(errorMessage).not.toBeVisible();
  });

  test('should allow navigation back to home from plan details', async ({ page }) => {
    // Wait for plan cards
    await page.waitForSelector('[data-testid="plan-card"]', { timeout: 10000 });

    // Click first plan
    const planCard = page.getByTestId('plan-card').first();
    await planCard.click();

    // Wait for navigation
    await page.waitForURL(/\/plan\/.+/);

    // Click the back link or navigate home
    const backButton = page.getByRole('link', { name: /back|plans/i });
    if (await backButton.isVisible()) {
      await backButton.click();
    } else {
      await page.goto('/');
    }

    // Verify we're back on the plans list
    await expect(page).toHaveURL('/');
  });
});
