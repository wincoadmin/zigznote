# Phase 11: NextAuth.js Authentication System

## Overview

Replace Clerk with a fully self-hosted NextAuth.js (Auth.js) authentication system. Build all UI/UX components to match or exceed Clerk's quality. Zero vendor lock-in, zero ongoing costs, full data ownership.

**Goal:** Clerk-quality authentication with NextAuth.js

---

## Features to Implement

### Core Authentication
- [x] Email/Password authentication
- [x] OAuth providers (Google, GitHub, Microsoft)
- [x] Magic link (passwordless) login
- [x] Session management with JWT + Database sessions
- [x] Refresh token rotation
- [x] Remember me functionality

### User Management
- [x] User registration with email verification
- [x] Password reset flow
- [x] Email change with verification
- [x] Account deletion (GDPR)
- [x] User profile management
- [x] Avatar upload

### Security
- [x] Two-factor authentication (2FA/MFA)
- [x] Brute force protection
- [x] Rate limiting on auth endpoints
- [x] CSRF protection
- [x] Secure password hashing (Argon2)
- [x] Account lockout after failed attempts
- [x] Suspicious login detection
- [x] Session invalidation on password change

### UI/UX Pages
- [x] Sign-in page (beautiful, branded)
- [x] Sign-up page (beautiful, branded)
- [x] Forgot password page
- [x] Reset password page
- [x] Verify email page
- [x] Two-factor setup page
- [x] Two-factor verify page
- [x] User profile page
- [x] Security settings page
- [x] Active sessions page

### Email Templates
- [x] Welcome email
- [x] Email verification
- [x] Password reset
- [x] Password changed confirmation
- [x] New login detected
- [x] Two-factor enabled/disabled
- [x] Account deletion confirmation

---

## Technical Specifications

### 11.1 Package Installation

```bash
# Core packages
pnpm add next-auth@beta @auth/prisma-adapter

# Password hashing
pnpm add argon2

# Email
pnpm add @react-email/components resend

# 2FA
pnpm add otplib qrcode @types/qrcode

# Rate limiting
pnpm add @upstash/ratelimit @upstash/redis
# OR for local rate limiting:
pnpm add rate-limiter-flexible

# Validation
pnpm add zod
```

---

### 11.2 Prisma Schema Updates

