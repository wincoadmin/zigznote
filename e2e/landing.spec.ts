import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display brand and navigation', async ({ page }) => {
    await page.goto('/');

    // Check zigznote brand is visible
    await expect(page.getByText('zig').first()).toBeVisible();
    await expect(page.getByText('note').first()).toBeVisible();

    // Check auth links
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });

  test('should display hero section', async ({ page }) => {
    await page.goto('/');

    // Check hero headline
    await expect(page.getByRole('heading', { name: /your meetings/i })).toBeVisible();
    await expect(page.getByText(/simplified/i).first()).toBeVisible();

    // Check hero description
    await expect(page.getByText(/automatically joins your meetings/i)).toBeVisible();

    // Check CTA buttons
    await expect(page.getByRole('link', { name: /start for free/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /watch demo/i })).toBeVisible();
  });

  test('should display feature cards', async ({ page }) => {
    await page.goto('/');

    // Check feature cards
    await expect(page.getByRole('heading', { name: /auto-join meetings/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /smart transcription/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /ai summaries/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /calendar sync/i })).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');

    // Check footer
    await expect(page.getByText(/all rights reserved/i)).toBeVisible();
  });

  test('should have working sign-in link', async ({ page }) => {
    await page.goto('/');

    // Click sign in link
    await page.getByRole('link', { name: /sign in/i }).click();

    // Should navigate to sign-in page (or Clerk redirect)
    await expect(page).toHaveURL(/sign-in|clerk/i);
  });

  test('should have working get started link', async ({ page }) => {
    await page.goto('/');

    // Click get started link
    await page.getByRole('link', { name: /get started/i }).click();

    // Should navigate to sign-up page (or Clerk redirect)
    await expect(page).toHaveURL(/sign-up|clerk/i);
  });
});
