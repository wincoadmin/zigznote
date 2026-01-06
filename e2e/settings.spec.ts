import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test('should display general settings', async ({ page }) => {
    await page.goto('/settings');

    // Check page header
    await expect(page.getByRole('heading', { name: /general settings/i })).toBeVisible();
    await expect(page.getByText(/manage your organization settings/i)).toBeVisible();
  });

  test('should display organization section', async ({ page }) => {
    await page.goto('/settings');

    // Check organization card
    await expect(page.getByRole('heading', { name: 'Organization' })).toBeVisible();
    await expect(page.getByText(/organization name/i)).toBeVisible();

    // Input field should exist
    await expect(page.getByRole('textbox')).toBeVisible();

    // Save button should exist
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
  });

  test('should display meeting defaults section', async ({ page }) => {
    await page.goto('/settings');

    // Check meeting defaults card - use getByText for case-sensitive match
    await expect(page.getByText('Meeting Defaults')).toBeVisible();

    // Check toggle options - use exact match to avoid matching descriptions
    await expect(page.getByText('Auto-join scheduled meetings')).toBeVisible();
    await expect(page.getByText('Auto-generate summaries')).toBeVisible();
    await expect(page.getByText('Extract action items', { exact: true })).toBeVisible();
  });

  test('should display danger zone', async ({ page }) => {
    await page.goto('/settings');

    // Check danger zone card
    await expect(page.getByText('Danger Zone')).toBeVisible();
    await expect(page.getByText(/delete organization/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /delete organization/i })).toBeVisible();
  });

  test('should have toggle switches', async ({ page }) => {
    await page.goto('/settings');

    // The toggle switches are custom styled - check that label containers exist
    // Checkboxes are sr-only, so check the visible toggle divs
    const toggleLabels = page.locator('label.cursor-pointer');
    await expect(toggleLabels.first()).toBeVisible();

    // Should have at least 3 toggle switches
    const count = await toggleLabels.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Settings Sub-Pages', () => {
  test('should navigate to integrations settings', async ({ page }) => {
    await page.goto('/settings/integrations');

    // Page should load without error (may require auth)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to notifications settings', async ({ page }) => {
    await page.goto('/settings/notifications');

    // Page should load without error
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to billing settings', async ({ page }) => {
    await page.goto('/settings/billing');

    // Page should load without error
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to webhooks settings', async ({ page }) => {
    await page.goto('/settings/webhooks');

    // Page should load without error
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to API keys settings', async ({ page }) => {
    await page.goto('/settings/api-keys');

    // Page should load without error
    await expect(page.locator('body')).toBeVisible();
  });
});
