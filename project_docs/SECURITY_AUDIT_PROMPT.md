# Comprehensive Security Audit Mission

## Objective
Perform a thorough security audit of the entire codebase. Identify vulnerabilities, fix critical issues, and generate a detailed security report. **DO NOT STOP until all critical and high-severity issues are resolved.**

---

## Rules
1. **Do NOT ask for permission** - just fix and continue
2. **Do NOT stop** until all critical/high issues are fixed
3. **Fix issues** as you find them
4. **Document everything** in SECURITY_AUDIT_REPORT.md
5. Medium/Low issues can be documented for later

---

## Security Audit Checklist

### 1. Authorization (IDOR) - CRITICAL 🔴

Check EVERY API route for proper authorization. Users must only access their own data.

```bash
# Find all route files
find apps/api/src/routes -name "*.ts" -type f
```

For each route, verify:

**Pattern to FIND (Vulnerable):**
```typescript
// BAD - No ownership check
const meeting = await prisma.meeting.findUnique({
  where: { id: req.params.id }
});
```

**Pattern to ENFORCE (Secure):**
```typescript
// GOOD - Ownership verified
const meeting = await prisma.meeting.findUnique({
  where: { 
    id: req.params.id,
    organizationId: req.auth.organizationId  // Must match user's org
  }
});
if (!meeting) {
  throw new NotFoundError('Meeting not found');
}
```

**Check these routes specifically:**
- [ ] GET /meetings/:id
- [ ] PUT /meetings/:id
- [ ] DELETE /meetings/:id
- [ ] GET /meetings/:id/transcript
- [ ] GET /meetings/:id/summary
- [ ] GET /meetings/:id/chat
- [ ] POST /meetings/:id/chat
- [ ] GET /conversations/:id
- [ ] GET /api-keys/:id
- [ ] DELETE /api-keys/:id
- [ ] GET /webhooks/:id
- [ ] PUT /webhooks/:id
- [ ] DELETE /webhooks/:id
- [ ] Any route with :id parameter

**Fix Pattern:**
```typescript
// Add to every data-access route
const { organizationId, userId } = req.auth;

// For org-level resources
where: { id, organizationId }

// For user-level resources  
where: { id, userId }
```

---

### 2. Authentication Checks - CRITICAL 🔴

Verify all routes have proper authentication middleware:

```bash
# Search for routes without auth middleware
grep -r "router\.\(get\|post\|put\|delete\|patch\)" apps/api/src/routes/ | grep -v "auth\|public\|health\|webhook"
```

**Every route must have one of:**
- `requireAuth` middleware
- `requireApiKey` middleware
- `requireAdminAuth` middleware
- Explicitly marked as public (health, webhooks with signature verification)

---

### 3. Input Validation - HIGH 🟠

Check all routes validate input with Zod:

```typescript
// REQUIRED for all routes with body/params/query
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';

const schema = z.object({
  title: z.string().min(1).max(200),
  // ... all fields validated
});

router.post('/', validateRequest({ body: schema }), handler);
```

**Search for unvalidated routes:**
```bash
grep -r "req\.body\|req\.params\|req\.query" apps/api/src/routes/ | grep -v "validated\|schema\|zod"
```

---

### 4. SQL Injection Prevention - HIGH 🟠

Verify NO raw SQL queries without parameterization:

```bash
# Find potential raw queries
grep -r "\$queryRaw\|\$executeRaw\|\.query(" apps/api/src/ packages/database/src/
```

**If found, ensure parameterized:**
```typescript
// BAD
prisma.$queryRaw`SELECT * FROM users WHERE name = ${userInput}`

// GOOD  
prisma.$queryRaw`SELECT * FROM users WHERE name = ${Prisma.sql`${userInput}`}`
```

---

### 5. Secrets Exposure - HIGH 🟠

**Check for hardcoded secrets:**
```bash
grep -rE "(password|secret|apikey|api_key|token|credential).*['\"][a-zA-Z0-9]{10,}['\"]" --include="*.ts" --include="*.tsx" .
grep -rE "sk_live_|sk_test_|pk_live_|pk_test_" --include="*.ts" --include="*.tsx" .
grep -rE "AKIA[0-9A-Z]{16}" . # AWS keys
```

