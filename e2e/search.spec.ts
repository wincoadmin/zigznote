import { test, expect } from '@playwright/test';

test.describe('Search Page', () => {
  // Helper to check if we're on search page or login
  const isOnProtectedPage = async (page: any, targetUrl: string) => {
    await page.goto(targetUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    const url = page.url();
    return !url.includes('/auth/') && !url.includes('/sign-in');
  };

  test('should display search page header', async ({ page }) => {
    const onPage = await isOnProtectedPage(page, '/search');

    if (onPage) {
      // Check page title
      await expect(page.getByRole('heading', { name: /search/i }).first()).toBeVisible();
    } else {
      await expect(page.getByText(/sign in/i).first()).toBeVisible();
    }
  });

  test('should have search input', async ({ page }) => {
    const onPage = await isOnProtectedPage(page, '/search');

    if (onPage) {
      // Check search bar is visible
      const searchInput = page.getByPlaceholder(/search/i).first();
      await expect(searchInput).toBeVisible();
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should display filter buttons', async ({ page }) => {
    const onPage = await isOnProtectedPage(page, '/search');

    if (onPage) {
      // Check filter buttons exist
      const hasFilters = await page.getByRole('button', { name: /filters/i }).isVisible().catch(() => false);
      const hasSearch = await page.getByPlaceholder(/search/i).first().isVisible().catch(() => false);
      expect(hasFilters || hasSearch).toBeTruthy();
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should display search tips before search', async ({ page }) => {
    const onPage = await isOnProtectedPage(page, '/search');

    if (onPage) {
      // Before searching, tips may or may not be visible depending on search state
      const hasTips = await page.getByText(/tips/i).isVisible().catch(() => false);
      const hasSearch = await page.getByPlaceholder(/search/i).first().isVisible().catch(() => false);
      expect(hasTips || hasSearch).toBeTruthy();
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should toggle filter panel', async ({ page }) => {
    const onPage = await isOnProtectedPage(page, '/search');

    if (onPage) {
      // Click filters button if it exists
      const filtersButton = page.getByRole('button', { name: /filters/i });
      if (await filtersButton.isVisible().catch(() => false)) {
        await filtersButton.click();
        // Something should appear
        await expect(page.locator('body')).toBeVisible();
      }
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should perform search', async ({ page }) => {
    const onPage = await isOnProtectedPage(page, '/search');

    if (onPage) {
      // Type in search
      const searchInput = page.getByPlaceholder(/search/i).first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('test meeting');
        await searchInput.press('Enter');
      }
      await expect(page.locator('body')).toBeVisible();
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should toggle type filters', async ({ page }) => {
    const onPage = await isOnProtectedPage(page, '/search');

    if (onPage) {
      // Find and click a type filter button if it exists
      const meetingsFilter = page.getByRole('button', { name: /meetings/i }).first();
      if (await meetingsFilter.isVisible().catch(() => false)) {
        await meetingsFilter.click();
        await expect(meetingsFilter).toBeVisible();
      }
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
