/**
 * Middleware for API key authentication
 * Supports both session auth (Clerk) and API key auth
 * Includes brute force protection (Phase 8.95)
 */

import { Request, Response, NextFunction } from 'express';
import { apiKeyService, type ApiKeyScope, type ValidatedApiKey } from '../services/apiKeyService';
import { UnauthorizedError, TooManyRequestsError } from '@zigznote/shared';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from './auth';
import { createErrorResponse, ErrorCodes } from '../utils/errorResponse';

// Extend AuthenticatedRequest to include API key info
export interface ApiKeyAuthenticatedRequest extends AuthenticatedRequest {
  apiKey?: ValidatedApiKey;
  authType?: 'session' | 'apiKey';
}

// Phase 8.95: Brute force protection
// In-memory store for failed attempts (use Redis in production for multi-instance)
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();

const LOCKOUT_THRESHOLD = 10; // Failed attempts before lockout
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minute window
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of failedAttempts.entries()) {
    if (now - value.firstAttempt > LOCKOUT_WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Check if IP is locked out due to too many failed attempts
 */
function checkBruteForce(ip: string, keyPrefix: string): void {
  const lockoutKey = `${ip}:${keyPrefix.slice(0, 8)}`;
  const attempts = failedAttempts.get(lockoutKey);

  if (attempts && attempts.count >= LOCKOUT_THRESHOLD) {
    const timeSinceFirst = Date.now() - attempts.firstAttempt;
    if (timeSinceFirst < LOCKOUT_WINDOW_MS) {
      const remainingSeconds = Math.ceil((LOCKOUT_WINDOW_MS - timeSinceFirst) / 1000);
      throw new TooManyRequestsError(
        `Too many failed API key attempts. Try again in ${remainingSeconds} seconds.`
      );
    }
    // Window expired, reset
    failedAttempts.delete(lockoutKey);
  }
}

/**
 * Record a failed API key validation attempt
 */
function recordFailedAttempt(ip: string, keyPrefix: string): void {
  const lockoutKey = `${ip}:${keyPrefix.slice(0, 8)}`;
  const attempts = failedAttempts.get(lockoutKey);

  if (attempts) {
    attempts.count++;
  } else {
    failedAttempts.set(lockoutKey, { count: 1, firstAttempt: Date.now() });
  }

  // Log security event if reaching lockout
  const current = failedAttempts.get(lockoutKey)!;
  if (current.count === LOCKOUT_THRESHOLD) {
    logger.warn(
      { ip, keyPrefix: keyPrefix.slice(0, 8), attempts: current.count },
      'API key brute force lockout triggered'
    );
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const firstIp = forwarded.split(',')[0];
    return firstIp?.trim() || 'unknown';
  }
  return req.ip || 'unknown';
}

/**
 * Extracts API key from Authorization header
 * Format: Authorization: Bearer sk_live_xxxxx
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer') return null;
  if (!token?.startsWith('sk_live_')) return null;

  return token;
}

/**
 * Middleware that accepts either session auth OR API key
 * Use this for routes that support both auth methods
 * Should be placed BEFORE requireAuth
 * Includes brute force protection (Phase 8.95)
 */
export const optionalApiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = extractApiKey(req);

  if (apiKey) {
    const ip = getClientIp(req);

    try {
      // Phase 8.95: Check if IP is locked out
      checkBruteForce(ip, apiKey);

      const validated = await apiKeyService.validateKey(apiKey);
      const authReq = req as ApiKeyAuthenticatedRequest;
      authReq.apiKey = validated;
      authReq.authType = 'apiKey';
      // Set auth for downstream compatibility with existing middleware
      authReq.auth = {
        userId: validated.userId,
        organizationId: validated.organizationId,
        email: '', // Not applicable for API key auth
        role: 'member', // API keys have member-level access
      };
      next();
    } catch (error) {
      // Phase 8.95: Handle brute force error with 429 response
      if (error instanceof TooManyRequestsError) {
        res.status(429).json(
          createErrorResponse(ErrorCodes.RATE_LIMIT_EXCEEDED, error.message)
        );
        return;
      }

      // Record failed attempt for invalid keys
      if (error instanceof UnauthorizedError) {
        recordFailedAttempt(ip, apiKey);
      }

      next(error);
    }
  } else {
    // No API key - continue to session auth middleware
    next();
  }
};

/**
 * Middleware that REQUIRES API key auth (no session fallback)
 * Use this for programmatic-only endpoints
 * Includes brute force protection (Phase 8.95)
 */
export const requireApiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return next(new UnauthorizedError('API key required'));
  }

  const ip = getClientIp(req);

  try {
    // Phase 8.95: Check if IP is locked out
    checkBruteForce(ip, apiKey);

    const validated = await apiKeyService.validateKey(apiKey);
    const authReq = req as ApiKeyAuthenticatedRequest;
    authReq.apiKey = validated;
    authReq.authType = 'apiKey';
    authReq.auth = {
      userId: validated.userId,
      organizationId: validated.organizationId,
      email: '',
      role: 'member',
    };
    next();
  } catch (error) {
    // Phase 8.95: Handle brute force error with 429 response
    if (error instanceof TooManyRequestsError) {
      res.status(429).json(
        createErrorResponse(ErrorCodes.RATE_LIMIT_EXCEEDED, error.message)
      );
      return;
    }

    // Record failed attempt for invalid keys
    if (error instanceof UnauthorizedError) {
      recordFailedAttempt(ip, apiKey);
    }

    next(error);
  }
};

/**
 * Middleware factory that requires a specific scope
 * Usage: requireScope('meetings:read')
 */
export const requireScope = (scope: ApiKeyScope) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as ApiKeyAuthenticatedRequest;

    // Only check scope for API key auth
    if (authReq.authType !== 'apiKey' || !authReq.apiKey) {
      return next(); // Session auth, skip scope check
    }

    try {
      apiKeyService.requireScope(authReq.apiKey, scope);
      next();
    } catch (error) {
      next(error);
    }
  };
};