**Check for secrets in logs:**
```bash
grep -r "console\.log\|logger\." apps/api/src/ | grep -iE "password|secret|token|key|auth"
```

**Check error responses don't expose internals:**
```typescript
// BAD - Exposes internal error
res.status(500).json({ error: err.message, stack: err.stack });

// GOOD - Generic message
res.status(500).json({ error: 'Internal server error', requestId: req.id });
```

---

### 6. API Key Security - HIGH 🟠

Verify API keys are:
- [ ] Hashed before storage (never plain text)
- [ ] Never returned in API responses after creation
- [ ] Never logged
- [ ] Have expiration dates
- [ ] Have scoped permissions

```bash
# Check API key handling
cat apps/api/src/services/apiKeyService.ts
cat packages/database/src/repositories/userApiKeyRepository.ts
```

---

### 7. File Upload Security - HIGH 🟠

Check file upload handlers:

```bash
cat apps/api/src/routes/audio.ts
cat apps/api/src/services/audioProcessingService.ts
```

**Verify:**
- [ ] File type validation (not just extension, check magic bytes)
- [ ] File size limits enforced
- [ ] Filenames sanitized (no path traversal: `../../../etc/passwd`)
- [ ] Files stored outside web root
- [ ] Virus scanning (optional but recommended)

```typescript
// Path traversal prevention
import path from 'path';

const safeName = path.basename(filename); // Strips directory components
const safePath = path.join(uploadDir, safeName);

// Verify still in upload directory
if (!safePath.startsWith(uploadDir)) {
  throw new Error('Invalid file path');
}
```

---

### 8. XSS Prevention - MEDIUM 🟡

Check for dangerous patterns:

```bash
# Search for dangerouslySetInnerHTML
grep -r "dangerouslySetInnerHTML" apps/web/

# If found, ensure content is sanitized
```

**If HTML rendering needed:**
```typescript
import DOMPurify from 'dompurify';

const sanitized = DOMPurify.sanitize(userContent);
<div dangerouslySetInnerHTML={{ __html: sanitized }} />
```

---

### 9. CORS Configuration - MEDIUM 🟡

Check CORS settings:

```bash
cat apps/api/src/app.ts | grep -A 10 "cors"
```

**Verify:**
```typescript
// BAD - Allows all origins
app.use(cors({ origin: '*' }));

// GOOD - Specific origins
app.use(cors({
  origin: [
    'https://yourdomain.com',
    'https://app.yourdomain.com',
    process.env.NODE_ENV === 'development' && 'http://localhost:3000'
  ].filter(Boolean),
  credentials: true,
}));
```

---

### 10. Rate Limiting - MEDIUM 🟡

Verify rate limiting exists:

```bash
cat apps/api/src/middleware/rateLimit.ts
```

**Check these are rate limited:**
- [ ] Login/auth endpoints (strict - 5-10/min)
- [ ] Password reset (strict - 3-5/hour)
- [ ] API key creation (strict - 10/hour)
- [ ] File uploads (medium - 10/min)
- [ ] Search endpoints (medium - 30/min)
- [ ] General API (standard - 100/min)

---

### 11. Security Headers - MEDIUM 🟡

Check Helmet.js configuration:

```bash
cat apps/api/src/app.ts | grep -A 20 "helmet"
```

**Required headers:**
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Tighten if possible
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.clerk.dev", "https://api.stripe.com"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

---

### 12. Dependency Vulnerabilities - MEDIUM 🟡

```bash
# Run npm audit
pnpm audit

# Check for critical/high vulnerabilities
pnpm audit --audit-level=high
```

**Fix vulnerabilities:**
```bash
# Auto-fix what's possible
pnpm audit fix

# For breaking changes, update manually
pnpm update <package-name>
```

---

### 13. Webhook Security - MEDIUM 🟡

Verify all webhook endpoints validate signatures:

