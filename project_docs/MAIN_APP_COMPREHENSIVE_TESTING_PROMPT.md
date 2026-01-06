# Main App Comprehensive Testing Mission

## Objective
Test the ENTIRE main web application (`apps/web/`) and API (`apps/api/`). Audit existing tests, create missing tests for ALL features across all 23 phases, and fix any failures. **DO NOT STOP until 100% of tests pass with full feature coverage.**

---

## Rules
1. **Do NOT ask for permission** - just fix and continue
2. **Do NOT stop** until all tests pass
3. **Create tests** for any untested features
4. **Fix app code** if tests reveal real bugs
5. After each fix, **re-run tests** to verify
6. Loop continuously until 100% green

---

## Step 1: Audit Existing Test Coverage

First, list what's currently tested:
```bash
find e2e -name "*.spec.ts" -exec echo "=== {} ===" \; -exec grep "test\('" {} \;
```

Compare against the feature list below and identify gaps.

---

## Step 2: Feature Coverage Checklist

Create or update tests for EVERY feature:

### Phase 0: Foundation
- [ ] App loads without errors
- [ ] Environment variables are set
- [ ] Database connection works
- [ ] Redis connection works

### Phase 1: Authentication (Clerk)
- [ ] Unauthenticated redirect to login
- [ ] Login page displays
- [ ] Sign up flow works
- [ ] Logout works
- [ ] Protected routes require auth

### Phase 2: Meetings Core
- [ ] Meeting list displays
- [ ] Meeting list pagination
- [ ] Meeting list filtering by status
- [ ] Create new meeting (manual)
- [ ] Create meeting with URL (auto-detect platform)
- [ ] Meeting detail page loads
- [ ] Meeting shows correct status badge
- [ ] Meeting participants display

### Phase 3: Transcription
- [ ] Transcript viewer loads
- [ ] Transcript segments display
- [ ] Transcript search works
- [ ] Transcript highlights search matches
- [ ] Speaker labels display
- [ ] Timestamp navigation works
- [ ] Click segment jumps to time

### Phase 4: AI Summary
- [ ] Summary panel loads
- [ ] Overview section displays
- [ ] Key points display
- [ ] Decisions display
- [ ] Action items display
- [ ] Action item checkbox toggles
- [ ] Action item assignee shows

### Phase 5: Search
- [ ] Global search bar visible
- [ ] Search returns results
- [ ] Search highlights matches
- [ ] Search filters by type (meeting/transcript/action)
- [ ] Search filters by date range
- [ ] Cross-meeting search works
- [ ] Empty search state displays

### Phase 6: Integrations
- [ ] Settings > Integrations page loads
- [ ] Slack integration card displays
- [ ] HubSpot integration card displays
- [ ] Connect integration flow
- [ ] Disconnect integration works
- [ ] Webhook settings page loads
- [ ] Create webhook works
- [ ] Webhook list displays
- [ ] Delete webhook works

### Phase 6.5: User API Keys
- [ ] Settings > API Keys page loads
- [ ] API keys list displays
- [ ] Create new API key
- [ ] API key only shown once (security)
- [ ] Copy API key to clipboard
- [ ] Revoke API key works
- [ ] API key permissions display

### Phase 6.6: Transcript Polish
- [ ] Custom vocabulary page/section exists
- [ ] Add custom term works
- [ ] Edit custom term works
- [ ] Delete custom term works
- [ ] Vocabulary applied in transcripts

### Phase 6.6.1: Speaker Recognition
- [ ] Speaker management UI exists
- [ ] Rename speaker works
- [ ] Merge speakers works
- [ ] Speaker aliases work
- [ ] Voice profile upload (if applicable)

### Phase 6.7: Audio Input
- [ ] Audio upload page/modal loads
- [ ] Drag and drop file upload
- [ ] Click to browse upload
- [ ] Upload progress displays
- [ ] Supported formats shown (MP3, WAV, M4A)
- [ ] File size limit shown (500MB)
- [ ] Browser recording UI loads
- [ ] Start recording works
- [ ] Stop recording works
- [ ] Recording timer displays
- [ ] Recording waveform/indicator shows

