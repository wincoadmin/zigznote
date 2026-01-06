/**
 * NextAuth.js type augmentations
 * Extends the default User, Session, and JWT types with custom fields
 */

import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User extends DefaultUser {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
    role: string;
    organizationId: string;
    twoFactorEnabled: boolean;
    emailVerified?: Date | null;
  }

  interface Session extends DefaultSession {
    user: User;
    requiresTwoFactor?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
    role: string;
    organizationId: string;
    twoFactorEnabled: boolean;
    twoFactorVerified?: boolean;
    emailVerified?: Date | null;
  }
}
