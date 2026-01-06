import { test, expect } from '@playwright/test';

test.describe('New Meeting Page', () => {
  test('should display new meeting page', async ({ page }) => {
    await page.goto('/meetings/new');

    // Check page header
    await expect(page.getByRole('heading', { name: /new meeting/i })).toBeVisible();
    await expect(page.getByText(/upload a recording or record/i)).toBeVisible();
  });

  test('should display tab options', async ({ page }) => {
    await page.goto('/meetings/new');

    // Check tabs are visible
    await expect(page.getByRole('tab', { name: /upload audio/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /record meeting/i })).toBeVisible();
  });

  test('should default to upload tab', async ({ page }) => {
    await page.goto('/meetings/new');

    // Upload audio tab should be selected by default
    const uploadTab = page.getByRole('tab', { name: /upload audio/i });
    await expect(uploadTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should switch to record tab', async ({ page }) => {
    await page.goto('/meetings/new');

    // Click record tab
    await page.getByRole('tab', { name: /record meeting/i }).click();

    // Record tab should now be active
    const recordTab = page.getByRole('tab', { name: /record meeting/i });
    await expect(recordTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should display other options section', async ({ page }) => {
    await page.goto('/meetings/new');

    // Check help section
    await expect(page.getByRole('heading', { name: /other options/i })).toBeVisible();
    await expect(page.getByText(/zoom, google meet, or teams/i)).toBeVisible();
  });

  test('should display upload content when upload tab selected', async ({ page }) => {
    await page.goto('/meetings/new');

    // Upload tab content should be visible
    // This may include a dropzone or file input
    const uploadArea = page.locator('[role="tabpanel"]').first();
    await expect(uploadArea).toBeVisible();
  });

  test('should display record content when record tab selected', async ({ page }) => {
    await page.goto('/meetings/new');

    // Switch to record tab
    await page.getByRole('tab', { name: /record meeting/i }).click();

    // Wait for tab to be selected
    await expect(page.getByRole('tab', { name: /record meeting/i })).toHaveAttribute('aria-selected', 'true');

    // Record tab content should be visible - check for the tab panel
    const recordPanel = page.locator('[role="tabpanel"]').filter({ has: page.locator(':visible') });
    await expect(recordPanel.first()).toBeVisible();
  });
});
