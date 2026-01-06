# Comprehensive E2E Testing Mission

## Objective
Run ALL Playwright e2e tests on the zigznote application and fix any failures. Continue iterating until **100% of tests pass**. Do not stop until every test is green.

## Important Instructions
1. **Do NOT ask for permission** - just fix issues and re-run tests
2. **Do NOT stop** until all tests pass
3. **Auto-fix** any failing tests by either:
   - Fixing the application code if there's a bug
   - Fixing the test if it's testing incorrectly
   - Adding missing functionality if tests expect features that don't exist
4. After each fix, **re-run the full test suite** to verify
5. Keep a running log of what you fixed

---

## Application Context

zigznote is an AI-powered meeting assistant with these features across 23 phases:

### Core Features to Test
- **Authentication**: Clerk-based auth (may need to mock or skip in e2e)
- **Dashboard**: Stats cards, recent meetings, upcoming meetings, quick actions
- **Meetings**: List, create, view details, transcripts, summaries, action items
- **Search**: Global search across meetings, transcripts, summaries
- **Meeting Chat**: AI chat within meetings with citations
- **Settings**: Notifications, integrations, webhooks, API keys, billing
- **Help Center**: Categories, articles, AI assistant
- **Legal Pages**: Terms, Privacy, Cookies (with cookie consent banner)
- **Audio**: File upload, browser recording
- **Onboarding**: Welcome modal, wizard, checklist

### Tech Stack
- Frontend: Next.js 14 (App Router) at http://localhost:3000
- API: Express at http://localhost:3001
- Database: PostgreSQL with Prisma
- Auth: Clerk (may need mocking for e2e)

---

## Step 1: Verify Docker Stack is Running

```bash
curl -s http://localhost:3000 > /dev/null && echo "Web: OK" || echo "Web: FAILED"
curl -s http://localhost:3001/health && echo "API: OK" || echo "API: FAILED"
```

If not running, start with:
```bash
docker-compose -f docker/docker-compose.yml up -d
# Wait for healthy status
sleep 30
```

---

## Step 2: Install Playwright (if needed)

```bash
pnpm exec playwright install --with-deps chromium
```

---

## Step 3: Run All E2E Tests

```bash
pnpm exec playwright test --reporter=list
```

---

## Step 4: Fix Loop

For each failing test:

1. **Read the error message** carefully
2. **Identify the root cause**:
   - Is it a selector issue? (element not found)
   - Is it a timing issue? (need more wait time)
   - Is it a missing feature? (app doesn't have what test expects)
   - Is it an API error? (backend returning errors)
   - Is it an auth issue? (needs login bypass)
3. **Apply the fix**:
   - Update test file if test is wrong
   - Update app code if app has bug
   - Add proper waits/retries for flaky tests
4. **Re-run the failing test** to verify fix:
   ```bash
   pnpm exec playwright test <test-file> --reporter=list
   ```
5. **Once fixed, run full suite again**

---

## Step 5: Common Fixes Reference

### Auth Bypass (if Clerk blocks tests)
Create or update `e2e/setup/auth.ts`:
```typescript
import { Page } from '@playwright/test';

export async function bypassAuth(page: Page) {
  // Set mock auth cookies/localStorage
  await page.context().addCookies([
    {
      name: '__session',
      value: 'test-session-token',
      domain: 'localhost',
      path: '/',
    }
  ]);
}
```

### Waiting for Elements
```typescript
// Bad
await page.click('#button');

// Good
await page.waitForSelector('#button', { state: 'visible' });
await page.click('#button');

// Better
await page.locator('#button').click({ timeout: 10000 });
```

### API Mocking (if backend data needed)
```typescript
await page.route('**/api/v1/meetings', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ meetings: [], pagination: { total: 0 } }),
  });
});
```

### Handling Loading States
```typescript
// Wait for loading to finish
await page.waitForSelector('[data-testid="loading"]', { state: 'hidden' });
// Or wait for specific content
await page.waitForSelector('[data-testid="meetings-list"]');
```

---

## Step 6: Test Coverage Checklist

Ensure tests exist and pass for:

### Navigation & Layout
- [ ] Homepage loads
- [ ] Dashboard accessible
- [ ] Sidebar navigation works
- [ ] Mobile navigation works
- [ ] Theme toggle works

### Meetings
- [ ] Meeting list displays
- [ ] Meeting cards show correct info
- [ ] Create new meeting flow
- [ ] Meeting detail page loads
- [ ] Transcript viewer works
- [ ] Summary panel displays
- [ ] Action items display
- [ ] Meeting player controls work

### Search
- [ ] Search bar visible
- [ ] Search returns results
- [ ] Search filters work
- [ ] Cross-meeting search works

### Settings
- [ ] Settings page loads
- [ ] Notification settings toggle
- [ ] Billing page accessible
- [ ] API keys page works
- [ ] Integrations page loads
- [ ] Webhooks management

### Help Center
- [ ] Help page loads
- [ ] Categories display
- [ ] Articles accessible
- [ ] Search within help works

### Legal Pages
- [ ] /terms loads
- [ ] /privacy loads  
- [ ] /cookies loads
- [ ] Cookie consent banner appears
- [ ] Cookie preferences saveable

### Error States
- [ ] 404 page works
- [ ] Error boundary catches errors
- [ ] Empty states display correctly

---

## Step 7: Final Verification

Once all individual tests pass, run the complete suite 3 times to ensure stability:

```bash
pnpm exec playwright test --reporter=list && \
pnpm exec playwright test --reporter=list && \
pnpm exec playwright test --reporter=list
```

All 3 runs must pass.

---

## Step 8: Generate Report

After 100% pass rate achieved:

```bash
pnpm exec playwright test --reporter=html
```

Then summarize:
- Total tests: X
- Passed: X
- Fixed during session: X
- Files modified: list them

---

## Constraints

1. **Do not delete tests** - fix them instead
2. **Do not skip tests** with `.skip()` - make them pass
3. **Prefer fixing app code** over weakening tests
4. **Add data-testid attributes** to components if selectors are fragile
5. **Keep tests deterministic** - no random data without seeding

---

## Begin Now

Start by running the test suite and fixing failures one by one. Do not stop until you see:

```
✓ All tests passed (XX/XX)
```

Good luck! 🚀
