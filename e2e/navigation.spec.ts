import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should display sidebar navigation', async ({ page }) => {
    await page.goto('/dashboard');

    // Check sidebar links exist
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Meetings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Calendar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Help' })).toBeVisible();
  });

  test('should navigate to meetings page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Meetings' }).click();

    await expect(page).toHaveURL(/\/meetings/);
  });

  test('should navigate to help page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Help' }).click();

    await expect(page).toHaveURL(/\/help/);
    await expect(page.getByRole('heading', { name: /how can we help/i })).toBeVisible();
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Settings' }).click();

    await expect(page).toHaveURL(/\/settings/);
  });

  test('should collapse sidebar', async ({ page }) => {
    await page.goto('/dashboard');

    // Find and click collapse button
    const collapseButton = page.getByRole('button', { name: /collapse sidebar/i });
    await collapseButton.click();

    // Sidebar should be collapsed - text labels should be hidden
    await expect(page.getByText('Dashboard')).not.toBeVisible();
  });
});
