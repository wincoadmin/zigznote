# Phase 2 Complete: Authentication & Calendar Integration

## Summary

Phase 2 implements the complete authentication and calendar integration infrastructure for zigznote. This includes Clerk-based authentication, Google Calendar OAuth flow, calendar sync background jobs, and protected API routes.

## What Was Built

### Authentication (Clerk)

1. **Auth Middleware** (`apps/api/src/middleware/auth.ts`)
   - `clerkAuthMiddleware` - Initializes Clerk for all routes
   - `requireAuth` - Requires valid Clerk session, creates user/org if needed
   - `optionalAuth` - Attaches user info if present, doesn't require
   - `requireAdmin` - Requires admin role
   - `requireOrgAccess` - Ensures user can only access their org's resources

2. **Auth Service** (`apps/api/src/services/authService.ts`)
   - Handles Clerk webhook events (user.*, organization.*, organizationMembership.*)
   - Creates/updates/deletes users and orgs based on Clerk webhooks
   - Uses Svix for webhook signature verification

3. **Clerk Webhook Route** (`apps/api/src/routes/webhooks/clerk.ts`)
   - POST /webhooks/clerk - Receives and verifies Clerk webhooks

### Calendar Integration (Google)

1. **Google Calendar Service** (`apps/api/src/services/googleCalendarService.ts`)
   - OAuth flow with authorization URL generation
   - Token storage with AES-256-GCM encryption
   - Automatic token refresh
   - Calendar event listing with pagination
   - Meeting link extraction (Zoom, Meet, Teams, Webex)
   - Calendar sync to create/update meetings

2. **Encryption Utility** (`apps/api/src/utils/encryption.ts`)
   - AES-256-GCM encryption with PBKDF2 key derivation
   - 100,000 iterations for key derivation
   - Secure token storage

3. **Calendar Routes** (`apps/api/src/routes/calendar.ts`)
   - GET /calendar/google/connect - Initiates OAuth
   - GET /calendar/google/callback - Handles OAuth callback
   - POST /calendar/sync - Manual sync trigger
   - GET /calendar/events - List calendar events
   - GET /calendar/connections - List connections
   - PATCH /calendar/connections/:id - Update settings
   - DELETE /calendar/connections/:id - Disconnect

4. **Calendar Sync Worker** (`apps/api/src/jobs/calendarSyncWorker.ts`)
   - BullMQ worker for processing sync jobs
   - Supports single, user, and all connection sync
   - Periodic sync scheduling (every 15 minutes)

### Database Updates

1. **Schema Changes** (`packages/database/prisma/schema.prisma`)
   - Added `clerkId` field to Organization model

2. **Calendar Repository** (`packages/database/src/repositories/calendarRepository.ts`)
   - CRUD for CalendarConnection entity
   - Find stale connections for periodic sync
   - Token update helpers

3. **Type Updates** (`packages/database/src/types/index.ts`)
   - Added `calendarEventId` to MeetingFilterOptions
   - Added `email`, `organizationId` to UpdateUserInput

### Protected Routes

- All meeting routes now require authentication via `requireAuth`
- Meeting controller updated to use authenticated request context
- Organization-scoped data access enforced

## Key Design Decisions

1. **Auth Flow**: Clerk SDK + webhooks for user sync, not JWT tokens
2. **Token Storage**: Encrypted with AES-256-GCM, not plain text
3. **Calendar Sync**: Background jobs with BullMQ, not synchronous
4. **Multi-tenant**: Organization-scoped via Clerk organizations

## Test Coverage

- Health tests: 4 passed
- Meeting tests: 14 passed (with mocked auth)
- Total: 18 tests passing

## Configuration Required

```env
# Clerk
CLERK_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/calendar/google/callback

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key
```

## Commands to Verify

```bash
# Build all packages
pnpm build

# Run tests
pnpm --filter @zigznote/api test

# Generate Prisma client
pnpm --filter @zigznote/database generate
```

## Files Created/Modified

### New Files
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/services/authService.ts`
- `apps/api/src/services/googleCalendarService.ts`
- `apps/api/src/routes/webhooks/clerk.ts`
- `apps/api/src/routes/calendar.ts`
- `apps/api/src/utils/encryption.ts`
- `apps/api/src/jobs/calendarSyncWorker.ts`
- `packages/database/src/repositories/calendarRepository.ts`

### Modified Files
- `apps/api/src/app.ts` - Added auth middleware, webhook routes
- `apps/api/src/config/index.ts` - Added Clerk and Google config
- `apps/api/src/middleware/index.ts` - Exported auth functions
- `apps/api/src/routes/api.ts` - Added calendar routes
- `apps/api/src/routes/meetings.ts` - Added requireAuth
- `apps/api/src/controllers/meetingController.ts` - Use auth context
- `apps/api/src/jobs/index.ts` - Export calendar sync worker
- `packages/database/prisma/schema.prisma` - Added clerkId to Organization
- `packages/database/src/repositories/index.ts` - Export calendar repo
- `packages/database/src/repositories/meetingRepository.ts` - calendarEventId filter
- `packages/database/src/repositories/organizationRepository.ts` - findByClerkId
- `packages/database/src/types/index.ts` - Updated filter/input types
- `packages/shared/src/queues/index.ts` - Updated CalendarSyncJobData

## Notes for Phase 3

- Clerk webhooks need to be configured in Clerk dashboard
- Google OAuth consent screen needs to be configured
- Calendar sync can be triggered via API or scheduled job
- Meeting link extraction supports Zoom, Meet, Teams, Webex

## Verification Checklist

- [x] Clerk middleware initializes correctly
- [x] requireAuth protects meeting routes
- [x] Google Calendar OAuth flow implemented
- [x] Calendar sync background job created
- [x] Token encryption working
- [x] All tests passing (18 tests)
- [x] Build succeeds