```prisma
// Add to packages/database/prisma/schema.prisma

model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  emailVerified         DateTime?
  emailVerificationToken String?
  password              String?   // Null for OAuth-only users
  firstName             String?
  lastName              String?
  avatarUrl             String?
  
  // Security
  twoFactorEnabled      Boolean   @default(false)
  twoFactorSecret       String?
  backupCodes           String[]  // Encrypted backup codes
  
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
  
  // Relationships
  accounts              Account[]
  sessions              Session[]
  loginHistory          LoginHistory[]
  
  // Existing relationships
  organizationId        String?
  organization          Organization? @relation(fields: [organizationId], references: [id])
  meetings              Meeting[]
  // ... other existing relations
  
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
  reason    String?  // "password", "oauth", "magic_link", "2fa_failed", etc.
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

### 11.3 Auth Configuration

Create `apps/web/lib/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import MicrosoftEntra from 'next-auth/providers/microsoft-entra-id';
import { prisma } from '@zigznote/database';
import { verifyPassword, hashPassword } from './password';
import { sendVerificationEmail, sendWelcomeEmail } from './email';
import { checkRateLimit, recordFailedAttempt, resetFailedAttempts } from './rate-limit';
import { verifyTOTP } from './two-factor';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totpCode: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/sign-in',
    signUp: '/sign-up',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/onboarding',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    MicrosoftEntra({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: 'common',
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: '2FA Code', type: 'text' },
      },
      async authorize(credentials, request) {
        try {
          const { email, password, totpCode } = loginSchema.parse(credentials);
          
          // Get client IP for rate limiting
          const ip = request.headers.get('x-forwarded-for') || 'unknown';
          
          // Check rate limit
          const rateLimitResult = await checkRateLimit(ip, email);
          if (!rateLimitResult.success) {
            throw new Error('Too many login attempts. Please try again later.');
          }
          
          // Find user
          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
          });
          
          if (!user || !user.password) {
            await recordFailedAttempt(ip, email);
            throw new Error('Invalid email or password');
          }
          
          // Check if account is locked
          if (user.isLocked && user.lockUntil && user.lockUntil > new Date()) {
            throw new Error('Account is temporarily locked. Please try again later.');
          }
          
          // Verify password
          const isValid = await verifyPassword(password, user.password);
          if (!isValid) {
            await recordFailedAttempt(ip, email);
            
            // Increment failed attempts
            const attempts = user.failedLoginAttempts + 1;
            const lockAccount = attempts >= 5;
            
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: attempts,
                lastFailedLogin: new Date(),
                isLocked: lockAccount,
                lockUntil: lockAccount ? new Date(Date.now() + 15 * 60 * 1000) : null, // 15 min
              },
            });
            
            throw new Error('Invalid email or password');
          }
          
          // Check email verification
          if (!user.emailVerified) {
            throw new Error('Please verify your email before signing in');
          }
          
          // Check 2FA
          if (user.twoFactorEnabled) {
            if (!totpCode) {
              throw new Error('2FA_REQUIRED');
            }
            
            const isValidTOTP = verifyTOTP(totpCode, user.twoFactorSecret!);
            if (!isValidTOTP) {
              // Check backup codes
              const isValidBackup = await checkBackupCode(user.id, totpCode);
              if (!isValidBackup) {
                throw new Error('Invalid 2FA code');
              }
            }
          }
          
          // Reset failed attempts on successful login
          await resetFailedAttempts(user.id);
          
          // Record login
          await prisma.loginHistory.create({
            data: {
              userId: user.id,
              ipAddress: ip,
              userAgent: request.headers.get('user-agent') || 'unknown',
              success: true,
              reason: 'password',
            },
          });
          
          // Update last login
          await prisma.user.update({
            where: { id: user.id },
            data: {
              lastLoginAt: new Date(),
              lastLoginIp: ip,
            },
          });
          
          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
            image: user.avatarUrl,
          };
        } catch (error) {
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
      }
      
      // Handle session updates
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.picture = session.image;
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        
        // Fetch fresh user data
        const user = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            organizationId: true,
            twoFactorEnabled: true,
          },
        });
        
        if (user) {
          session.user.firstName = user.firstName;
          session.user.lastName = user.lastName;
          session.user.organizationId = user.organizationId;
          session.user.twoFactorEnabled = user.twoFactorEnabled;
        }
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // For OAuth, check if user exists or create
      if (account?.provider !== 'credentials') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email!.toLowerCase() },
        });
        
        if (!existingUser) {
          // Create new user from OAuth
          await prisma.user.create({
            data: {
              email: user.email!.toLowerCase(),
              firstName: profile?.given_name || user.name?.split(' ')[0],
              lastName: profile?.family_name || user.name?.split(' ').slice(1).join(' '),
              avatarUrl: user.image,
              emailVerified: new Date(), // OAuth emails are pre-verified
            },
          });
          
          // Send welcome email
          await sendWelcomeEmail(user.email!, user.name || 'there');
        }
      }
      
      return true;
    },
  },
  events: {
    async signIn({ user, account }) {
      console.log(`User signed in: ${user.email} via ${account?.provider}`);
    },
    async signOut({ token }) {
      console.log(`User signed out: ${token.email}`);
    },
  },
});
```

---

### 11.4 Auth API Routes

Create `apps/web/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

