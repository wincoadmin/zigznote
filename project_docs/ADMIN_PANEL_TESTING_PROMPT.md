# Admin Panel Comprehensive Testing Mission

## Objective
Test the ENTIRE admin panel application (`apps/admin/`). Create missing E2E tests, run all tests, and fix any failures. **DO NOT STOP until 100% of tests pass.**

---

## Rules
1. **Do NOT ask for permission** - just fix and continue
2. **Do NOT stop** until all tests pass
3. **Create tests** for any untested features
4. **Fix app code** if tests reveal real bugs
5. After each fix, **re-run tests** to verify
6. Loop continuously until 100% green

---

## Step 1: Start Admin Panel

First, check if admin panel is running:
```bash
curl -s http://localhost:3002 > /dev/null && echo "Admin: OK" || echo "Admin: Not running"
```

If not running, start it:
```bash
pnpm --filter admin dev &
sleep 10
```

Or if using Docker, check if it's included in docker-compose. If not, add it.

---

## Step 2: Run Existing Admin Tests

```bash
pnpm --filter admin test
```

Fix any failures before proceeding.

---

## Step 3: Create E2E Tests for Admin Panel

Create the following test files in `e2e/admin/`:

### 3.1 Create `e2e/admin/auth.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3002';

test.describe('Admin Authentication', () => {
  test('should show login page for unauthenticated users', async ({ page }) => {
    await page.goto(ADMIN_URL);
    await expect(page).toHaveURL(/.*login/);
  });

  test('should display login form', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/error|invalid|incorrect/i')).toBeVisible({ timeout: 10000 });
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // This test may need mock auth - implement based on your auth setup
    await page.goto(`${ADMIN_URL}/login`);
    // Add valid test credentials or mock the auth
  });
});
```

### 3.2 Create `e2e/admin/dashboard.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3002';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Setup auth - mock or use test credentials
    await page.goto(ADMIN_URL);
    // Add auth bypass if needed
  });

  test('should display dashboard overview', async ({ page }) => {
    await expect(page.locator('h1, [data-testid="dashboard-title"]')).toBeVisible();
  });

  test('should show key metrics/stats', async ({ page }) => {
    // Look for stats cards or metrics
    await expect(page.locator('[data-testid="stats"], .stats, .metrics').first()).toBeVisible();
  });

  test('should have navigation sidebar', async ({ page }) => {
    await expect(page.locator('nav, [data-testid="sidebar"], aside').first()).toBeVisible();
  });
});
```

### 3.3 Create `e2e/admin/users.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3002';

test.describe('Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN_URL}/users`);
  });

  test('should display users page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /users/i })).toBeVisible();
  });

  test('should show users table or list', async ({ page }) => {
    await expect(page.locator('table, [data-testid="users-list"], .users-list').first()).toBeVisible();
  });

  test('should have search/filter functionality', async ({ page }) => {
    await expect(page.locator('input[type="search"], input[placeholder*="search" i]').first()).toBeVisible();
  });

  test('should have pagination if many users', async ({ page }) => {
    // Check for pagination controls
    const pagination = page.locator('[data-testid="pagination"], .pagination, nav[aria-label="pagination"]');
    // Pagination may or may not exist depending on data
  });
});
```

### 3.4 Create `e2e/admin/organizations.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3002';

test.describe('Admin Organization Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN_URL}/organizations`);
  });

  test('should display organizations page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /organization/i })).toBeVisible();
  });

  test('should show organizations list', async ({ page }) => {
    await expect(page.locator('table, [data-testid="orgs-list"]').first()).toBeVisible();
  });

  test('should allow viewing organization details', async ({ page }) => {
    const firstOrg = page.locator('table tbody tr, [data-testid="org-row"]').first();
    if (await firstOrg.isVisible()) {
      await firstOrg.click();
      await expect(page.locator('[data-testid="org-details"], .org-details')).toBeVisible();
    }
  });
});
```

### 3.5 Create `e2e/admin/api-keys.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3002';

test.describe('Admin API Keys Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN_URL}/api-keys`);
  });

  test('should display API keys page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /api.*key/i })).toBeVisible();
  });

  test('should show existing API keys', async ({ page }) => {
    await expect(page.locator('table, [data-testid="api-keys-list"]').first()).toBeVisible();
  });

  test('should have create new key button', async ({ page }) => {
    await expect(page.locator('button').filter({ hasText: /create|new|add/i }).first()).toBeVisible();
  });
});
```

### 3.6 Create `e2e/admin/audit-logs.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3002';

test.describe('Admin Audit Logs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN_URL}/audit-logs`);
  });

  test('should display audit logs page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /audit|log/i })).toBeVisible();
  });

  test('should show audit log entries', async ({ page }) => {
    await expect(page.locator('table, [data-testid="audit-logs"]').first()).toBeVisible();
  });

  test('should have date filter', async ({ page }) => {
    await expect(page.locator('input[type="date"], [data-testid="date-filter"]').first()).toBeVisible();
  });

  test('should have action type filter', async ({ page }) => {
    await expect(page.locator('select, [data-testid="action-filter"]').first()).toBeVisible();
  });
});
```

### 3.7 Create `e2e/admin/feature-flags.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3002';

