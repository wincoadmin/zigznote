import { test, expect } from '@playwright/test';

test.describe('Help Center', () => {
  test('should display help center main page', async ({ page }) => {
    await page.goto('/help');

    // Check header
    await expect(page.getByRole('heading', { name: /how can we help/i })).toBeVisible();

    // Check search bar
    await expect(page.getByPlaceholder(/search for help/i)).toBeVisible();

    // Check categories exist
    await expect(page.getByText('Getting Started')).toBeVisible();
    await expect(page.getByText('Features')).toBeVisible();
    await expect(page.getByText('Integrations')).toBeVisible();
    await expect(page.getByText('Account & Billing')).toBeVisible();

    // Check FAQ section
    await expect(page.getByRole('heading', { name: /frequently asked questions/i })).toBeVisible();
  });

  test('should search for articles', async ({ page }) => {
    await page.goto('/help');

    // Type in search
    await page.getByPlaceholder(/search for help/i).fill('calendar');

    // Should show search results
    await expect(page.getByText('Connecting Your Calendar')).toBeVisible();
  });

  test('should navigate to article page', async ({ page }) => {
    await page.goto('/help');

    // Click on an article
    await page.getByRole('link', { name: 'Welcome to zigznote' }).click();

    // Should be on article page
    await expect(page.getByRole('heading', { name: 'Welcome to zigznote' })).toBeVisible();

    // Check breadcrumb
    await expect(page.getByText('Help Center')).toBeVisible();
    await expect(page.getByText('Getting Started')).toBeVisible();
  });

  test('should expand FAQ answers', async ({ page }) => {
    await page.goto('/help');

    // Find and click a FAQ question
    const faqButton = page.getByRole('button', { name: /how does zigznote join my meetings/i });
    await faqButton.click();

    // Check answer is visible
    await expect(page.getByText(/zigznote uses a bot that joins/i)).toBeVisible();
  });

  test('should navigate to category page', async ({ page }) => {
    await page.goto('/help');

    // Click on "View all" link for a category
    await page.getByRole('link', { name: /view all/i }).first().click();

    // Should show category listing
    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
  });
});