Create `apps/web/app/api/auth/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@zigznote/database';
import { hashPassword } from '@/lib/password';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import crypto from 'crypto';

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Rate limit
    const rateLimitResult = await checkRateLimit(ip, 'register');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }
    
    const body = await request.json();
    const validatedData = registerSchema.parse(body);
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    });
    
    if (existingUser) {
      // Don't reveal if user exists - security best practice
      return NextResponse.json(
        { message: 'If this email is available, you will receive a verification email.' },
        { status: 200 }
      );
    }
    
    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email.toLowerCase(),
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        emailVerificationToken: verificationToken,
      },
    });
    
    // Create verification token in NextAuth table too
    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token: verificationToken,
        expires: verificationExpires,
      },
    });
    
    // Send verification email
    await sendVerificationEmail(user.email, user.firstName || 'there', verificationToken);
    
    return NextResponse.json(
      { message: 'Registration successful. Please check your email to verify your account.' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
```

Create `apps/web/app/api/auth/verify-email/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@zigznote/database';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }
    
    // Find token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });
    
    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Invalid or expired verification link' },
        { status: 400 }
      );
    }
    
    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.json(
        { error: 'Verification link has expired. Please request a new one.' },
        { status: 400 }
      );
    }
    
    // Update user
    const user = await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
      },
    });
    
    // Delete token
    await prisma.verificationToken.delete({ where: { token } });
    
    // Send welcome email
    await sendWelcomeEmail(user.email, user.firstName || 'there');
    
    return NextResponse.json(
      { message: 'Email verified successfully. You can now sign in.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
```

Create `apps/web/app/api/auth/forgot-password/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@zigznote/database';
import { sendPasswordResetEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Strict rate limit for password reset
    const rateLimitResult = await checkRateLimit(ip, 'password-reset', 3, '1h');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please try again later.' },
        { status: 429 }
      );
    }
    
    const { email } = await request.json();
    
    // Always return success to prevent email enumeration
    const successMessage = 'If an account exists with this email, you will receive a password reset link.';
    
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (!user || !user.password) {
      // User doesn't exist or is OAuth-only, but don't reveal this
      return NextResponse.json({ message: successMessage }, { status: 200 });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });
    
    // Send email
    await sendPasswordResetEmail(user.email, user.firstName || 'there', resetToken);
    
    return NextResponse.json({ message: successMessage }, { status: 200 });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
```

Create `apps/web/app/api/auth/reset-password/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@zigznote/database';
import { hashPassword } from '@/lib/password';
import { sendPasswordChangedEmail } from '@/lib/email';
import { z } from 'zod';

const resetSchema = z.object({
  token: z.string(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = resetSchema.parse(body);
    
    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      );
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(password);
    
    // Update user and invalidate all sessions
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        isLocked: false,
        lockUntil: null,
      },
    });
    
    // Invalidate all sessions
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { isValid: false },
    });
    
    // Send confirmation email
    await sendPasswordChangedEmail(user.email, user.firstName || 'there');
    
    return NextResponse.json(
      { message: 'Password reset successful. You can now sign in with your new password.' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
```

---

### 11.5 Two-Factor Authentication

Create `apps/web/lib/two-factor.ts`:

```typescript
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '@zigznote/database';

// Configure TOTP
authenticator.options = {
  digits: 6,
  step: 30,
  window: 1,
};

export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTOTP(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}

export async function generateQRCode(email: string, secret: string): Promise<string> {
  const otpauthUrl = authenticator.keyuri(email, 'zigznote', secret);
  return QRCode.toDataURL(otpauthUrl);
}

export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

export async function checkBackupCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { backupCodes: true },
  });
  
  if (!user?.backupCodes) return false;
  
  const normalizedCode = code.replace('-', '').toUpperCase();
  const codeIndex = user.backupCodes.findIndex(
    (c) => c.replace('-', '').toUpperCase() === normalizedCode
  );
  
  if (codeIndex === -1) return false;
  
  // Remove used backup code
  const updatedCodes = [...user.backupCodes];
  updatedCodes.splice(codeIndex, 1);
  
  await prisma.user.update({
    where: { id: userId },
    data: { backupCodes: updatedCodes },
  });
  
  return true;
}
```