test.describe('Admin Feature Flags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN_URL}/feature-flags`);
  });

  test('should display feature flags page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /feature|flag/i })).toBeVisible();
  });

  test('should show feature flags list', async ({ page }) => {
    await expect(page.locator('table, [data-testid="feature-flags"]').first()).toBeVisible();
  });

  test('should have toggle switches for flags', async ({ page }) => {
    await expect(page.locator('input[type="checkbox"], [role="switch"]').first()).toBeVisible();
  });
});
```

### 3.8 Create `e2e/admin/operations.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3002';

test.describe('Admin Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN_URL}/operations`);
  });

  test('should display operations page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /operation/i })).toBeVisible();
  });

  test('should show system status', async ({ page }) => {
    await expect(page.locator('[data-testid="system-status"], .system-status').first()).toBeVisible();
  });

  test('should have action buttons for operations', async ({ page }) => {
    await expect(page.locator('button').first()).toBeVisible();
  });
});
```

### 3.9 Create `e2e/admin/navigation.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3002';

test.describe('Admin Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ADMIN_URL);
    // Add auth bypass
  });

  test('should navigate to Users page', async ({ page }) => {
    await page.click('a[href*="users"], [data-testid="nav-users"]');
    await expect(page).toHaveURL(/.*users/);
  });

  test('should navigate to Organizations page', async ({ page }) => {
    await page.click('a[href*="organizations"], [data-testid="nav-organizations"]');
    await expect(page).toHaveURL(/.*organizations/);
  });

  test('should navigate to API Keys page', async ({ page }) => {
    await page.click('a[href*="api-keys"], [data-testid="nav-api-keys"]');
    await expect(page).toHaveURL(/.*api-keys/);
  });

  test('should navigate to Audit Logs page', async ({ page }) => {
    await page.click('a[href*="audit"], [data-testid="nav-audit-logs"]');
    await expect(page).toHaveURL(/.*audit/);
  });

  test('should navigate to Feature Flags page', async ({ page }) => {
    await page.click('a[href*="feature"], [data-testid="nav-feature-flags"]');
    await expect(page).toHaveURL(/.*feature/);
  });

  test('should navigate to Operations page', async ({ page }) => {
    await page.click('a[href*="operations"], [data-testid="nav-operations"]');
    await expect(page).toHaveURL(/.*operations/);
  });

  test('should have logout button', async ({ page }) => {
    await expect(page.locator('button, a').filter({ hasText: /logout|sign out/i }).first()).toBeVisible();
  });
});
```

---

## Step 4: Update Playwright Config

Ensure `playwright.config.ts` includes admin tests:

```typescript
// Add to projects array
{
  name: 'admin-chromium',
  use: { 
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3002',
  },
  testDir: './e2e/admin',
},
```

---

## Step 5: Handle Admin Authentication

Create `e2e/admin/fixtures/auth.ts`:
```typescript
import { test as base, Page } from '@playwright/test';

// Extend test with authenticated admin page
export const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ page }, use) => {
    // Option 1: Set mock session cookie
    await page.context().addCookies([
      {
        name: 'admin_session',
        value: 'test-admin-session',
        domain: 'localhost',
        path: '/',
      }
    ]);
    
    // Option 2: Use localStorage
    await page.goto('http://localhost:3002');
    await page.evaluate(() => {
      localStorage.setItem('admin_token', 'test-admin-token');
    });
    
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

---

## Step 6: Run All Admin Tests

```bash
# Run admin unit tests
pnpm --filter admin test

# Run admin E2E tests
pnpm exec playwright test e2e/admin/ --reporter=list
```

---

## Step 7: Fix Loop

For each failing test:
1. Read error message
2. Identify root cause:
   - Missing element? Add `data-testid` to component
   - Auth issue? Update auth fixture
   - Timing issue? Add proper waits
   - Wrong selector? Fix selector
   - App bug? Fix the app code
3. Apply fix
4. Re-run that specific test
5. Once fixed, run full admin suite

---

## Step 8: Final Verification

Run admin tests 3 times to ensure stability:

```bash
pnpm exec playwright test e2e/admin/ --reporter=list && \
pnpm exec playwright test e2e/admin/ --reporter=list && \
pnpm exec playwright test e2e/admin/ --reporter=list
```

---

## Step 9: Summary Report

After 100% pass, report:
- Total admin tests: X
- New tests created: X
- Tests fixed: X
- App bugs fixed: X
- Files modified: list

---

## Admin Panel Pages Reference

| Route | Page | Must Test |
|-------|------|-----------|
| `/login` | Login | Form, validation, auth flow |
| `/` | Dashboard | Stats, navigation |
| `/users` | Users | List, search, CRUD |
| `/organizations` | Organizations | List, details, CRUD |
| `/api-keys` | API Keys | List, create, revoke |
| `/audit-logs` | Audit Logs | List, filters, export |
| `/feature-flags` | Feature Flags | List, toggle, create |
| `/operations` | Operations | Status, actions |

---

## Begin Now

1. Start admin panel if not running
2. Run existing tests
3. Create missing E2E tests
4. Fix all failures
5. Loop until 100% pass

**DO NOT STOP UNTIL ALL ADMIN TESTS PASS.**

Go! 🚀
