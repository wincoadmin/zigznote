/**
 * @ownership
 * @domain Authentication
 * @description Clerk authentication middleware for protecting API routes
 * @single-responsibility YES — handles authentication and authorization
 * @last-reviewed 2026-01-04
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { clerkClient, getAuth, clerkMiddleware } from '@clerk/express';
import { UnauthorizedError, ForbiddenError } from '@zigznote/shared';
import { userRepository, organizationRepository } from '@zigznote/database';
import { logger } from '../utils/logger';

/**
 * Extended request with auth info
 */
export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    clerkUserId: string;
    organizationId: string;
    email: string;
    role: string;
  };
}

/**
 * Clerk middleware instance - call this once to initialize
 */
export const clerkAuthMiddleware: RequestHandler = clerkMiddleware();

/**
 * Requires authentication - will reject requests without valid Clerk session
 */
export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const auth = getAuth(req);

    if (!auth?.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    // Get user from database by Clerk ID
    const user = await userRepository.findByClerkId(auth.userId);

    if (!user) {
      // User exists in Clerk but not in our DB - this happens before webhook sync
      // Try to fetch from Clerk and create
      const clerkUser = await clerkClient.users.getUser(auth.userId);

      if (!clerkUser) {
        throw new UnauthorizedError('User not found');
      }

      // For new users, we need an organization
      // Check if they have org membership in Clerk
      const orgMemberships = await clerkClient.users.getOrganizationMembershipList({
        userId: auth.userId,
      });

      if (orgMemberships.data.length === 0) {
        throw new ForbiddenError('User must belong to an organization');
      }

      // Use first org (for MVP - later allow switching)
      const firstMembership = orgMemberships.data[0];
      const clerkOrgId = firstMembership?.organization?.id;
      const clerkOrgName = firstMembership?.organization?.name || 'Unnamed Organization';

      if (!clerkOrgId) {
        throw new ForbiddenError('Invalid organization membership');
      }

      // Find or create organization
      let org = await organizationRepository.findByClerkId(clerkOrgId);
      if (!org) {
        org = await organizationRepository.create({
          name: clerkOrgName,
          clerkId: clerkOrgId,
        });
        logger.info({ orgId: org.id, clerkOrgId }, 'Created organization from Clerk');
      }

      // Create user
      const fullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
      const newUser = await userRepository.create({
        organizationId: org.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        name: fullName || undefined,
        clerkId: auth.userId,
        avatarUrl: clerkUser.imageUrl || undefined,
        role: 'member',
      });

      logger.info({ userId: newUser.id, clerkUserId: auth.userId }, 'Created user from Clerk');

      authReq.auth = {
        userId: newUser.id,
        clerkUserId: auth.userId,
        organizationId: org.id,
        email: newUser.email,
        role: newUser.role,
      };
    } else {
      if (user.deletedAt) {
        throw new UnauthorizedError('User account has been deactivated');
      }

      authReq.auth = {
        userId: user.id,
        clerkUserId: auth.userId,
        organizationId: user.organizationId,
        email: user.email,
        role: user.role,
      };
    }

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
    const auth = getAuth(req);

    if (auth?.userId) {
      const user = await userRepository.findByClerkId(auth.userId);

      if (user && !user.deletedAt) {
        authReq.auth = {
          userId: user.id,
          clerkUserId: auth.userId,
          organizationId: user.organizationId,
          email: user.email,
          role: user.role,
        };
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
