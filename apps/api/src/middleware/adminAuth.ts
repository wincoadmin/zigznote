/**
 * Admin authentication middleware
 * Separate from user auth - uses email/password + 2FA
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { UnauthorizedError, ForbiddenError } from '@zigznote/shared';
import { adminAuthService, type AdminAuthContext } from '../services/adminAuthService';
import { logger } from '../utils/logger';

/**
 * Extended request with admin auth info
 */
export interface AdminAuthenticatedRequest extends Request {
  adminAuth?: AdminAuthContext;
}

/**
 * Admin role hierarchy
 */
const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  support: 2,
  admin: 3,
  super_admin: 4,
};

/**
 * Extract admin token from request
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check cookie
  const cookieToken = req.cookies?.admin_token;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * Requires admin authentication
 */
export const requireAdminAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('Admin authentication required');
    }

    const authContext = await adminAuthService.validateSession(token);

    if (!authContext) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    (req as AdminAuthenticatedRequest).adminAuth = authContext;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Requires specific admin role or higher
 */
export const requireAdminRole = (requiredRole: string): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const adminReq = req as AdminAuthenticatedRequest;

    if (!adminReq.adminAuth) {
      return next(new UnauthorizedError('Admin authentication required'));
    }

    const userLevel = ROLE_HIERARCHY[adminReq.adminAuth.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      logger.warn(
        {
          adminId: adminReq.adminAuth.adminId,
          role: adminReq.adminAuth.role,
          requiredRole,
          action: `${req.method} ${req.path}`,
        },
        'Admin role insufficient'
      );
      return next(new ForbiddenError(`Requires ${requiredRole} role or higher`));
    }

    next();
  };
};

/**
 * Convenience middleware for common role requirements
 */
export const requireViewer: RequestHandler = requireAdminRole('viewer');
export const requireSupport: RequestHandler = requireAdminRole('support');
export const requireAdminRoleLevel: RequestHandler = requireAdminRole('admin');
export const requireSuperAdmin: RequestHandler = requireAdminRole('super_admin');

/**
 * Log admin action for audit trail
 */
export const logAdminAction = (action: string): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const adminReq = req as AdminAuthenticatedRequest;

    if (adminReq.adminAuth) {
      logger.info(
        {
          adminId: adminReq.adminAuth.adminId,
          adminEmail: adminReq.adminAuth.email,
          action,
          method: req.method,
          path: req.path,
          ip: req.ip,
        },
        'Admin action performed'
      );
    }

    next();
  };
};

/**
 * IP allowlist check (optional security layer)
 */
export const checkIpAllowlist: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const allowedIps = process.env.ADMIN_ALLOWED_IPS;

  if (!allowedIps) {
    // No allowlist configured, allow all
    return next();
  }

  const clientIp = req.ip || req.socket.remoteAddress || '';
  const allowedList = allowedIps.split(',').map((ip) => ip.trim());

  if (!allowedList.includes(clientIp) && !allowedList.includes('*')) {
    logger.warn({ ip: clientIp }, 'Admin access from unauthorized IP');
    return next(new ForbiddenError('Access denied from this IP address'));
  }

  next();
};