### Phase 7: Calendar & Notifications
- [ ] Calendar connection UI exists
- [ ] Connect Google Calendar flow
- [ ] Upcoming meetings from calendar show
- [ ] Notification settings page loads
- [ ] Email notification toggles work
- [ ] In-app notification toggles work
- [ ] Notification preferences save

### Phase 8: Dashboard
- [ ] Dashboard page loads
- [ ] Stats cards display (meetings count, time saved, etc.)
- [ ] Recent meetings section
- [ ] Upcoming meetings section
- [ ] Quick actions work
- [ ] Meeting trends chart displays
- [ ] Productivity score shows
- [ ] Achievements card displays

### Phase 8.5: Help Center
- [ ] Help page loads
- [ ] Help categories display
- [ ] Category page loads
- [ ] Article page loads
- [ ] Help search works
- [ ] AI help assistant (if applicable)
- [ ] Help tooltip component works

### Phase 8.6: Analytics
- [ ] Analytics/insights available
- [ ] Meeting analytics display
- [ ] Usage metrics show
- [ ] Time saved calculations
- [ ] Export analytics (if applicable)

### Phase 8.7: UI/UX Polish
- [ ] Dark mode toggle works
- [ ] Theme persists after reload
- [ ] Command palette opens (Cmd/Ctrl + K)
- [ ] Command palette search works
- [ ] Keyboard navigation works
- [ ] Loading states display
- [ ] Empty states display
- [ ] Error states display
- [ ] Onboarding wizard shows (new users)
- [ ] Onboarding steps complete
- [ ] Onboarding can be skipped
- [ ] Welcome modal displays
- [ ] Celebration modal (achievements)

### Phase 8.8: Meeting AI Chat
- [ ] Meeting chat panel loads
- [ ] Send message works
- [ ] AI response displays
- [ ] Citations show and link to transcript
- [ ] Suggested questions display
- [ ] Click suggested question sends it
- [ ] Chat history persists
- [ ] Clear chat works

### Phase 9: Document Generation
- [ ] Export menu exists
- [ ] Export as PDF works
- [ ] Export as DOCX works
- [ ] Export as TXT works
- [ ] Generated file downloads
- [ ] Export includes correct content

### Phase 9.5: Smart Chat Input
- [ ] Chat input accepts text
- [ ] File attachment button exists
- [ ] Drag and drop files to chat
- [ ] Paste image into chat
- [ ] Attachment preview shows
- [ ] Remove attachment works
- [ ] Inline voice recording
- [ ] Send with attachment works

### Phase 10: Production Compliance
- [ ] /terms page loads
- [ ] /privacy page loads
- [ ] /cookies page loads
- [ ] Cookie consent banner appears (first visit)
- [ ] Accept all cookies works
- [ ] Reject all cookies works
- [ ] Customize cookies works
- [ ] Cookie preferences persist
- [ ] Footer links work
- [ ] Mobile navigation works
- [ ] Responsive on iPhone SE (375px)
- [ ] Responsive on iPad (768px)

### Settings Pages
- [ ] Settings layout loads
- [ ] Profile settings (if exists)
- [ ] Notification settings
- [ ] Billing settings page loads
- [ ] Current plan displays
- [ ] Upgrade plan flow
- [ ] Payment history (if applicable)
- [ ] Integrations settings
- [ ] API keys settings
- [ ] Webhooks settings

### Sharing & Collaboration
- [ ] Share meeting button exists
- [ ] Share dialog opens
- [ ] Add user by email
- [ ] Permission levels work (view/edit)
- [ ] Copy share link works
- [ ] Shared users list displays
- [ ] Remove shared user works

### Error Handling
- [ ] 404 page displays for unknown routes
- [ ] Error boundary catches errors
- [ ] API errors show user-friendly messages
- [ ] Network error handling
- [ ] Retry mechanisms work

---

## Step 3: Create Missing Test Files

Based on the audit, create these test files:

