import { test, expect } from '@playwright/test';

test.describe('Help Center', () => {
  test('should display help center main page', async ({ page }) => {
    await page.goto('/help');

    // Wait for page content to be ready
    await expect(page.getByRole('heading', { name: /how can we help/i }).first()).toBeVisible({ timeout: 15000 });

    // Check search bar - placeholder is "Search for help articles..."
    await expect(page.getByPlaceholder(/search for help articles/i)).toBeVisible();

    // Check categories exist (as card titles) - use first() as text may appear multiple times
    await expect(page.getByText('Getting Started').first()).toBeVisible();
    await expect(page.getByText('Features').first()).toBeVisible();
    await expect(page.getByText('Integrations').first()).toBeVisible();
    await expect(page.getByText('Account & Billing').first()).toBeVisible();

    // Check FAQ section
    await expect(page.getByRole('heading', { name: /frequently asked questions/i })).toBeVisible();
  });

  test('should search for articles', async ({ page }) => {
    await page.goto('/help');

    // Wait for page content to be ready
    await expect(page.getByPlaceholder(/search for help articles/i)).toBeVisible({ timeout: 15000 });

    // Type in search - need at least 2 characters
    await page.getByPlaceholder(/search for help articles/i).fill('calendar');

    // Should show search results dropdown - wait for it to appear
    await expect(page.getByText('Connecting Your Calendar').first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to article page', async ({ page }) => {
    await page.goto('/help');

    // Click on an article - articles are shown in category cards
    await page.getByRole('link', { name: 'Welcome to zigznote' }).click();

    // Should be on article page - use first() as there may be multiple headings
    await expect(page.getByRole('heading', { name: /welcome to zigznote/i }).first()).toBeVisible();
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

    // Wait for content to be visible rather than networkidle (more reliable)
    await expect(page.getByText('Getting Started').first()).toBeVisible({ timeout: 15000 });

    // Click on a category card link (articles within category cards are links)
    // The "Getting Started" category has articles like "Welcome to zigznote"
    // which link to /help/getting-started/welcome
    await page.getByRole('link', { name: 'Connecting Your Calendar' }).click();

    // Should show article page
    await expect(page.getByRole('heading', { name: /connecting your calendar/i }).first()).toBeVisible();
  });
});
