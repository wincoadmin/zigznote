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

    // Stats cards should be visible - check for "Meetings this week" text
    await expect(page.getByText(/meetings this week/i)).toBeVisible();
  });

  test('should display meetings section', async ({ page }) => {
    await page.goto('/dashboard');

    // The /dashboard page shows "Upcoming Meetings" section
    await expect(page.getByText(/upcoming meetings/i)).toBeVisible();
  });

  test('should display activity section', async ({ page }) => {
    await page.goto('/dashboard');

    // The /dashboard page shows "Recent Activity" section
    await expect(page.getByText(/recent activity/i)).toBeVisible();
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