```bash
cat apps/api/src/routes/webhooks/clerk.ts
cat apps/api/src/routes/webhooks/recall.ts
cat apps/api/src/billing/routes.ts | grep -A 20 "webhook"
```

**Pattern required:**
```typescript
// Stripe webhook verification
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

// Clerk webhook verification
const { verified } = await verifyWebhook(req);
if (!verified) throw new UnauthorizedError('Invalid signature');
```

---

### 14. Session Security - LOW 🟢

Verify session/token handling:
- [ ] Tokens expire appropriately
- [ ] Refresh tokens rotated on use
- [ ] Sessions invalidated on logout
- [ ] Sessions invalidated on password change

---

### 15. Admin Security - LOW 🟢

Check admin routes:

```bash
cat apps/api/src/routes/admin/index.ts
cat apps/api/src/middleware/adminAuth.ts
```

**Verify:**
- [ ] Separate auth from user auth
- [ ] IP allowlisting (optional)
- [ ] Audit logging for all actions
- [ ] 2FA (recommended)

---

## Fix Priority Order

| Priority | Action | Severity |
|----------|--------|----------|
| 1 | Fix all IDOR/authorization issues | 🔴 CRITICAL |
| 2 | Add missing auth middleware | 🔴 CRITICAL |
| 3 | Fix secrets exposure | 🟠 HIGH |
| 4 | Add input validation | 🟠 HIGH |
| 5 | Fix file upload security | 🟠 HIGH |
| 6 | Fix dependency vulnerabilities | 🟠 HIGH |
| 7 | Verify webhook signatures | 🟡 MEDIUM |
| 8 | Check CORS config | 🟡 MEDIUM |
| 9 | Verify rate limiting | 🟡 MEDIUM |
| 10 | Check security headers | 🟡 MEDIUM |

---

## Generate Security Report

Create `SECURITY_AUDIT_REPORT.md` with:

```markdown
# Security Audit Report

**Date:** [DATE]
**Auditor:** Claude Code
**Codebase:** zigznote

## Executive Summary
- Critical Issues Found: X (Fixed: X)
- High Issues Found: X (Fixed: X)
- Medium Issues Found: X (Fixed: X)
- Low Issues Found: X (Documented: X)

## Critical Findings

### 1. [Issue Title]
- **Location:** file:line
- **Description:** What was wrong
- **Risk:** What could happen
- **Fix Applied:** What was changed
- **Status:** ✅ Fixed / ⚠️ Needs Manual Review

## High Findings
[Same format]

## Medium Findings
[Same format]

## Low Findings
[Same format]

## Dependency Audit
- Total packages: X
- Vulnerabilities found: X
- Critical: X
- High: X
- Fixed: X

## Recommendations
1. [Future improvements]
2. [Additional security measures]

## Files Modified
- path/to/file.ts - [what changed]
- path/to/file.ts - [what changed]
```

---

## Verification Steps

After fixes, verify:

```bash
# 1. Re-run audit
pnpm audit

# 2. Test authorization manually
curl -X GET http://localhost:3001/api/v1/meetings/[other-users-meeting-id] \
  -H "Authorization: Bearer [your-token]"
# Should return 404, not the meeting

# 3. Run security tests
pnpm test -- tests/security

# 4. Check no secrets in git
git log -p | grep -iE "sk_live|password.*=.*['\"]"
```

---

## Definition of Done

- [ ] All critical issues fixed
- [ ] All high issues fixed
- [ ] Medium issues fixed or documented
- [ ] pnpm audit shows 0 critical/high
- [ ] SECURITY_AUDIT_REPORT.md created
- [ ] Security tests pass

---

## Step 16: Create/Update Security Tests

Security tests live in `apps/api/src/__tests__/security/`. Create or update these test files:

### 16.1 IDOR Prevention Tests (`idor.test.ts`)

