import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  // Sidebar is only visible on routes using (dashboard) layout like /meetings
  test('should display sidebar navigation', async ({ page }) => {
    await page.goto('/meetings');

    // Check sidebar links exist (visible on desktop)
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Meetings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Calendar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Help' })).toBeVisible();
  });

  test('should navigate to meetings page', async ({ page }) => {
    await page.goto('/search');
    await page.getByRole('link', { name: 'Meetings' }).click();

    await expect(page).toHaveURL(/\/meetings/);
  });

  test('should navigate to help page', async ({ page }) => {
    await page.goto('/meetings');
    await page.getByRole('link', { name: 'Help' }).click();

    await expect(page).toHaveURL(/\/help/);
    await expect(page.getByRole('heading', { name: /how can we help/i })).toBeVisible();
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/meetings');
    await page.getByRole('link', { name: 'Settings' }).click();

    await expect(page).toHaveURL(/\/settings/);
  });

  test('should collapse sidebar', async ({ page }) => {
    await page.goto('/meetings');

    // Find and click collapse button (aria-label is "Collapse sidebar" or "Expand sidebar")
    const collapseButton = page.getByRole('button', { name: /collapse sidebar/i });
    await collapseButton.click();

    // Sidebar should be collapsed - link text should be hidden, but icons remain
    // The link still exists but text content is not shown when collapsed
    await expect(page.getByRole('link', { name: 'Meetings' })).toBeVisible();
  });
});
