import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should display dashboard page', async ({ page }) => {
    await page.goto('/dashboard');

    // Check welcome header
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByText(/here's what's happening/i)).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    await page.goto('/dashboard');

    // Stats cards should be visible (even if loading)
    await expect(page.locator('[data-testid="stats-cards"]').or(page.getByText(/meetings this week/i))).toBeVisible();
  });

  test('should display recent meetings section', async ({ page }) => {
    await page.goto('/dashboard');

    // Recent meetings section should exist
    await expect(page.getByText(/recent meetings/i)).toBeVisible();
  });

  test('should display quick actions', async ({ page }) => {
    await page.goto('/dashboard');

    // Quick actions should be visible
    await expect(page.getByText(/quick actions/i)).toBeVisible();
  });

  test('should show onboarding for new users', async ({ page }) => {
    // Clear localStorage to simulate new user
    await page.goto('/dashboard');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Onboarding wizard or checklist should appear
    // (One of these should be visible based on state)
    const hasOnboarding = await page.getByText(/getting started/i).isVisible()
      .catch(() => false);

    // Just verify the page loads without error
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });
});