Create `apps/web/app/api/auth/2fa/setup/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import { generateTOTPSecret, generateQRCode, generateBackupCodes, verifyTOTP } from '@/lib/two-factor';

// GET - Generate 2FA secret and QR code
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    
    if (user?.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA is already enabled' },
        { status: 400 }
      );
    }
    
    const secret = generateTOTPSecret();
    const qrCode = await generateQRCode(user!.email, secret);
    
    // Store secret temporarily (not yet enabled)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: secret },
    });
    
    return NextResponse.json({
      secret,
      qrCode,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
}

// POST - Verify and enable 2FA
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { code } = await request.json();
    
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    
    if (!user?.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Please initiate 2FA setup first' },
        { status: 400 }
      );
    }
    
    // Verify code
    const isValid = verifyTOTP(code, user.twoFactorSecret);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }
    
    // Generate backup codes
    const backupCodes = generateBackupCodes();
    
    // Enable 2FA
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        backupCodes,
      },
    });
    
    return NextResponse.json({
      message: '2FA enabled successfully',
      backupCodes, // Only shown once!
    });
  } catch (error) {
    console.error('2FA enable error:', error);
    return NextResponse.json(
      { error: 'Failed to enable 2FA' },
      { status: 500 }
    );
  }
}

// DELETE - Disable 2FA
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { password } = await request.json();
    
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    
    if (!user?.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA is not enabled' },
        { status: 400 }
      );
    }
    
    // Verify password before disabling
    const { verifyPassword } = await import('@/lib/password');
    const isValid = await verifyPassword(password, user.password!);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 400 }
      );
    }
    
    // Disable 2FA
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
      },
    });
    
    return NextResponse.json({
      message: '2FA disabled successfully',
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
```

---

### 11.6 Password Utilities

Create `apps/web/lib/password.ts`:

```typescript
import argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;
  
  if (password.length >= 8) score += 1;
  else errors.push('Password must be at least 8 characters');
  
  if (password.length >= 12) score += 1;
  
  if (/[A-Z]/.test(password)) score += 1;
  else errors.push('Password must contain an uppercase letter');
  
  if (/[a-z]/.test(password)) score += 1;
  else errors.push('Password must contain a lowercase letter');
  
  if (/[0-9]/.test(password)) score += 1;
  else errors.push('Password must contain a number');
  
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  
  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(score, 5),
  };
}
```

---

### 11.7 Rate Limiting

Create `apps/web/lib/rate-limit.ts`:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { prisma } from '@zigznote/database';

// For production with Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Create rate limiters
const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 attempts per 15 minutes
  analytics: true,
  prefix: 'ratelimit:login',
});

const registerLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 registrations per hour
  analytics: true,
  prefix: 'ratelimit:register',
});

const passwordResetLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 reset requests per hour
  analytics: true,
  prefix: 'ratelimit:password-reset',
});

export async function checkRateLimit(
  ip: string,
  type: 'login' | 'register' | 'password-reset',
  identifier?: string
): Promise<{ success: boolean; remaining: number }> {
  const key = identifier ? `${ip}:${identifier}` : ip;
  
  let limiter;
  switch (type) {
    case 'login':
      limiter = loginLimiter;
      break;
    case 'register':
      limiter = registerLimiter;
      break;
    case 'password-reset':
      limiter = passwordResetLimiter;
      break;
  }
  
  const result = await limiter.limit(key);
  return {
    success: result.success,
    remaining: result.remaining,
  };
}

export async function recordFailedAttempt(ip: string, email: string): Promise<void> {
  // Additional tracking in database for security analysis
  await prisma.loginHistory.create({
    data: {
      userId: '', // Unknown user
      ipAddress: ip,
      userAgent: 'unknown',
      success: false,
      reason: `Failed login attempt for ${email}`,
    },
  }).catch(() => {}); // Don't fail if can't record
}

