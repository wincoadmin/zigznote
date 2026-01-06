import { test, expect } from '@playwright/test';

test.describe('Legal Pages', () => {
  test.describe('Terms of Service', () => {
    test('should display terms of service page', async ({ page }) => {
      await page.goto('/terms');

      // Check page title
      await expect(page.getByRole('heading', { name: /terms of service/i })).toBeVisible();

      // Check last updated date
      await expect(page.getByText(/last updated/i)).toBeVisible();
    });

    test('should display key sections', async ({ page }) => {
      await page.goto('/terms');

      // Check for important sections
      await expect(page.getByRole('heading', { name: /acceptance of terms/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /description of service/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /acceptable use/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /meeting recording consent/i })).toBeVisible();
    });

    test('should display contact information', async ({ page }) => {
      await page.goto('/terms');

      // Check contact section exists
      await expect(page.getByRole('heading', { name: /contact us/i })).toBeVisible();
      await expect(page.getByText(/legal@zigznote.com/i)).toBeVisible();
    });
  });

  test.describe('Privacy Policy', () => {
    test('should display privacy policy page', async ({ page }) => {
      await page.goto('/privacy');

      // Check page title
      await expect(page.getByRole('heading', { name: /privacy policy/i })).toBeVisible();

      // Check last updated date
      await expect(page.getByText(/last updated/i)).toBeVisible();
    });

    test('should display key sections', async ({ page }) => {
      await page.goto('/privacy');

      // Check for important sections
      await expect(page.getByRole('heading', { name: /information we collect/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /how we use your information/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /ai processing/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /your rights/i })).toBeVisible();
    });

    test('should mention data security', async ({ page }) => {
      await page.goto('/privacy');

      // Check security section
      await expect(page.getByRole('heading', { name: /data security/i })).toBeVisible();
      await expect(page.getByText(/encryption/i).first()).toBeVisible();
    });

    test('should display contact information', async ({ page }) => {
      await page.goto('/privacy');

      // Check contact section exists (multiple mentions, use first)
      await expect(page.getByText(/privacy@zigznote.com/i).first()).toBeVisible();
    });
  });

  test.describe('Cookies Policy', () => {
    test('should display cookies policy page', async ({ page }) => {
      await page.goto('/cookies');

      // Page should load without error
      await expect(page.locator('body')).toBeVisible();

      // Should have some content about cookies
      const hasCookieContent = await page.getByText(/cookie/i).first().isVisible().catch(() => false);
      expect(hasCookieContent).toBeTruthy();
    });
  });
});
