/**
 * Admin system API key routes
 * Manage third-party API keys (Deepgram, Anthropic, etc.)
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import {
  systemApiKeyService,
  ApiProviders,
  Environments,
} from '../../services/systemApiKeyService';
import {
  requireAdminAuth,
  requireAdminRoleLevel,
  type AdminAuthenticatedRequest,
} from '../../middleware/adminAuth';
import { asyncHandler, validateRequest } from '../../middleware';

export const apiKeysRouter: IRouter = Router();

// All routes require admin auth with at least admin role
apiKeysRouter.use(requireAdminAuth, requireAdminRoleLevel);

// Validation schemas
const listSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
    provider: z.string().optional(),
    environment: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
  }),
};

const createSchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    provider: z.string().min(1).max(50),
    environment: z.enum(['production', 'staging', 'development', 'test']).default('production'),
    key: z.string().min(1),
    expiresAt: z.string().datetime().optional(),
    rotationDays: z.number().int().positive().optional(),
  }),
};

const updateSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    rotationDays: z.number().int().positive().nullable().optional(),
  }),
};

const rotateSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    key: z.string().min(1),
  }),
};

/**
 * @route GET /api/admin/api-keys
 * @description List all system API keys
 */
apiKeysRouter.get(
  '/',
  validateRequest(listSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, provider, environment, isActive, search } =
      req.query as z.infer<typeof listSchema.query>;

    const result = await systemApiKeyService.listKeys(
      { page, limit },
      {
        provider,
        environment,
        isActive: isActive ? isActive === 'true' : undefined,
        search,
      }
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  })
);

/**
 * @route GET /api/admin/api-keys/providers
 * @description Get list of known providers
 */
apiKeysRouter.get(
  '/providers',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        providers: Object.values(ApiProviders),
        environments: Object.values(Environments),
      },
    });
  })
);

/**
 * @route GET /api/admin/api-keys/stats
 * @description Get API key statistics
 */
apiKeysRouter.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await systemApiKeyService.getKeyStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route GET /api/admin/api-keys/rotation-due
 * @description Get keys due for rotation
 */
apiKeysRouter.get(
  '/rotation-due',
  asyncHandler(async (_req: Request, res: Response) => {
    const keys = await systemApiKeyService.getKeysDueForRotation();

    res.json({
      success: true,
      data: keys,
    });
  })
);

/**
 * @route GET /api/admin/api-keys/expired
 * @description Get expired keys
 */
apiKeysRouter.get(
  '/expired',
  asyncHandler(async (_req: Request, res: Response) => {
    const keys = await systemApiKeyService.getExpiredKeys();

    res.json({
      success: true,
      data: keys,
    });
  })
);

/**
 * @route GET /api/admin/api-keys/:id
 * @description Get a single API key
 */
apiKeysRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id!;

    const key = await systemApiKeyService.getKey(id);
    if (!key) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: key,
    });
  })
);

/**
 * @route GET /api/admin/api-keys/:id/verify
 * @description Verify a key can be decrypted
 */
apiKeysRouter.get(
  '/:id/verify',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id!;

    const result = await systemApiKeyService.verifyKey(id);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route POST /api/admin/api-keys
 * @description Create a new API key
 */
apiKeysRouter.post(
  '/',
  validateRequest(createSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { name, provider, environment, key, expiresAt, rotationDays } =
      req.body as z.infer<typeof createSchema.body>;

    const created = await systemApiKeyService.createKey(
      {
        name,
        provider,
        environment,
        key,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        rotationDays,
      },
      adminReq.adminAuth!.adminId,
      {
        adminId: adminReq.adminAuth!.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
      }
    );

    res.status(201).json({
      success: true,
      data: created,
    });
  })
);

/**
 * @route PATCH /api/admin/api-keys/:id
 * @description Update an API key
 */
apiKeysRouter.patch(
  '/:id',
  validateRequest(updateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;
    const updates = req.body as z.infer<typeof updateSchema.body>;

    const updated = await systemApiKeyService.updateKey(
      id,
      {
        name: updates.name,
        isActive: updates.isActive,
        expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : (updates.expiresAt === null ? null : undefined),
        rotationDays: updates.rotationDays,
      },
      {
        adminId: adminReq.adminAuth!.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * @route POST /api/admin/api-keys/:id/rotate
 * @description Rotate an API key with a new value
 */
apiKeysRouter.post(
  '/:id/rotate',
  validateRequest(rotateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;
    const { key } = req.body as z.infer<typeof rotateSchema.body>;

    const rotated = await systemApiKeyService.rotateKey(id, key, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: rotated,
      message: 'API key rotated successfully',
    });
  })
);

/**
 * @route POST /api/admin/api-keys/:id/deactivate
 * @description Deactivate an API key
 */
apiKeysRouter.post(
  '/:id/deactivate',
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;

    const deactivated = await systemApiKeyService.deactivateKey(id, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: deactivated,
      message: 'API key deactivated',
    });
  })
);

/**
 * @route DELETE /api/admin/api-keys/:id
 * @description Delete an API key permanently
 */
apiKeysRouter.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;

    await systemApiKeyService.deleteKey(id, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'API key deleted permanently',
    });
  })
);
