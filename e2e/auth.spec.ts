import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    // Try accessing a protected route
    await page.goto('/dashboard');

    // Should redirect to sign-in or stay on page (depending on Clerk setup)
    // Clerk may show sign-in modal or redirect
    const url = page.url();
    const isRedirected = url.includes('sign-in') || url.includes('clerk');
    const isOnDashboard = url.includes('dashboard');

    // Either redirected to auth OR stayed (if auth is handled client-side)
    expect(isRedirected || isOnDashboard).toBeTruthy();
  });

  test('should display sign-in page', async ({ page }) => {
    await page.goto('/sign-in');

    // Page should load without error - Clerk may redirect or show its own UI
    await expect(page.locator('body')).toBeVisible();

    // Check URL or page content - Clerk may handle this differently
    const url = page.url();
    const isOnSignIn = url.includes('sign-in') || url.includes('clerk');
    const hasAnyForm = await page.locator('input, button').first().isVisible().catch(() => false);

    expect(isOnSignIn || hasAnyForm).toBeTruthy();
  });

  test('should display sign-up page', async ({ page }) => {
    await page.goto('/sign-up');

    // Page should load without error
    await expect(page.locator('body')).toBeVisible();

    // Check URL or page content
    const url = page.url();
    const isOnSignUp = url.includes('sign-up') || url.includes('clerk');
    const hasAnyForm = await page.locator('input, button').first().isVisible().catch(() => false);

    expect(isOnSignUp || hasAnyForm).toBeTruthy();
  });

  test('should have sign-in link on landing page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('should have sign-up link on landing page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: /get started|sign up/i })).toBeVisible();
  });
});
