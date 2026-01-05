# Phase 6.5 Complete: User API Keys

## Summary

Implemented a complete User API Key management system that enables users to generate personal API keys for connecting external applications (Zapier, custom scripts, mobile apps) to their zigznote account.

## What Was Built

### 1. Database Layer
- **Prisma Schema**: Added `UserApiKey` model with fields for secure key storage, scopes, usage tracking, and lifecycle management
- **Type Definitions**: Added `CreateUserApiKeyInput` and `UpdateUserApiKeyInput` interfaces
- **Repository**: Created `userApiKeyRepository.ts` with CRUD operations and usage tracking

### 2. API Key Service (`apps/api/src/services/apiKeyService.ts`)
- Secure 256-bit key generation using `crypto.randomBytes`
- bcrypt hashing (10 rounds) for secure storage
- Key validation with prefix-based lookup optimization
- Granular scope system with 7 scopes:
  - `meetings:read` / `meetings:write`
  - `transcripts:read` / `transcripts:write`
  - `action-items:read` / `action-items:write`
  - `webhooks:manage`
- Key lifecycle management (create, list, revoke, update)
- Max 10 keys per user limit

### 3. Authentication Middleware (`apps/api/src/middleware/apiKeyAuth.ts`)
- `optionalApiKeyAuth`: Accepts either session auth OR API key
- `requireApiKeyAuth`: Requires API key (no session fallback)
- `requireScope(scope)`: Enforces required scope for API key auth

### 4. API Routes (`apps/api/src/routes/apiKeys.ts`)
- `GET /api/v1/api-keys` - List user's API keys
- `GET /api/v1/api-keys/scopes` - List available scopes
- `POST /api/v1/api-keys` - Create new key (returns full key ONCE)
- `PATCH /api/v1/api-keys/:keyId` - Update key name/scopes
- `DELETE /api/v1/api-keys/:keyId` - Revoke key

### 5. Meeting Routes Updated
- Added dual auth support (session + API key)
- Added scope requirements to all meeting routes

### 6. Frontend (`apps/web`)
- API client methods in `lib/api.ts`
- API Keys settings page at `/settings/api-keys`
- Create key modal with scope selection
- Key list with usage stats
- Copy-to-clipboard for new keys
- Revoke functionality

### 7. Tests
- Updated database mock with `userApiKeyRepository`
- `apiKeyService.test.ts` - 18 tests for service logic
- `apiKeyAuth.test.ts` - 11 tests for middleware

## Key Design Decisions

1. **Key Format**: `sk_live_` prefix + 256-bit base64url encoded random bytes
2. **Storage**: Only bcrypt hash stored, never the actual key
3. **Prefix Lookup**: Store first 12 chars to optimize validation (narrow candidates before bcrypt compare)
4. **Scope Enforcement**: Only checked for API key auth, session auth bypasses scope checks
5. **One-Time Display**: Full key only returned on creation

## Test Coverage

```
Test Suites: 2 passed (apiKeyService, apiKeyAuth)
Tests: 29 passed
```

## Files Added/Modified

### Added
- `packages/database/src/repositories/userApiKeyRepository.ts`
- `apps/api/src/services/apiKeyService.ts`
- `apps/api/src/services/apiKeyService.test.ts`
- `apps/api/src/middleware/apiKeyAuth.ts`
- `apps/api/src/middleware/apiKeyAuth.test.ts`
- `apps/api/src/routes/apiKeys.ts`
- `apps/web/app/settings/api-keys/page.tsx`

### Modified
- `packages/database/prisma/schema.prisma` (UserApiKey model)
- `packages/database/src/types/index.ts` (input types)
- `packages/database/src/repositories/index.ts` (exports)
- `packages/database/src/index.ts` (exports)
- `apps/api/src/services/index.ts` (exports)
- `apps/api/src/middleware/index.ts` (exports)
- `apps/api/src/routes/api.ts` (register apiKeysRouter)
- `apps/api/src/routes/meetings.ts` (dual auth + scopes)
- `apps/api/package.json` (bcryptjs dependency)
- `apps/api/tests/__mocks__/@zigznote/database.ts` (mock)
- `apps/web/lib/api.ts` (API key methods)
- `apps/web/app/settings/layout.tsx` (navigation)

## Commands to Verify

```bash
# Run API tests
pnpm --filter @zigznote/api test

# Run API key specific tests
pnpm --filter @zigznote/api test -- --testPathPattern="apiKey"

# Run web tests
pnpm --filter @zigznote/web test
```

## Notes for Next Phase

- Consider adding rate limiting per API key
- API key usage analytics dashboard could be added
- Webhook delivery could use API key auth for secure callbacks
- Consider adding key rotation functionality