```typescript
/**
 * @security IDOR (Insecure Direct Object Reference) Prevention Tests
 * @description Verifies that users cannot access resources from other organizations
 */

import { prisma } from '@zigznote/database';

// Mock prisma for unit tests
jest.mock('@zigznote/database', () => ({
  prisma: {
    meeting: { findFirst: jest.fn(), findUnique: jest.fn() },
    // ... other models
  },
}));

// Test data for two different organizations
const ORG_A = { id: 'org-a-uuid', name: 'Organization A' };
const ORG_B = { id: 'org-b-uuid', name: 'Organization B' };
const MEETING_ORG_A = { id: 'meeting-a', organizationId: ORG_A.id };
const MEETING_ORG_B = { id: 'meeting-b', organizationId: ORG_B.id };

describe('IDOR Prevention', () => {
  test('should return null when user tries to access other org meeting', async () => {
    const mockFindFirst = prisma.meeting.findFirst as jest.Mock;
    mockFindFirst.mockResolvedValue(null);

    const result = await prisma.meeting.findFirst({
      where: {
        id: MEETING_ORG_B.id,        // Org B's meeting
        organizationId: ORG_A.id,    // But user is in Org A
        deletedAt: null,
      },
    });

    expect(result).toBeNull();
  });

  test('should verify organizationId in all resource queries', async () => {
    const mockFindFirst = prisma.meeting.findFirst as jest.Mock;

    await prisma.meeting.findFirst({
      where: {
        id: 'some-meeting-id',
        organizationId: ORG_A.id,  // MUST include this
        deletedAt: null,
      },
    });

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_A.id,
        }),
      })
    );
  });
});
```

### 16.2 Authentication Boundary Tests (`auth.test.ts`)

```typescript
/**
 * @security Authentication Boundary Tests
 * @description Verifies that all protected routes require proper authentication
 */

import express from 'express';
import request from 'supertest';

describe('Authentication Boundaries', () => {
  test('protected endpoint should reject request without auth', async () => {
    const app = express();
    app.get('/api/v1/meetings', (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    }, (req, res) => res.json({ meetings: [] }));

    const response = await request(app).get('/api/v1/meetings');
    expect(response.status).toBe(401);
  });

  test('protected endpoint should accept valid auth', async () => {
    // ... test with valid token
  });

  test('admin endpoint should reject non-admin token', async () => {
    // ... test admin routes
  });
});
```

### 16.3 Run Security Tests

```bash
# Run all security tests
pnpm --filter @zigznote/api test -- --testPathPattern=security

# Run specific security test file
pnpm --filter @zigznote/api test -- --testPathPattern=idor
pnpm --filter @zigznote/api test -- --testPathPattern=auth

# Run with coverage
pnpm --filter @zigznote/api test -- --testPathPattern=security --coverage
```

### 16.4 Security Test Checklist

After creating tests, verify:

```
CRITICAL (Must Have Tests):
- [ ] IDOR: Users cannot access other org's meetings
- [ ] IDOR: Users cannot access other org's transcripts
- [ ] IDOR: Users cannot access other org's voice profiles
- [ ] IDOR: Users cannot access other org's webhooks
- [ ] IDOR: Users cannot access other user's API keys
- [ ] AUTH: All protected routes reject unauthenticated requests
- [ ] AUTH: Admin routes reject non-admin tokens

HIGH (Should Have Tests):
- [ ] API keys are hashed before storage
- [ ] Sensitive data not in error responses
- [ ] Input validation rejects malformed data
- [ ] File uploads reject invalid types

MEDIUM (Nice to Have Tests):
- [ ] Rate limiting triggers on excess requests
- [ ] CORS rejects disallowed origins
- [ ] Webhook signature verification works
```

---

## Step 17: Add Security Tests to CI/CD

Add to `.github/workflows/ci.yml`:

```yaml
security-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'

    - run: pnpm install
    - run: pnpm --filter @zigznote/api test -- --testPathPattern=security

    - name: Dependency Audit
      run: pnpm audit --audit-level=high
```

---

## Begin Now

1. Start with authorization (IDOR) checks - most critical
2. Work through checklist in priority order
3. Fix issues as you find them
4. Create/update security tests for each fix
5. Document everything
6. Generate final report

**DO NOT STOP until all critical and high severity issues are resolved.**

Go! 🔐