### `e2e/auth.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*sign-in|login/);
  });

  test('should show login page', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('text=/sign in|log in/i').first()).toBeVisible();
  });

  test('should show sign up option', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('text=/sign up|create account/i').first()).toBeVisible();
  });
});
```

### `e2e/meetings-crud.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Meeting CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Setup auth
    await page.goto('/meetings');
  });

  test('should display meetings list', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: /meeting/i })).toBeVisible();
  });

  test('should have create meeting button', async ({ page }) => {
    await expect(page.locator('a, button').filter({ hasText: /new meeting|create/i }).first()).toBeVisible();
  });

  test('should open create meeting page', async ({ page }) => {
    await page.click('a[href*="/meetings/new"], button:has-text("New Meeting")');
    await expect(page).toHaveURL(/.*meetings\/new/);
  });

  test('should show meeting form fields', async ({ page }) => {
    await page.goto('/meetings/new');
    await expect(page.locator('input[name="title"], input[placeholder*="title" i]').first()).toBeVisible();
  });

  test('should show meeting cards with correct info', async ({ page }) => {
    const meetingCard = page.locator('[data-testid="meeting-card"], .meeting-card').first();
    if (await meetingCard.isVisible()) {
      await expect(meetingCard.locator('text=/zoom|meet|teams/i')).toBeVisible();
    }
  });

  test('should navigate to meeting detail', async ({ page }) => {
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      await expect(page).toHaveURL(/.*meetings\/.+/);
    }
  });
});
```

### `e2e/transcript.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Transcript Viewer', () => {
  test('should display transcript segments', async ({ page }) => {
    // Navigate to a meeting with transcript
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      await page.waitForSelector('[data-testid="transcript"], .transcript', { timeout: 10000 });
    }
  });

  test('should show speaker labels', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      const speaker = page.locator('[data-testid="speaker-label"], .speaker-name').first();
      await expect(speaker).toBeVisible({ timeout: 10000 });
    }
  });

  test('should have transcript search', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      const searchInput = page.locator('input[placeholder*="search" i]').first();
      await expect(searchInput).toBeVisible({ timeout: 10000 });
    }
  });
});
```

### `e2e/summary.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Meeting Summary', () => {
  test('should display summary panel', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      await expect(page.locator('[data-testid="summary"], .summary-panel').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show action items', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      await expect(page.locator('text=/action item/i').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should toggle action item completion', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      const checkbox = page.locator('[data-testid="action-item"] input[type="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.click();
      }
    }
  });
});
```

### `e2e/search.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Search Functionality', () => {
  test('should display search page', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('input[type="search"], input[placeholder*="search" i]').first()).toBeVisible();
  });

  test('should search and display results', async ({ page }) => {
    await page.goto('/search');
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await searchInput.fill('meeting');
    await searchInput.press('Enter');
    await page.waitForTimeout(1000);
    // Results or empty state should show
    await expect(page.locator('[data-testid="search-results"], [data-testid="empty-state"], .search-results').first()).toBeVisible();
  });

  test('should have filter options', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('select, [data-testid="search-filter"], button:has-text("Filter")').first()).toBeVisible();
  });
});
```

### `e2e/meeting-chat.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Meeting AI Chat', () => {
  test('should display chat interface on meeting page', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      await expect(page.locator('[data-testid="meeting-chat"], .chat-interface').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should have chat input', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      await expect(page.locator('textarea, input[placeholder*="message" i], input[placeholder*="ask" i]').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show suggested questions', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      await expect(page.locator('[data-testid="suggested-questions"], .suggested-questions').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should send message', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      const chatInput = page.locator('textarea, input[placeholder*="message" i]').first();
      if (await chatInput.isVisible()) {
        await chatInput.fill('What was discussed in this meeting?');
        await page.click('button[type="submit"], button:has-text("Send")');
      }
    }
  });
});
```

### `e2e/settings.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Settings Pages', () => {
  test('should display settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h1, h2').filter({ hasText: /setting/i }).first()).toBeVisible();
  });

  test('should show notification settings', async ({ page }) => {
    await page.goto('/settings/notifications');
    await expect(page.locator('text=/notification/i').first()).toBeVisible();
  });

  test('should have toggle switches', async ({ page }) => {
    await page.goto('/settings/notifications');
    await expect(page.locator('input[type="checkbox"], [role="switch"]').first()).toBeVisible();
  });

  test('should show billing settings', async ({ page }) => {
    await page.goto('/settings/billing');
    await expect(page.locator('text=/billing|subscription|plan/i').first()).toBeVisible();
  });

  test('should show integrations settings', async ({ page }) => {
    await page.goto('/settings/integrations');
    await expect(page.locator('text=/integration/i').first()).toBeVisible();
  });

  test('should show API keys settings', async ({ page }) => {
    await page.goto('/settings/api-keys');
    await expect(page.locator('text=/api.*key/i').first()).toBeVisible();
  });

  test('should show webhooks settings', async ({ page }) => {
    await page.goto('/settings/webhooks');
    await expect(page.locator('text=/webhook/i').first()).toBeVisible();
  });
});
```

### `e2e/audio-input.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Audio Input', () => {
  test('should show audio upload option', async ({ page }) => {
    await page.goto('/meetings/new');
    await expect(page.locator('text=/upload|audio|record/i').first()).toBeVisible();
  });

  test('should display drag and drop zone', async ({ page }) => {
    await page.goto('/meetings/new');
    await expect(page.locator('[data-testid="dropzone"], .dropzone, text=/drag.*drop/i').first()).toBeVisible();
  });

  test('should show supported formats', async ({ page }) => {
    await page.goto('/meetings/new');
    await expect(page.locator('text=/mp3|wav|m4a/i').first()).toBeVisible();
  });

  test('should have browser recording option', async ({ page }) => {
    await page.goto('/meetings/new');
    await expect(page.locator('button:has-text("Record"), [data-testid="record-button"]').first()).toBeVisible();
  });
});
```

### `e2e/legal-pages.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Legal Pages', () => {
  test('should display terms of service', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('h1').filter({ hasText: /terms/i })).toBeVisible();
  });

  test('should display privacy policy', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('h1').filter({ hasText: /privacy/i })).toBeVisible();
  });

  test('should display cookie policy', async ({ page }) => {
    await page.goto('/cookies');
    await expect(page.locator('h1').filter({ hasText: /cookie/i })).toBeVisible();
  });

  test('should show cookie consent banner on first visit', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await expect(page.locator('[data-testid="cookie-consent"], .cookie-banner, text=/cookie/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should accept all cookies', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    const acceptButton = page.locator('button').filter({ hasText: /accept all/i }).first();
    if (await acceptButton.isVisible()) {
      await acceptButton.click();
      await expect(page.locator('[data-testid="cookie-consent"], .cookie-banner')).not.toBeVisible();
    }
  });

  test('should have footer with legal links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer a[href*="terms"]')).toBeVisible();
    await expect(page.locator('footer a[href*="privacy"]')).toBeVisible();
  });
});
```

### `e2e/responsive.spec.ts`
```typescript
import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  test.use({ ...devices['iPhone SE'] });

  test('should display mobile navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="mobile-nav"], nav.mobile, button[aria-label*="menu"]').first()).toBeVisible();
  });

  test('should have readable text on mobile', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    const fontSize = await body.evaluate(el => window.getComputedStyle(el).fontSize);
    expect(parseInt(fontSize)).toBeGreaterThanOrEqual(14);
  });

  test('should not have horizontal scroll', async ({ page }) => {
    await page.goto('/');
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('should have tappable buttons (44px min)', async ({ page }) => {
    await page.goto('/');
    const buttons = page.locator('button, a').first();
    const box = await buttons.boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('Tablet Responsiveness', () => {
  test.use({ ...devices['iPad Mini'] });

  test('should display sidebar on tablet', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="sidebar"], aside, nav').first()).toBeVisible();
  });
});
```

### `e2e/export.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Document Export', () => {
  test('should have export menu on meeting page', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      await expect(page.locator('button:has-text("Export"), [data-testid="export-menu"]').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show export format options', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      const exportButton = page.locator('button:has-text("Export")').first();
      if (await exportButton.isVisible()) {
        await exportButton.click();
        await expect(page.locator('text=/pdf|docx|txt/i').first()).toBeVisible();
      }
    }
  });
});
```

### `e2e/onboarding.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('should show welcome modal for new users', async ({ page, context }) => {
    await context.clearCookies();
    // Clear any onboarding state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('onboarding_complete');
      localStorage.removeItem('welcome_shown');
    });
    await page.reload();
    
    // Check for welcome modal or onboarding
    const onboarding = page.locator('[data-testid="welcome-modal"], [data-testid="onboarding"], .onboarding').first();
    // May or may not show depending on auth state
  });

  test('should have skip option in onboarding', async ({ page }) => {
    await page.goto('/');
    const skipButton = page.locator('button:has-text("Skip"), a:has-text("Skip")').first();
    // If onboarding is shown, skip should be available
  });
});
```

### `e2e/sharing.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Meeting Sharing', () => {
  test('should have share button on meeting', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      await expect(page.locator('button:has-text("Share"), [data-testid="share-button"]').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should open share dialog', async ({ page }) => {
    await page.goto('/meetings');
    const meetingLink = page.locator('a[href*="/meetings/"]').first();
    if (await meetingLink.isVisible()) {
      await meetingLink.click();
      const shareButton = page.locator('button:has-text("Share")').first();
      if (await shareButton.isVisible()) {
        await shareButton.click();
        await expect(page.locator('[data-testid="share-dialog"], [role="dialog"]').first()).toBeVisible();
      }
    }
  });
});
```

### `e2e/error-handling.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('should show 404 for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz');
    await expect(page.locator('text=/404|not found/i').first()).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/v1/meetings', route => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) });
    });
    await page.goto('/meetings');
    await expect(page.locator('text=/error|try again|something went wrong/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show empty state when no data', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/v1/meetings', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ meetings: [], pagination: { total: 0 } }) });
    });
    await page.goto('/meetings');
    await expect(page.locator('text=/no meeting|empty|get started/i').first()).toBeVisible({ timeout: 10000 });
  });
});
```

### `e2e/keyboard-accessibility.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Keyboard Accessibility', () => {
  test('should open command palette with Cmd/Ctrl+K', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k');
    await expect(page.locator('[data-testid="command-palette"], [role="dialog"]').first()).toBeVisible();
  });

  test('should navigate with Tab key', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('should close dialogs with Escape', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible();
  });
});
```

---

## Step 4: Run All Tests

```bash
# Run all E2E tests
pnpm exec playwright test --reporter=list