export async function resetFailedAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      isLocked: false,
      lockUntil: null,
    },
  });
}
```

---

### 11.8 Email Service

Create `apps/web/lib/email.ts`:

```typescript
import { Resend } from 'resend';
import {
  WelcomeEmail,
  VerificationEmail,
  PasswordResetEmail,
  PasswordChangedEmail,
  NewLoginEmail,
  TwoFactorEmail,
} from './email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'zigznote <noreply@zigznote.com>';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Welcome to zigznote! 🎉',
    react: WelcomeEmail({ name }),
  });
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const verifyUrl = `${BASE_URL}/auth/verify-email?token=${token}`;
  
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your email address',
    react: VerificationEmail({ name, verifyUrl }),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const resetUrl = `${BASE_URL}/auth/reset-password?token=${token}`;
  
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your password',
    react: PasswordResetEmail({ name, resetUrl }),
  });
}

export async function sendPasswordChangedEmail(email: string, name: string): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Your password has been changed',
    react: PasswordChangedEmail({ name }),
  });
}

export async function sendNewLoginEmail(
  email: string,
  name: string,
  device: string,
  location: string,
  time: Date
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'New sign-in to your account',
    react: NewLoginEmail({ name, device, location, time }),
  });
}

export async function sendTwoFactorEmail(
  email: string,
  name: string,
  action: 'enabled' | 'disabled'
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Two-factor authentication ${action}`,
    react: TwoFactorEmail({ name, action }),
  });
}
```

---

### 11.9 Email Templates

Create `apps/web/lib/email-templates/index.tsx`:

```typescript
export { WelcomeEmail } from './welcome';
export { VerificationEmail } from './verification';
export { PasswordResetEmail } from './password-reset';
export { PasswordChangedEmail } from './password-changed';
export { NewLoginEmail } from './new-login';
export { TwoFactorEmail } from './two-factor';
```

Create `apps/web/lib/email-templates/base.tsx`:

```typescript
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface BaseEmailProps {
  preview: string;
  children: React.ReactNode;
}

export function BaseEmail({ preview, children }: BaseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://zigznote.com/logo.png"
              width="120"
              height="36"
              alt="zigznote"
            />
          </Section>
          {children}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} zigznote. All rights reserved.
            </Text>
            <Text style={footerLinks}>
              <Link href="https://zigznote.com/terms" style={link}>Terms</Link>
              {' · '}
              <Link href="https://zigznote.com/privacy" style={link}>Privacy</Link>
              {' · '}
              <Link href="https://zigznote.com/help" style={link}>Help</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '8px',
};

const header = {
  padding: '32px 48px 0',
};

const footer = {
  padding: '32px 48px',
  borderTop: '1px solid #e6ebf1',
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '0 0 8px',
};

const footerLinks = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '0',
};

const link = {
  color: '#10b981',
  textDecoration: 'none',
};
```

Create `apps/web/lib/email-templates/welcome.tsx`:

```typescript
import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

interface WelcomeEmailProps {
  name: string;
}

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <BaseEmail preview="Welcome to zigznote - Your AI meeting assistant">
      <Section style={content}>
        <Text style={heading}>Welcome to zigznote! 🎉</Text>
        <Text style={paragraph}>Hi {name},</Text>
        <Text style={paragraph}>
          Thanks for signing up! We&apos;re excited to have you on board.
        </Text>
        <Text style={paragraph}>
          zigznote automatically joins your meetings, transcribes conversations,
          generates intelligent summaries, and extracts action items. Focus on
          the conversation, not the notes.
        </Text>
        <Text style={paragraph}>Here&apos;s how to get started:</Text>
        <Text style={listItem}>1. Connect your calendar</Text>
        <Text style={listItem}>2. Schedule or start a meeting</Text>
        <Text style={listItem}>3. Let zigznote do the rest!</Text>
        <Button style={button} href="https://zigznote.com/dashboard">
          Go to Dashboard
        </Button>
        <Text style={paragraph}>
          If you have any questions, our support team is here to help.
        </Text>
        <Text style={signature}>
          — The zigznote team
        </Text>
      </Section>
    </BaseEmail>
  );
}

const content = {
  padding: '32px 48px',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600',
  color: '#1f2937',
  margin: '0 0 24px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#4b5563',
  margin: '0 0 16px',
};

const listItem = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#4b5563',
  margin: '0 0 8px',
  paddingLeft: '8px',
};

const button = {
  backgroundColor: '#10b981',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
  margin: '24px 0',
};

const signature = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#4b5563',
  margin: '24px 0 0',
};
```

Create `apps/web/lib/email-templates/verification.tsx`:

```typescript
import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

interface VerificationEmailProps {
  name: string;
  verifyUrl: string;
}

export function VerificationEmail({ name, verifyUrl }: VerificationEmailProps) {
  return (
    <BaseEmail preview="Verify your email address">
      <Section style={content}>
        <Text style={heading}>Verify your email</Text>
        <Text style={paragraph}>Hi {name},</Text>
        <Text style={paragraph}>
          Thanks for signing up for zigznote! Please verify your email address
          by clicking the button below.
        </Text>
        <Button style={button} href={verifyUrl}>
          Verify Email Address
        </Button>
        <Text style={smallText}>
          This link will expire in 24 hours. If you didn&apos;t create an account,
          you can safely ignore this email.
        </Text>
      </Section>
    </BaseEmail>
  );
}

const content = { padding: '32px 48px' };
const heading = { fontSize: '24px', fontWeight: '600', color: '#1f2937', margin: '0 0 24px' };
const paragraph = { fontSize: '16px', lineHeight: '24px', color: '#4b5563', margin: '0 0 16px' };
const button = {
  backgroundColor: '#10b981',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
  margin: '24px 0',
};
const smallText = { fontSize: '14px', lineHeight: '20px', color: '#6b7280', margin: '16px 0 0' };
```

Create `apps/web/lib/email-templates/password-reset.tsx`:

```typescript
import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
}

export function PasswordResetEmail({ name, resetUrl }: PasswordResetEmailProps) {
  return (
    <BaseEmail preview="Reset your password">
      <Section style={content}>
        <Text style={heading}>Reset your password</Text>
        <Text style={paragraph}>Hi {name},</Text>
        <Text style={paragraph}>
          We received a request to reset your password. Click the button below
          to choose a new password.
        </Text>
        <Button style={button} href={resetUrl}>
          Reset Password
        </Button>
        <Text style={smallText}>
          This link will expire in 1 hour. If you didn&apos;t request a password
          reset, you can safely ignore this email.
        </Text>
      </Section>
    </BaseEmail>
  );
}

const content = { padding: '32px 48px' };
const heading = { fontSize: '24px', fontWeight: '600', color: '#1f2937', margin: '0 0 24px' };
const paragraph = { fontSize: '16px', lineHeight: '24px', color: '#4b5563', margin: '0 0 16px' };
const button = {
  backgroundColor: '#10b981',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
  margin: '24px 0',
};
const smallText = { fontSize: '14px', lineHeight: '20px', color: '#6b7280', margin: '16px 0 0' };
```

Create `apps/web/lib/email-templates/password-changed.tsx`:

```typescript
import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

interface PasswordChangedEmailProps {
  name: string;
}

export function PasswordChangedEmail({ name }: PasswordChangedEmailProps) {
  return (
    <BaseEmail preview="Your password has been changed">
      <Section style={content}>
        <Text style={heading}>Password changed</Text>
        <Text style={paragraph}>Hi {name},</Text>
        <Text style={paragraph}>
          Your password has been successfully changed. If you made this change,
          no further action is needed.
        </Text>
        <Text style={warningBox}>
          ⚠️ If you did not change your password, please contact our support
          team immediately at support@zigznote.com
        </Text>
      </Section>
    </BaseEmail>
  );
}

const content = { padding: '32px 48px' };
const heading = { fontSize: '24px', fontWeight: '600', color: '#1f2937', margin: '0 0 24px' };
const paragraph = { fontSize: '16px', lineHeight: '24px', color: '#4b5563', margin: '0 0 16px' };
const warningBox = {
  backgroundColor: '#fef3c7',
  border: '1px solid #f59e0b',
  borderRadius: '8px',
  padding: '16px',
  fontSize: '14px',
  lineHeight: '20px',
  color: '#92400e',
  margin: '24px 0 0',
};
```

Create remaining email templates similarly for `new-login.tsx` and `two-factor.tsx`.

---

### 11.10 UI Pages

#### Sign In Page

Create `apps/web/app/(auth)/sign-in/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/ui/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');
  
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    totpCode: '',
  });
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError('');

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        totpCode: formData.totpCode,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === '2FA_REQUIRED') {
          setShowTwoFactor(true);
        } else {
          setFormError(result.error);
        }
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (error) {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true);
    await signIn(provider, { callbackUrl });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-white p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">Z</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">zigznote</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-600 mt-1">Sign in to your account</p>
          </div>

          {/* Error Messages */}
          {(error || formError) && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                {error === 'OAuthAccountNotLinked'
                  ? 'This email is already associated with another sign-in method.'
                  : formError || 'Something went wrong. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn('google')}
              disabled={isLoading}
            >
              <Icons.google className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn('github')}
              disabled={isLoading}
            >
              <Icons.gitHub className="mr-2 h-4 w-4" />
              Continue with GitHub
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn('microsoft-entra-id')}
              disabled={isLoading}
            >
              <Icons.microsoft className="mr-2 h-4 w-4" />
              Continue with Microsoft
            </Button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or continue with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!showTwoFactor ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-emerald-600 hover:text-emerald-700"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="totpCode">Two-factor authentication code</Label>
                <Input
                  id="totpCode"
                  type="text"
                  placeholder="123456"
                  value={formData.totpCode}
                  onChange={(e) => setFormData({ ...formData, totpCode: e.target.value })}
                  required
                  disabled={isLoading}
                  autoComplete="one-time-code"
                  maxLength={6}
                />
                <p className="text-sm text-gray-500">
                  Enter the code from your authenticator app
                </p>
              </div>
            )}

            <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Sign up link */}
          <p className="text-center text-sm text-gray-600 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### Sign Up Page

Create `apps/web/app/(auth)/sign-up/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/ui/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validatePasswordStrength } from '@/lib/password';

