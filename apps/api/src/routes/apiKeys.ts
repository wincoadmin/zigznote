/**
 * User API Key management routes
 * Requires session authentication (users manage their own keys)
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { z } from 'zod';
import { apiKeyService, API_KEY_SCOPES } from '../services/apiKeyService';
import {
  requireAuth,
  asyncHandler,
  validateRequest,
  type AuthenticatedRequest,
} from '../middleware';

export const apiKeysRouter: IRouter = Router();

// All routes require session auth (not API key auth)
apiKeysRouter.use(requireAuth);

// Validation schemas
const createKeySchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    scopes: z
      .array(z.enum(Object.keys(API_KEY_SCOPES) as [string, ...string[]]))
      .min(1),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  }),
};

const updateKeySchema = {
  params: z.object({
    keyId: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    scopes: z
      .array(z.enum(Object.keys(API_KEY_SCOPES) as [string, ...string[]]))
      .min(1)
      .optional(),
  }),
};

/**
 * GET /api/v1/api-keys
 * List all API keys for the authenticated user
 */
apiKeysRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const keys = await apiKeyService.listKeys(authReq.auth!.userId);

    res.json({
      success: true,
      data: keys,
    });
  })
);

/**
 * GET /api/v1/api-keys/scopes
 * List all available scopes with descriptions
 */
apiKeysRouter.get(
  '/scopes',
  asyncHandler(async (_req, res) => {
    const scopes = Object.entries(API_KEY_SCOPES).map(([key, description]) => ({
      scope: key,
      description,
    }));

    res.json({
      success: true,
      data: scopes,
    });
  })
);

/**
 * POST /api/v1/api-keys
 * Create a new API key
 * Returns the full key ONCE - user must save it
 */
apiKeysRouter.post(
  '/',
  validateRequest(createKeySchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { key, apiKey } = await apiKeyService.createKey({
      userId: authReq.auth!.userId,
      organizationId: authReq.auth!.organizationId,
      name: req.body.name,
      scopes: req.body.scopes,
      expiresInDays: req.body.expiresInDays,
    });

    res.status(201).json({
      success: true,
      data: {
        ...apiKey,
        key, // Full key - shown ONCE
      },
      message: 'API key created. Save this key now - it cannot be retrieved later.',
    });
  })
);

/**
 * PATCH /api/v1/api-keys/:keyId
 * Update an API key's name or scopes
 */
apiKeysRouter.patch(
  '/:keyId',
  validateRequest(updateKeySchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const keyId = req.params.keyId as string;
    const updated = await apiKeyService.updateKey(
      authReq.auth!.userId,
      keyId,
      req.body
    );

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * DELETE /api/v1/api-keys/:keyId
 * Revoke an API key
 */
apiKeysRouter.delete(
  '/:keyId',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const keyId = req.params.keyId as string;
    await apiKeyService.revokeKey(authReq.auth!.userId, keyId);

    res.json({
      success: true,
      message: 'API key revoked',
    });
  })
);
