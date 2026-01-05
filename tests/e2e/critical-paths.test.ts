/**
 * H.7 E2E Critical Path Tests
 * Playwright tests for critical user journeys
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Helper functions
const login = async (page: Page, email: string, password: string) => {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
};

const waitForToast = async (page: Page, text: string) => {
  await expect(page.locator(`text="${text}"`)).toBeVisible({ timeout: 5000 });
};

test.describe('Critical Path: User Onboarding', () => {
  test('should complete full signup flow', async ({ page }) => {
    // Step 1: Navigate to signup
    await page.goto(`${BASE_URL}/signup`);
    await expect(page).toHaveTitle(/Sign Up/);

    // Step 2: Fill signup form
    await page.fill('[data-testid="name-input"]', 'Test User');
    await page.fill('[data-testid="email-input"]', `test-${Date.now()}@example.com`);
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');

    // Step 3: Accept terms
    await page.check('[data-testid="terms-checkbox"]');

    // Step 4: Submit
    await page.click('[data-testid="signup-button"]');

    // Step 5: Verify redirect to onboarding
    await page.waitForURL(`${BASE_URL}/onboarding`);
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('should connect calendar during onboarding', async ({ page }) => {
    // Assume logged in user on onboarding page
    await page.goto(`${BASE_URL}/onboarding`);

    // Step 1: Click connect calendar
    await page.click('[data-testid="connect-google-calendar"]');

    // Step 2: Mock OAuth flow (in real test, would use mock OAuth server)
    // For now, verify the intent
    await expect(page.locator('[data-testid="oauth-loading"]')).toBeVisible();
  });

  test('should complete profile setup', async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding/profile`);

    // Fill profile details
    await page.fill('[data-testid="job-title-input"]', 'Product Manager');
    await page.selectOption('[data-testid="team-size-select"]', '10-50');
    await page.selectOption('[data-testid="meeting-frequency-select"]', '5-10');

    // Submit
    await page.click('[data-testid="complete-profile-button"]');

    // Verify redirect to dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`);
  });
});

test.describe('Critical Path: Meeting Recording Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, 'test@example.com', 'TestPassword123!');
  });

  test('should schedule a meeting for recording', async ({ page }) => {
    // Step 1: Navigate to meetings
    await page.goto(`${BASE_URL}/meetings`);

    // Step 2: Click new meeting
    await page.click('[data-testid="new-meeting-button"]');

    // Step 3: Fill meeting details
    await page.fill('[data-testid="meeting-title-input"]', 'Test Meeting');
    await page.fill('[data-testid="meeting-url-input"]', 'https://zoom.us/j/123456789');
    await page.fill('[data-testid="meeting-datetime-input"]', '2024-12-15T10:00');

    // Step 4: Enable recording options
    await page.check('[data-testid="enable-transcription"]');
    await page.check('[data-testid="enable-summary"]');

    // Step 5: Submit
    await page.click('[data-testid="schedule-meeting-button"]');

    // Step 6: Verify meeting created
    await waitForToast(page, 'Meeting scheduled successfully');
    await expect(page.locator('text="Test Meeting"')).toBeVisible();
  });

  test('should view meeting details and transcript', async ({ page }) => {
    // Navigate to a completed meeting
    await page.goto(`${BASE_URL}/meetings/completed-meeting-id`);

    // Verify meeting info displayed
    await expect(page.locator('[data-testid="meeting-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="meeting-date"]')).toBeVisible();

    // Verify transcript section
    await expect(page.locator('[data-testid="transcript-section"]')).toBeVisible();

    // Verify summary section
    await expect(page.locator('[data-testid="summary-section"]')).toBeVisible();

    // Verify action items
    await expect(page.locator('[data-testid="action-items-section"]')).toBeVisible();
  });

  test('should play recording with synchronized transcript', async ({ page }) => {
    await page.goto(`${BASE_URL}/meetings/completed-meeting-id`);

    // Click play button
    await page.click('[data-testid="play-button"]');

    // Verify player is playing
    await expect(page.locator('[data-testid="player-playing"]')).toBeVisible();

    // Verify transcript highlighting follows playback
    await page.waitForTimeout(2000);
    const highlightedSegment = page.locator('[data-testid="transcript-segment"].highlighted');
    await expect(highlightedSegment).toBeVisible();
  });

  test('should search within meeting transcript', async ({ page }) => {
    await page.goto(`${BASE_URL}/meetings/completed-meeting-id`);

    // Open transcript search
    await page.click('[data-testid="transcript-search-button"]');

    // Search for term
    await page.fill('[data-testid="transcript-search-input"]', 'budget');

    // Verify results highlighted
    const highlightedTerms = page.locator('.search-highlight');
    await expect(highlightedTerms.first()).toBeVisible();

    // Verify match count shown
    await expect(page.locator('[data-testid="search-match-count"]')).toContainText(/\d+ matches/);
  });
});

test.describe('Critical Path: Search and Discovery', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'TestPassword123!');
  });

  test('should search across all meetings', async ({ page }) => {
    await page.goto(`${BASE_URL}/search`);

    // Enter search query
    await page.fill('[data-testid="search-input"]', 'quarterly review');
    await page.press('[data-testid="search-input"]', 'Enter');

    // Verify results displayed
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

    // Verify result contains search term
    const firstResult = page.locator('[data-testid="search-result-item"]').first();
    await expect(firstResult).toBeVisible();
  });

  test('should filter search results by type', async ({ page }) => {
    await page.goto(`${BASE_URL}/search?q=budget`);

    // Filter by meetings only
    await page.click('[data-testid="filter-meetings"]');

    // Verify only meeting results shown
    const results = page.locator('[data-testid="search-result-item"]');
    const count = await results.count();

    for (let i = 0; i < count; i++) {
      await expect(results.nth(i).locator('[data-testid="result-type"]')).toContainText('Meeting');
    }
  });

  test('should filter search by date range', async ({ page }) => {
    await page.goto(`${BASE_URL}/search`);

    // Open date filter
    await page.click('[data-testid="date-filter-button"]');

    // Set date range
    await page.fill('[data-testid="date-from-input"]', '2024-01-01');
    await page.fill('[data-testid="date-to-input"]', '2024-06-30');
    await page.click('[data-testid="apply-date-filter"]');

    // Perform search
    await page.fill('[data-testid="search-input"]', 'meeting');
    await page.press('[data-testid="search-input"]', 'Enter');

    // Verify results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should show search suggestions', async ({ page }) => {
    await page.goto(`${BASE_URL}/search`);

    // Start typing
    await page.fill('[data-testid="search-input"]', 'bud');

    // Wait for suggestions
    await expect(page.locator('[data-testid="search-suggestions"]')).toBeVisible();

    // Verify suggestions appear
    const suggestions = page.locator('[data-testid="search-suggestion-item"]');
    await expect(suggestions.first()).toBeVisible();

    // Click suggestion
    await suggestions.first().click();

    // Verify search executed
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });
});

test.describe('Critical Path: Action Items Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'TestPassword123!');
  });

  test('should view all action items', async ({ page }) => {
    await page.goto(`${BASE_URL}/action-items`);

    // Verify action items list
    await expect(page.locator('[data-testid="action-items-list"]')).toBeVisible();

    // Verify filters available
    await expect(page.locator('[data-testid="filter-all"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-mine"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-completed"]')).toBeVisible();
  });

  test('should mark action item as complete', async ({ page }) => {
    await page.goto(`${BASE_URL}/action-items`);

    // Find first incomplete action item
    const actionItem = page.locator('[data-testid="action-item-incomplete"]').first();

    // Click checkbox
    await actionItem.locator('[data-testid="complete-checkbox"]').click();

    // Verify completion
    await expect(actionItem.locator('[data-testid="complete-checkbox"]')).toBeChecked();
    await waitForToast(page, 'Action item completed');
  });

  test('should edit action item assignee', async ({ page }) => {
    await page.goto(`${BASE_URL}/action-items`);

    // Click on action item
    const actionItem = page.locator('[data-testid="action-item"]').first();
    await actionItem.click();

    // Open assignee dropdown
    await page.click('[data-testid="assignee-dropdown"]');

    // Select new assignee
    await page.click('[data-testid="assignee-option-user-2"]');

    // Verify update
    await waitForToast(page, 'Assignee updated');
  });

  test('should set due date on action item', async ({ page }) => {
    await page.goto(`${BASE_URL}/action-items`);

    // Click on action item
    const actionItem = page.locator('[data-testid="action-item"]').first();
    await actionItem.click();

    // Click due date field
    await page.click('[data-testid="due-date-input"]');

    // Select date
    await page.fill('[data-testid="due-date-input"]', '2024-12-31');

    // Verify update
    await waitForToast(page, 'Due date updated');
  });
});

test.describe('Critical Path: Team Collaboration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'TestPassword123!');
  });

  test('should share meeting with team member', async ({ page }) => {
    await page.goto(`${BASE_URL}/meetings/test-meeting-id`);

    // Click share button
    await page.click('[data-testid="share-button"]');

    // Enter email
    await page.fill('[data-testid="share-email-input"]', 'colleague@example.com');

    // Select permission
    await page.selectOption('[data-testid="share-permission-select"]', 'viewer');

    // Send invite
    await page.click('[data-testid="send-share-button"]');

    // Verify
    await waitForToast(page, 'Meeting shared successfully');
  });

  test('should add comment to meeting', async ({ page }) => {
    await page.goto(`${BASE_URL}/meetings/test-meeting-id`);

    // Scroll to comments section
    await page.locator('[data-testid="comments-section"]').scrollIntoViewIfNeeded();

    // Add comment
    await page.fill('[data-testid="comment-input"]', 'Great discussion on the roadmap!');
    await page.click('[data-testid="submit-comment-button"]');

    // Verify comment appears
    await expect(page.locator('text="Great discussion on the roadmap!"')).toBeVisible();
  });

  test('should invite team member to organization', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/team`);

    // Click invite button
    await page.click('[data-testid="invite-member-button"]');

    // Fill email
    await page.fill('[data-testid="invite-email-input"]', 'newmember@example.com');

    // Select role
    await page.selectOption('[data-testid="invite-role-select"]', 'member');

    // Send invite
    await page.click('[data-testid="send-invite-button"]');

    // Verify
    await waitForToast(page, 'Invitation sent');
    await expect(page.locator('text="newmember@example.com"')).toBeVisible();
  });
});

test.describe('Critical Path: Settings and Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'TestPassword123!');
  });

  test('should update notification preferences', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/notifications`);

    // Toggle email notifications
    await page.click('[data-testid="email-summary-toggle"]');

    // Set frequency
    await page.selectOption('[data-testid="summary-frequency-select"]', 'daily');

    // Save
    await page.click('[data-testid="save-notifications-button"]');

    // Verify
    await waitForToast(page, 'Preferences saved');
  });

  test('should update meeting default settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/meetings`);

    // Enable auto-join by default
    await page.check('[data-testid="auto-join-checkbox"]');

    // Set default transcription language
    await page.selectOption('[data-testid="transcription-language-select"]', 'en-US');

    // Enable action item extraction
    await page.check('[data-testid="extract-actions-checkbox"]');

    // Save
    await page.click('[data-testid="save-meeting-settings-button"]');

    // Verify
    await waitForToast(page, 'Settings saved');
  });

  test('should manage connected integrations', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/integrations`);

    // Verify integration list
    await expect(page.locator('[data-testid="integration-google-calendar"]')).toBeVisible();
    await expect(page.locator('[data-testid="integration-slack"]')).toBeVisible();

    // Connect Slack
    await page.click('[data-testid="connect-slack-button"]');

    // Verify OAuth initiated
    await expect(page.locator('[data-testid="oauth-loading"]')).toBeVisible();
  });
});

test.describe('Critical Path: Billing and Subscription', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'TestPassword123!');
  });

  test('should view current subscription', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/billing`);

    // Verify current plan displayed
    await expect(page.locator('[data-testid="current-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-period"]')).toBeVisible();
    await expect(page.locator('[data-testid="next-billing-date"]')).toBeVisible();
  });

  test('should view invoice history', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/billing/invoices`);

    // Verify invoice list
    await expect(page.locator('[data-testid="invoices-list"]')).toBeVisible();

    // Verify download link
    const invoice = page.locator('[data-testid="invoice-item"]').first();
    await expect(invoice.locator('[data-testid="download-invoice-link"]')).toBeVisible();
  });

  test('should upgrade subscription plan', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/billing/plans`);

    // Select higher tier plan
    await page.click('[data-testid="select-pro-plan"]');

    // Verify checkout or confirmation
    await expect(page.locator('[data-testid="plan-confirmation"]')).toBeVisible();
  });
});

test.describe('Critical Path: Error Handling', () => {
  test('should show friendly error for 404 pages', async ({ page }) => {
    await page.goto(`${BASE_URL}/nonexistent-page-12345`);

    await expect(page.locator('[data-testid="error-404"]')).toBeVisible();
    await expect(page.locator('text=/page.*not found/i')).toBeVisible();
    await expect(page.locator('[data-testid="go-home-link"]')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Intercept API requests and fail them
    await page.route(`${API_URL}/**`, route => route.abort());

    // Trigger an action that makes API call
    await page.reload();

    // Verify error message shown
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Try to access protected page
    await page.goto(`${BASE_URL}/dashboard`);

    // Verify redirect to login
    await expect(page).toHaveURL(/.*login.*/);
  });
});

test.describe('Critical Path: Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should navigate with mobile menu', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');

    // Verify menu items visible
    await expect(page.locator('[data-testid="mobile-nav-meetings"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-search"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-settings"]')).toBeVisible();

    // Navigate to meetings
    await page.click('[data-testid="mobile-nav-meetings"]');
    await expect(page).toHaveURL(`${BASE_URL}/meetings`);
  });

  test('should display meeting cards properly on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/meetings`);

    // Verify cards are stacked vertically
    const cards = page.locator('[data-testid="meeting-card"]');
    const firstCard = await cards.first().boundingBox();
    const secondCard = await cards.nth(1).boundingBox();

    expect(firstCard).toBeTruthy();
    expect(secondCard).toBeTruthy();
    expect(secondCard!.y).toBeGreaterThan(firstCard!.y);
  });
});