export default function SignUpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, errors: [] as string[] });

  const handlePasswordChange = (password: string) => {
    setFormData({ ...formData, password });
    setPasswordStrength(validatePasswordStrength(password));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError('');

    // Validate password
    const validation = validatePasswordStrength(formData.password);
    if (!validation.isValid) {
      setFormError(validation.errors[0]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true);
    await signIn(provider, { callbackUrl: '/dashboard' });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-white p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.check className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
            <p className="text-gray-600 mb-6">
              We&apos;ve sent a verification link to <strong>{formData.email}</strong>
            </p>
            <Link href="/sign-in">
              <Button variant="outline" className="w-full">
                Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-white p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">Z</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">zigznote</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-600 mt-1">Start your free trial today</p>
          </div>

          {/* Error */}
          {formError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn('google')}
              disabled={isLoading}
            >
              <Icons.google className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn('github')}
              disabled={isLoading}
            >
              <Icons.gitHub className="mr-2 h-4 w-4" />
              Continue with GitHub
            </Button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or continue with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                disabled={isLoading}
              />
              {/* Password strength indicator */}
              {formData.password && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded ${
                          passwordStrength.score >= level
                            ? passwordStrength.score <= 2
                              ? 'bg-red-500'
                              : passwordStrength.score <= 3
                              ? 'bg-yellow-500'
                              : 'bg-emerald-500'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  {passwordStrength.errors.length > 0 && (
                    <p className="text-xs text-red-500">{passwordStrength.errors[0]}</p>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>

            <p className="text-xs text-center text-gray-500">
              By signing up, you agree to our{' '}
              <Link href="/terms" className="text-emerald-600 hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-emerald-600 hover:underline">
                Privacy Policy
              </Link>
            </p>
          </form>

          {/* Sign in link */}
          <p className="text-center text-sm text-gray-600 mt-6">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

### 11.11 Additional Pages

Create these additional pages following the same pattern:

| Page | File Path |
|------|-----------|
| Forgot Password | `apps/web/app/(auth)/forgot-password/page.tsx` |
| Reset Password | `apps/web/app/(auth)/reset-password/page.tsx` |
| Verify Email | `apps/web/app/(auth)/verify-email/page.tsx` |
| Auth Error | `apps/web/app/(auth)/error/page.tsx` |
| 2FA Setup | `apps/web/app/settings/security/two-factor/page.tsx` |
| Active Sessions | `apps/web/app/settings/security/sessions/page.tsx` |
| User Profile | `apps/web/app/settings/profile/page.tsx` |

---

### 11.12 Middleware

Create `apps/web/middleware.ts`:

```typescript
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const publicRoutes = [
  '/',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/error',
  '/terms',
  '/privacy',
  '/cookies',
  '/help',
];

const authRoutes = ['/sign-in', '/sign-up', '/forgot-password'];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  
  const isPublicRoute = publicRoutes.some(
    (route) => nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`)
  );
  const isAuthRoute = authRoutes.some((route) => nextUrl.pathname.startsWith(route));
  const isApiRoute = nextUrl.pathname.startsWith('/api');
  
  // Allow API routes
  if (isApiRoute) {
    return NextResponse.next();
  }
  
  // Redirect logged-in users away from auth pages
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }
  
  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // Require auth for all other routes
  if (!isLoggedIn) {
    const signInUrl = new URL('/sign-in', nextUrl);
    signInUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)'],
};
```

---

### 11.13 Environment Variables

```bash
# apps/web/.env.example

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here-generate-with-openssl-rand-base64-32

# OAuth Providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Email (Resend)
RESEND_API_KEY=

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Testing Checklist

- [ ] Sign up with email/password
- [ ] Email verification received and works
- [ ] Sign in with email/password
- [ ] Sign in with Google OAuth
- [ ] Sign in with GitHub OAuth
- [ ] Sign in with Microsoft OAuth
- [ ] Forgot password flow
- [ ] Reset password flow
- [ ] 2FA setup with authenticator app
- [ ] 2FA verification on login
- [ ] Backup codes work
- [ ] 2FA disable with password
- [ ] Session persistence
- [ ] Sign out
- [ ] Protected routes redirect to sign-in
- [ ] Rate limiting blocks brute force
- [ ] Account lockout after failed attempts
- [ ] Password strength validation
- [ ] All emails sent and formatted correctly

---

## Definition of Done

1. All authentication flows work end-to-end
2. UI matches zigznote branding (emerald green theme)
3. All security features implemented
4. All email templates created and working
5. Rate limiting and brute force protection active
6. 2FA fully functional
7. All tests pass
8. No Clerk dependencies remain

---

## Estimated Time

| Task | Time |
|------|------|
| Package setup & Prisma | 1 hour |
| Auth configuration | 2 hours |
| API routes | 3 hours |
| UI pages | 4 hours |
| Email templates | 2 hours |
| 2FA implementation | 2 hours |
| Testing & fixes | 2 hours |
| **Total** | **~16 hours** |

---

**This is Phase 11: Complete NextAuth.js Implementation**
