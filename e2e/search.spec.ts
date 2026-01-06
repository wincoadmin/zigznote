import { test, expect } from '@playwright/test';

test.describe('Search Page', () => {
  test('should display search page header', async ({ page }) => {
    await page.goto('/search');

    // Check page title
    await expect(page.getByRole('heading', { name: /search your meetings/i })).toBeVisible();
    await expect(page.getByText(/find anything across meetings/i)).toBeVisible();
  });

  test('should have search input', async ({ page }) => {
    await page.goto('/search');

    // Check search bar is visible
    const searchInput = page.getByPlaceholder(/search meetings/i);
    await expect(searchInput).toBeVisible();
  });

  test('should display filter buttons', async ({ page }) => {
    await page.goto('/search');

    // Check filter buttons exist
    await expect(page.getByRole('button', { name: /filters/i })).toBeVisible();

    // Check type filter buttons (on desktop they show labels)
    await expect(page.getByRole('button', { name: /meetings/i }).first()).toBeVisible();
  });

  test('should display search tips before search', async ({ page }) => {
    await page.goto('/search');

    // Before searching, tips should be visible
    await expect(page.getByRole('heading', { name: /search tips/i })).toBeVisible();
    await expect(page.getByText(/keywords/i).first()).toBeVisible();
    await expect(page.getByText(/names/i).first()).toBeVisible();
  });

  test('should toggle filter panel', async ({ page }) => {
    await page.goto('/search');

    // Click filters button
    await page.getByRole('button', { name: /filters/i }).click();

    // Date range inputs should appear
    await expect(page.getByText(/date range/i)).toBeVisible();
    await expect(page.getByText(/from/i).first()).toBeVisible();
  });

  test('should perform search', async ({ page }) => {
    await page.goto('/search');

    // Type in search
    const searchInput = page.getByPlaceholder(/search meetings/i);
    await searchInput.fill('test meeting');
    await searchInput.press('Enter');

    // Search tips should be hidden after search
    await expect(page.getByRole('heading', { name: /search tips/i })).not.toBeVisible({ timeout: 5000 });
  });

  test('should toggle type filters', async ({ page }) => {
    await page.goto('/search');

    // Find and click a type filter button to toggle it
    const meetingsFilter = page.getByRole('button', { name: /meetings/i }).first();

    // Get initial state and click
    await meetingsFilter.click();

    // Filter should still be clickable (toggle off/on)
    await expect(meetingsFilter).toBeVisible();
  });
});