# Run with specific browser
pnpm exec playwright test --project=chromium --reporter=list
```

---

## Step 5: Fix Loop

For EACH failing test:
1. Read error message
2. Identify root cause
3. Fix test OR fix app code
4. Re-run that test
5. Continue until fixed
6. Run full suite again

---

## Step 6: Run Unit/Integration Tests Too

```bash
# API tests
pnpm --filter api test

# Web tests
pnpm --filter web test

# All tests
pnpm test
```

Fix any failures.

---

## Step 7: Run Specialized Tests

```bash
# Security tests
pnpm test -- tests/security

# Load tests
pnpm test -- tests/load

# Performance tests
pnpm test -- tests/performance

# Accessibility tests
pnpm test -- tests/accessibility

# Chaos tests
pnpm test -- tests/chaos

# Production readiness
pnpm test -- tests/production
```

Fix any failures.

---

## Step 8: Final Verification

Run EVERYTHING 3 times:

```bash
pnpm exec playwright test && pnpm test && \
pnpm exec playwright test && pnpm test && \
pnpm exec playwright test && pnpm test
```

All 3 runs must pass.

---

## Step 9: Summary Report

After 100% pass:
- Total E2E tests: X
- Total unit tests: X
- New tests created: X
- Tests fixed: X
- App bugs fixed: X
- Files modified: list

---

## Begin Now

1. Audit existing tests
2. Create all missing tests from the checklist
3. Run all tests
4. Fix failures
5. Loop until 100% pass

**DO NOT STOP UNTIL ALL TESTS PASS.**

Go! 🚀
