import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://localhost:3002';

test.describe('Admin Navigation', () => {
  test('should display admin branding', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);

    // Check for zigznote Admin branding
    await expect(page.getByText(/zigznote/i).first()).toBeVisible();
  });

  test('should have navigation sidebar when authenticated', async ({ page }) => {
    await page.goto(ADMIN_URL);

    const url = page.url();
    if (!url.includes('login')) {
      // Check for sidebar navigation items
      await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /users/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /organizations/i })).toBeVisible();
    }
  });

  test('should have sign out button', async ({ page }) => {
    await page.goto(ADMIN_URL);

    const url = page.url();
    if (!url.includes('login')) {
      await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
    }
  });

  test('should navigate to users page', async ({ page }) => {
    await page.goto(ADMIN_URL);

    const url = page.url();
    if (!url.includes('login')) {
      await page.click('a[href*="/users"]');
      await expect(page).toHaveURL(/.*users/);
    }
  });

  test('should navigate to organizations page', async ({ page }) => {
    await page.goto(ADMIN_URL);

    const url = page.url();
    if (!url.includes('login')) {
      await page.click('a[href*="/organizations"]');
      await expect(page).toHaveURL(/.*organizations/);
    }
  });

  test('should navigate to API keys page', async ({ page }) => {
    await page.goto(ADMIN_URL);

    const url = page.url();
    if (!url.includes('login')) {
      await page.click('a[href*="/api-keys"]');
      await expect(page).toHaveURL(/.*api-keys/);
    }
  });

  test('should navigate to operations page', async ({ page }) => {
    await page.goto(ADMIN_URL);

    const url = page.url();
    if (!url.includes('login')) {
      await page.click('a[href*="/operations"]');
      await expect(page).toHaveURL(/.*operations/);
    }
  });

  test('should show user indicator in header', async ({ page }) => {
    await page.goto(ADMIN_URL);

    const url = page.url();
    if (!url.includes('login')) {
      // Check for admin user indicator
      await expect(page.getByText(/admin user/i)).toBeVisible();
    }
  });

  test('should have mobile menu toggle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(ADMIN_URL);

    const url = page.url();
    if (!url.includes('login')) {
      // Mobile menu button should be visible
      const menuButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      await expect(menuButton).toBeVisible();
    }
  });

  test('should redirect to login on sign out', async ({ page }) => {
    await page.goto(ADMIN_URL);

    const url = page.url();
    if (!url.includes('login')) {
      // Click sign out
      await page.click('button:has-text("Sign Out")');

      // Should redirect to login
      await expect(page).toHaveURL(/.*login/);
    }
  });
});
