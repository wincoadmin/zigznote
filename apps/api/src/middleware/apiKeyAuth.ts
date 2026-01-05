/**
 * Middleware for API key authentication
 * Supports both session auth (Clerk) and API key auth
 */

import { Request, Response, NextFunction } from 'express';
import { apiKeyService, type ApiKeyScope, type ValidatedApiKey } from '../services/apiKeyService';
import { UnauthorizedError } from '@zigznote/shared';
import type { AuthenticatedRequest } from './auth';

// Extend AuthenticatedRequest to include API key info
export interface ApiKeyAuthenticatedRequest extends AuthenticatedRequest {
  apiKey?: ValidatedApiKey;
  authType?: 'session' | 'apiKey';
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
 */
export const optionalApiKeyAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = extractApiKey(req);

  if (apiKey) {
    try {
      const validated = await apiKeyService.validateKey(apiKey);
      const authReq = req as ApiKeyAuthenticatedRequest;
      authReq.apiKey = validated;
      authReq.authType = 'apiKey';
      // Set auth for downstream compatibility with existing middleware
      authReq.auth = {
        userId: validated.userId,
        clerkUserId: '', // Not applicable for API key auth
        organizationId: validated.organizationId,
        email: '', // Not applicable for API key auth
        role: 'member', // API keys have member-level access
      };
      next();
    } catch (error) {
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
 */
export const requireApiKeyAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return next(new UnauthorizedError('API key required'));
  }

  try {
    const validated = await apiKeyService.validateKey(apiKey);
    const authReq = req as ApiKeyAuthenticatedRequest;
    authReq.apiKey = validated;
    authReq.authType = 'apiKey';
    authReq.auth = {
      userId: validated.userId,
      clerkUserId: '',
      organizationId: validated.organizationId,
      email: '',
      role: 'member',
    };
    next();
  } catch (error) {
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
