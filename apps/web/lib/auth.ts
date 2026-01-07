/**
 * NextAuth.js Configuration (Server-side)
 * Handles authentication with credentials, OAuth, 2FA, and brute force protection
 * Note: This file uses Node.js-only modules (bcrypt, prisma) and should NOT be imported in middleware
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { prisma } from '@zigznote/database';
import { verifyPassword } from './password';
import { verifyTOTP, verifyBackupCode } from './two-factor';
import { recordLoginAttempt, checkBruteForce, clearFailedAttempts } from './rate-limit';
import { authConfig as baseAuthConfig } from './auth.config';

// Type augmentations are in types/next-auth.d.ts

/**
 * Get or create organization for new OAuth users
 */
async function getOrCreateOrganization(email: string) {
  // Try to find existing org by email domain
  const domain = email.split('@')[1];

  // Create a personal organization for the user
  const org = await prisma.organization.create({
    data: {
      name: `${email.split('@')[0]}'s Organization`,
    },
  });

  return org;
}

/**
 * NextAuth configuration
 */
export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as any,

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/sign-in',
    error: '/error',
    verifyRequest: '/verify-email',
    // Note: signUp is handled by custom /sign-up route, not NextAuth
  },

  providers: [
    // Credentials provider (email/password)
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: '2FA Code', type: 'text' },
        backupCode: { label: 'Backup Code', type: 'text' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const totpCode = credentials.totpCode as string | undefined;
        const backupCode = credentials.backupCode as string | undefined;

        // Get IP from request headers
        const ip = request?.headers?.get('x-forwarded-for')?.split(',')[0] ||
                   request?.headers?.get('x-real-ip') ||
                   'unknown';
        const userAgent = request?.headers?.get('user-agent') || 'unknown';

        // Check brute force protection
        const bruteForceCheck = await checkBruteForce(email, ip);
        if (bruteForceCheck.blocked) {
          await recordLoginAttempt(email, ip, userAgent, false, bruteForceCheck.reason);
          throw new Error(bruteForceCheck.reason);
        }

        // Find user
        const user = await prisma.user.findUnique({
          where: { email },
          include: { organization: true },
        });

        if (!user) {
          await recordLoginAttempt(email, ip, userAgent, false, 'User not found');
          throw new Error('Invalid email or password');
        }

        // Check if user is active
        if (!user.isActive) {
          await recordLoginAttempt(email, ip, userAgent, false, 'Account inactive');
          throw new Error('Your account has been deactivated. Please contact support.');
        }

        // Check if account is locked
        if (user.isLocked && user.lockUntil && user.lockUntil > new Date()) {
          const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
          await recordLoginAttempt(email, ip, userAgent, false, 'Account locked');
          throw new Error(`Account locked. Try again in ${minutesLeft} minutes.`);
        }

        // Check if email is verified
        if (!user.emailVerified) {
          await recordLoginAttempt(email, ip, userAgent, false, 'Email not verified');
          throw new Error('Please verify your email before signing in.');
        }

        // Verify password
        if (!user.password) {
          await recordLoginAttempt(email, ip, userAgent, false, 'No password set');
          throw new Error('Please use OAuth to sign in or reset your password.');
        }

        const isValidPassword = await verifyPassword(password, user.password);
        if (!isValidPassword) {
          // Increment failed attempts
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: { increment: 1 },
              lastFailedLogin: new Date(),
              // Lock account after 5 failed attempts
              isLocked: user.failedLoginAttempts >= 4,
              lockUntil: user.failedLoginAttempts >= 4
                ? new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
                : null,
            },
          });
          await recordLoginAttempt(email, ip, userAgent, false, 'Invalid password');
          throw new Error('Invalid email or password');
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled) {
          if (!totpCode && !backupCode) {
            // Return partial auth - client should prompt for 2FA
            throw new Error('2FA_REQUIRED');
          }

          let twoFactorValid = false;

          if (totpCode && user.twoFactorSecret) {
            twoFactorValid = verifyTOTP(totpCode, user.twoFactorSecret);
          } else if (backupCode) {
            const result = await verifyBackupCode(user.id, backupCode);
            twoFactorValid = result.valid;
          }

          if (!twoFactorValid) {
            await recordLoginAttempt(email, ip, userAgent, false, 'Invalid 2FA code');
            throw new Error('Invalid two-factor authentication code');
          }
        }

        // Clear failed attempts on successful login
        await clearFailedAttempts(user.id);

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            lastLoginIp: ip,
          },
        });

        // Record successful login
        await recordLoginAttempt(email, ip, userAgent, true);

        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
          avatarUrl: user.avatarUrl,
          role: user.role,
          organizationId: user.organizationId,
          twoFactorEnabled: user.twoFactorEnabled,
          emailVerified: user.emailVerified,
        };
      },
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // GitHub OAuth
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // Microsoft OAuth
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth sign-ins, ensure user has an organization
      if (account?.provider !== 'credentials' && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          // New OAuth user - create organization and user
          const org = await getOrCreateOrganization(user.email);

          await prisma.user.create({
            data: {
              id: user.id,
              email: user.email,
              name: user.name,
              firstName: profile?.given_name as string || user.name?.split(' ')[0],
              lastName: profile?.family_name as string || user.name?.split(' ').slice(1).join(' '),
              avatarUrl: user.image,
              organizationId: org.id,
              emailVerified: new Date(), // OAuth users are verified
              role: 'admin', // First user is admin
            },
          });
        } else if (!existingUser.emailVerified) {
          // Verify email for existing users signing in via OAuth
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date() },
          });
        }
      }
      return true;
    },

    async jwt({ token, user, account, trigger, session }) {
      // Initial sign-in - add user data to token
      if (user) {
        token.id = user.id;
        token.email = user.email!;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.name = user.name;
        token.avatarUrl = user.avatarUrl;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.twoFactorEnabled = user.twoFactorEnabled;
        token.twoFactorVerified = !user.twoFactorEnabled; // Already verified for credentials
        token.emailVerified = user.emailVerified;
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        // Update token with new session data
        if (session.twoFactorVerified !== undefined) {
          token.twoFactorVerified = session.twoFactorVerified;
        }
        if (session.firstName !== undefined) token.firstName = session.firstName;
        if (session.lastName !== undefined) token.lastName = session.lastName;
        if (session.name !== undefined) token.name = session.name;
        if (session.avatarUrl !== undefined) token.avatarUrl = session.avatarUrl;
      }

      // For OAuth users, fetch organization data if missing
      if (!token.organizationId && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
          token.firstName = dbUser.firstName;
          token.lastName = dbUser.lastName;
          token.avatarUrl = dbUser.avatarUrl;
          token.twoFactorEnabled = dbUser.twoFactorEnabled;
          token.twoFactorVerified = true; // OAuth doesn't require 2FA for now
        }
      }

      return token;
    },

    async session({ session, token }) {
      // Add custom fields to session
      session.user.id = token.id;
      session.user.email = token.email;
      session.user.firstName = token.firstName;
      session.user.lastName = token.lastName;
      session.user.name = token.name;
      session.user.avatarUrl = token.avatarUrl;
      session.user.role = token.role;
      session.user.organizationId = token.organizationId;
      session.user.twoFactorEnabled = token.twoFactorEnabled;
      session.user.emailVerified = token.emailVerified ?? null;

      // Check if 2FA verification is pending
      if (token.twoFactorEnabled && !token.twoFactorVerified) {
        session.requiresTwoFactor = true;
      }

      return session;
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      // Log sign-in events
      console.log(`User ${user.email} signed in via ${account?.provider}`);
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
