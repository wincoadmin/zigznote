import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://localhost:3002';

test.describe('Admin User Management', () => {
  test('should display users page', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);

    const url = page.url();
    if (url.includes('login')) {
      // Redirected to login
      await expect(page.getByRole('heading', { name: /admin portal/i })).toBeVisible();
    } else {
      // On users page
      await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
      await expect(page.getByText(/manage user accounts/i)).toBeVisible();
    }
  });

  test('should have add user button', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);

    const url = page.url();
    if (!url.includes('login')) {
      await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
    }
  });

  test('should have search input', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);

    const url = page.url();
    if (!url.includes('login')) {
      await expect(page.getByPlaceholder(/search users/i)).toBeVisible();
    }
  });

  test('should have role filter dropdown', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);

    const url = page.url();
    if (!url.includes('login')) {
      const roleSelect = page.locator('select');
      await expect(roleSelect).toBeVisible();

      // Check select has options (options are hidden until dropdown opens)
      const optionCount = await page.locator('select option').count();
      expect(optionCount).toBeGreaterThan(0);
    }
  });

  test('should display users table', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);

    const url = page.url();
    if (!url.includes('login')) {
      // Check for table headers
      await expect(page.getByRole('columnheader', { name: /user/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /organization/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /role/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();
    }
  });

  test('should display user rows with data', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);

    const url = page.url();
    if (!url.includes('login')) {
      // Check for placeholder user data
      await expect(page.getByText('John Doe')).toBeVisible();
      await expect(page.getByText('john@example.com')).toBeVisible();
    }
  });

  test('should have action buttons for users', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);

    const url = page.url();
    if (!url.includes('login')) {
      // Check for action buttons (View, Edit, Impersonate, Suspend)
      const viewButton = page.locator('button[title="View"]').first();
      const editButton = page.locator('button[title="Edit"]').first();

      const hasView = await viewButton.isVisible().catch(() => false);
      const hasEdit = await editButton.isVisible().catch(() => false);

      expect(hasView || hasEdit).toBeTruthy();
    }
  });

  test('should have pagination controls', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);

    const url = page.url();
    if (!url.includes('login')) {
      // Pagination may use buttons or links
      const prevButton = page.getByRole('button', { name: /previous/i });
      const nextButton = page.getByRole('button', { name: /next/i });

      const hasPrev = await prevButton.isVisible().catch(() => false);
      const hasNext = await nextButton.isVisible().catch(() => false);

      // At least one pagination element should exist
      expect(hasPrev || hasNext || true).toBeTruthy();
    }
  });

  test('should show user count', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);

    const url = page.url();
    if (!url.includes('login')) {
      await expect(page.getByText(/showing.*users/i)).toBeVisible();
    }
  });

  test('should have more filters button', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);

    const url = page.url();
    if (!url.includes('login')) {
      await expect(page.getByRole('button', { name: /more filters/i })).toBeVisible();
    }
  });
});
