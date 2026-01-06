/**
 * @ownership
 * @domain Authentication
 * @description NextAuth JWT authentication middleware for protecting API routes
 * @single-responsibility YES - handles authentication and authorization
 * @last-reviewed 2026-01-06
 */

import { Request, Response, NextFunction } from 'express';
import { jwtVerify, JWTPayload } from 'jose';
import { UnauthorizedError, ForbiddenError } from '@zigznote/shared';
import { prisma } from '@zigznote/database';
import { logger } from '../utils/logger';

/**
 * NextAuth JWT payload structure
 */
interface NextAuthJWT extends JWTPayload {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  avatarUrl?: string;
  role: string;
  organizationId: string;
  twoFactorEnabled: boolean;
  twoFactorVerified?: boolean;
  emailVerified?: Date | null;
}

/**
 * Extended request with auth info
 */
export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    organizationId: string;
    email: string;
    role: string;
  };
}

/**
 * Get NextAuth secret for JWT verification
 */
function getNextAuthSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Extract JWT from Authorization header
 * Format: Authorization: Bearer <token>
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;

  // Skip API keys (handled by apiKeyAuth middleware)
  if (token.startsWith('sk_live_')) return null;

  return token;
}

/**
 * Verify NextAuth JWT token
 */
async function verifyNextAuthToken(token: string): Promise<NextAuthJWT> {
  try {
    const secret = getNextAuthSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    return payload as NextAuthJWT;
  } catch (error) {
    logger.debug({ error }, 'JWT verification failed');
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Requires authentication - will reject requests without valid NextAuth JWT
 */
export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;

    // Check if already authenticated (via API key middleware)
    if (authReq.auth) {
      return next();
    }

    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    // Verify the NextAuth JWT
    const payload = await verifyNextAuthToken(token);

    if (!payload.id || !payload.email) {
      throw new UnauthorizedError('Invalid token payload');
    }

    // Check if 2FA was verified (if 2FA is enabled)
    if (payload.twoFactorEnabled && !payload.twoFactorVerified) {
      throw new UnauthorizedError('Two-factor authentication required');
    }

    // Get user from database to ensure they exist and are active
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        organizationId: true,
        role: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedError('User account has been deactivated');
    }

    authReq.auth = {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication - attaches user info if present but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;

    // Check if already authenticated (via API key middleware)
    if (authReq.auth) {
      return next();
    }

    const token = extractToken(req);

    if (token) {
      try {
        const payload = await verifyNextAuthToken(token);

        if (payload.id && payload.email) {
          const user = await prisma.user.findUnique({
            where: { id: payload.id },
            select: {
              id: true,
              email: true,
              organizationId: true,
              role: true,
              isActive: true,
              deletedAt: true,
            },
          });

          if (user && user.isActive && !user.deletedAt) {
            authReq.auth = {
              userId: user.id,
              organizationId: user.organizationId,
              email: user.email,
              role: user.role,
            };
          }
        }
      } catch (error) {
        // Don't fail on optional auth errors - just continue without auth
        logger.debug({ error }, 'Optional auth failed, continuing without auth');
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors - just continue without auth
    logger.warn({ error }, 'Optional auth failed, continuing without auth');
    next();
  }
};

/**
 * Requires admin role
 */
export const requireAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (authReq.auth.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }

  next();
};

/**
 * Ensures user can only access their organization's resources
 */
export const requireOrgAccess = (orgIdParam = 'organizationId') => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.auth) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const requestedOrgId = req.params[orgIdParam] || req.body[orgIdParam] || req.query[orgIdParam];

    if (requestedOrgId && requestedOrgId !== authReq.auth.organizationId) {
      return next(new ForbiddenError('Access denied to this organization'));
    }

    next();
  };
};
