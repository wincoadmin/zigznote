# Phase 11: NextAuth.js Authentication Implementation

## Mission
Replace Clerk with a complete NextAuth.js authentication system. Build all UI/UX to Clerk-quality standards. **DO NOT STOP until authentication is fully working end-to-end.**

---

## Rules
1. **Do NOT ask for permission** - just build and continue
2. **Do NOT stop** until all auth flows work
3. **Match or exceed Clerk quality** in UI/UX
4. **Follow zigznote branding** - emerald green (#10b981) theme
5. Test each feature as you build it

---

## Step 1: Remove Clerk

```bash
# Uninstall Clerk packages
cd apps/web
pnpm remove @clerk/nextjs @clerk/themes

# Remove Clerk from API if present
cd ../api
pnpm remove @clerk/clerk-sdk-node @clerk/backend

# Search for remaining Clerk imports
grep -r "@clerk" apps/
```

Delete or update any files still importing from @clerk.

---

## Step 2: Install NextAuth.js & Dependencies

```bash
cd apps/web

# Core auth
pnpm add next-auth@beta @auth/prisma-adapter

# Password hashing (Argon2 is more secure than bcrypt)
pnpm add argon2

# Email
pnpm add @react-email/components resend

# 2FA
pnpm add otplib qrcode
pnpm add -D @types/qrcode

# Rate limiting (choose one)
pnpm add @upstash/ratelimit @upstash/redis
# OR for local: pnpm add rate-limiter-flexible
```

---

## Step 3: Update Prisma Schema

Add these models to `packages/database/prisma/schema.prisma`:

```prisma
model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  emailVerified         DateTime?
  emailVerificationToken String?
  password              String?
  firstName             String?
  lastName              String?
  avatarUrl             String?
  
  // Security
  twoFactorEnabled      Boolean   @default(false)
  twoFactorSecret       String?
  backupCodes           String[]
  
  // Account status
  isActive              Boolean   @default(true)
  isLocked              Boolean   @default(false)
  lockUntil             DateTime?
  failedLoginAttempts   Int       @default(0)
  lastFailedLogin       DateTime?
  lastLoginAt           DateTime?
  lastLoginIp           String?
  
  // Password reset
  passwordResetToken    String?
  passwordResetExpires  DateTime?
  passwordChangedAt     DateTime?
  
  // NextAuth relations
  accounts              Account[]
  sessions              Session[]
  loginHistory          LoginHistory[]
  
  // Keep existing relations
  organizationId        String?
  organization          Organization? @relation(fields: [organizationId], references: [id])
  // ... keep all other existing relations
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  userAgent    String?
  ipAddress    String?
  isValid      Boolean  @default(true)
  createdAt    DateTime @default(now())
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model LoginHistory {
  id        String   @id @default(uuid())
  userId    String
  ipAddress String
  userAgent String
  location  String?
  success   Boolean
  reason    String?
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Run migration:
```bash
cd packages/database
pnpm prisma migrate dev --name add_nextauth_models
```

---

## Step 4: Create Auth Configuration

Create `apps/web/lib/auth.ts` with:
- NextAuth configuration
- Prisma adapter
- Credentials provider (email/password)
- OAuth providers (Google, GitHub, Microsoft)
- JWT callbacks
- Session callbacks
- Brute force protection
- 2FA verification

---

## Step 5: Create Auth API Routes

Create these files:
- `apps/web/app/api/auth/[...nextauth]/route.ts` - NextAuth handler
- `apps/web/app/api/auth/register/route.ts` - User registration
- `apps/web/app/api/auth/verify-email/route.ts` - Email verification
- `apps/web/app/api/auth/forgot-password/route.ts` - Password reset request
- `apps/web/app/api/auth/reset-password/route.ts` - Password reset
- `apps/web/app/api/auth/2fa/setup/route.ts` - 2FA setup/verify/disable

---

## Step 6: Create Utility Libraries

Create these utility files:
- `apps/web/lib/password.ts` - Argon2 hashing, password validation
- `apps/web/lib/rate-limit.ts` - Rate limiting for auth endpoints
- `apps/web/lib/two-factor.ts` - TOTP generation/verification
- `apps/web/lib/email.ts` - Email sending service

---

## Step 7: Create Email Templates

Create `apps/web/lib/email-templates/` with:
- `base.tsx` - Base email layout
- `welcome.tsx` - Welcome email
- `verification.tsx` - Email verification
- `password-reset.tsx` - Password reset
- `password-changed.tsx` - Password changed confirmation
- `new-login.tsx` - New login notification
- `two-factor.tsx` - 2FA enabled/disabled notification
- `index.tsx` - Export all templates

All emails should:
- Match zigznote branding (emerald green)
- Be mobile responsive
- Include footer with links

---

## Step 8: Create Auth UI Pages

Create these pages with beautiful UI matching zigznote branding:

### `apps/web/app/(auth)/layout.tsx`
- Gradient background
- Centered card layout

### `apps/web/app/(auth)/sign-in/page.tsx`
- OAuth buttons (Google, GitHub, Microsoft)
- Email/password form
- 2FA input (conditional)
- Forgot password link
- Sign up link
- Error handling
- Loading states

### `apps/web/app/(auth)/sign-up/page.tsx`
- OAuth buttons
- Name, email, password form
- Password strength indicator
- Terms/Privacy agreement
- Success state with "check email" message

### `apps/web/app/(auth)/forgot-password/page.tsx`
- Email input
- Success state
- Back to sign in link

### `apps/web/app/(auth)/reset-password/page.tsx`
- Token validation
- New password input
- Password strength indicator
- Success redirect to sign in

### `apps/web/app/(auth)/verify-email/page.tsx`
- Token validation
- Success/error states
- Resend option

### `apps/web/app/(auth)/error/page.tsx`
- Error display
- Back to sign in button

---

## Step 9: Create Settings Pages

### `apps/web/app/settings/profile/page.tsx`
- First name, last name
- Email (with change flow)
- Avatar upload
- Save changes

### `apps/web/app/settings/security/page.tsx`
- Change password
- 2FA setup/disable
- Active sessions list
- Sign out all sessions

### `apps/web/app/settings/security/two-factor/page.tsx`
- QR code display
- Verification input
- Backup codes display (once only)

### `apps/web/app/settings/security/sessions/page.tsx`
- List all active sessions
- Device info, IP, last active
- Revoke individual sessions
- Revoke all sessions

---

## Step 10: Create Icons Component

Create `apps/web/components/ui/icons.tsx` with:
- Google icon
- GitHub icon
- Microsoft icon
- Spinner icon
- Check icon
- Other needed icons

---

## Step 11: Create Middleware

Create `apps/web/middleware.ts`:
- Protect authenticated routes
- Redirect logged-in users from auth pages
- Allow public routes
- Allow API routes

---

## Step 12: Update Layout

Update `apps/web/app/layout.tsx`:
- Remove ClerkProvider
- Add SessionProvider from next-auth/react
- Keep existing providers

---

## Step 13: Update Components Using Auth

Search and replace Clerk hooks with NextAuth:

| Clerk | NextAuth |
|-------|----------|
| `useUser()` | `useSession()` |
| `useAuth()` | `useSession()` |
| `useClerk()` | `signIn()`, `signOut()` |
| `<SignedIn>` | Check `session` exists |
| `<SignedOut>` | Check `!session` |
| `<UserButton>` | Custom component |
| `currentUser()` | `auth()` server-side |

Update:
- Header/navigation component
- Dashboard layout
- Any component using Clerk

---

## Step 14: Create UserButton Component

Create `apps/web/components/auth/UserButton.tsx`:
- User avatar
- Dropdown menu
- Profile link
- Settings link
- Sign out button

---

## Step 15: Update Environment Variables

Create `.env.example` and `.env.local`:
```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Email
RESEND_API_KEY=

# Rate Limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## Step 16: Test Everything

Test each flow:
1. Sign up with email → Verify email → Sign in
2. Sign up with Google OAuth
3. Sign up with GitHub OAuth
4. Forgot password → Reset password
5. Enable 2FA → Sign in with 2FA
6. Use backup code
7. Disable 2FA
8. Change password
9. Update profile
10. View/revoke sessions
11. Sign out

---

## Step 17: Verify Security

Check:
- [ ] Rate limiting blocks after 5 failed attempts
- [ ] Account locks after too many failures
- [ ] Password meets strength requirements
- [ ] Tokens expire properly
- [ ] Sessions invalidate on password change
- [ ] CSRF protection works
- [ ] No sensitive data in logs

---

## UI/UX Requirements

All auth pages must have:
- [ ] Emerald green (#10b981) primary color
- [ ] Clean, modern design
- [ ] Mobile responsive
- [ ] Loading spinners during async operations
- [ ] Clear error messages
- [ ] Success states with appropriate feedback
- [ ] Smooth transitions
- [ ] Accessible (keyboard navigation, screen readers)

---

## Definition of Done

- [ ] All Clerk code removed
- [ ] Sign up with email works
- [ ] Sign up with OAuth works (Google, GitHub, Microsoft)
- [ ] Email verification works
- [ ] Sign in with email/password works
- [ ] Sign in with OAuth works
- [ ] Forgot/reset password works
- [ ] 2FA setup and verification works
- [ ] Profile management works
- [ ] Session management works
- [ ] Protected routes work
- [ ] UI matches zigznote branding
- [ ] All security features active
- [ ] All emails send correctly

---

## Begin Now

1. Remove Clerk
2. Install NextAuth packages
3. Update Prisma schema
4. Create auth configuration
5. Create API routes
6. Create UI pages
7. Update existing components
8. Test everything

**DO NOT STOP until authentication is complete and working.**

Go! 🔐
