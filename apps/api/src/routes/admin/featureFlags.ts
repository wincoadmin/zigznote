/**
 * Admin feature flag routes
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import { featureFlagService } from '../../services/featureFlagService';
import {
  requireAdminAuth,
  requireSupport,
  requireAdminRoleLevel,
  type AdminAuthenticatedRequest,
} from '../../middleware/adminAuth';
import { asyncHandler, validateRequest } from '../../middleware';

export const featureFlagsRouter: IRouter = Router();

// All routes require at least support role
featureFlagsRouter.use(requireAdminAuth, requireSupport);

// Validation schemas
const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
    category: z.string().optional(),
    enabled: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
  }),
});

const createSchema = z.object({
  body: z.object({
    key: z.string().min(1).max(100).regex(/^[a-z0-9_.-]+$/, {
      message: 'Key must be lowercase alphanumeric with dots, underscores, or hyphens',
    }),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    enabled: z.boolean().default(false),
    percentage: z.number().int().min(0).max(100).default(100),
    category: z.string().max(50).default('general'),
    targetRules: z.array(z.object({
      type: z.enum(['org', 'user', 'plan']),
      ids: z.array(z.string()).optional(),
      value: z.string().optional(),
    })).optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    enabled: z.boolean().optional(),
    percentage: z.number().int().min(0).max(100).optional(),
    category: z.string().max(50).optional(),
    targetRules: z.array(z.object({
      type: z.enum(['org', 'user', 'plan']),
      ids: z.array(z.string()).optional(),
      value: z.string().optional(),
    })).optional(),
  }),
});

/**
 * @route GET /api/admin/feature-flags
 * @description List feature flags
 */
featureFlagsRouter.get(
  '/',
  validateRequest(listSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, category, enabled, search } =
      req.query as z.infer<typeof listSchema>['query'];

    const result = await featureFlagService.listFlags(
      { page, limit },
      {
        category,
        enabled: enabled ? enabled === 'true' : undefined,
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
 * @route GET /api/admin/feature-flags/stats
 * @description Get flag statistics
 */
featureFlagsRouter.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await featureFlagService.getFlagStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route GET /api/admin/feature-flags/categories
 * @description Get all categories
 */
featureFlagsRouter.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const categories = await featureFlagService.getCategories();

    res.json({
      success: true,
      data: categories,
    });
  })
);

/**
 * @route GET /api/admin/feature-flags/enabled
 * @description Get all enabled flags
 */
featureFlagsRouter.get(
  '/enabled',
  asyncHandler(async (req: Request, res: Response) => {
    const flags = await featureFlagService.getEnabledFlags();

    res.json({
      success: true,
      data: flags,
    });
  })
);

/**
 * @route GET /api/admin/feature-flags/:id
 * @description Get a single flag
 */
featureFlagsRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const flag = await featureFlagService.getFlag(id);
    if (!flag) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Feature flag not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: flag,
    });
  })
);

/**
 * @route POST /api/admin/feature-flags
 * @description Create a new flag (requires admin role)
 */
featureFlagsRouter.post(
  '/',
  requireAdminRoleLevel,
  validateRequest(createSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const input = req.body as z.infer<typeof createSchema>['body'];

    const created = await featureFlagService.createFlag(
      input,
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
 * @route PATCH /api/admin/feature-flags/:id
 * @description Update a flag (requires admin role)
 */
featureFlagsRouter.patch(
  '/:id',
  requireAdminRoleLevel,
  validateRequest(updateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { id } = req.params;
    const input = req.body as z.infer<typeof updateSchema>['body'];

    const updated = await featureFlagService.updateFlag(id, input, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * @route POST /api/admin/feature-flags/:id/toggle
 * @description Toggle a flag (requires admin role)
 */
featureFlagsRouter.post(
  '/:id/toggle',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { id } = req.params;

    const toggled = await featureFlagService.toggleFlag(id, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: toggled,
      message: `Flag ${toggled.enabled ? 'enabled' : 'disabled'}`,
    });
  })
);

/**
 * @route DELETE /api/admin/feature-flags/:id
 * @description Delete a flag (requires admin role)
 */
featureFlagsRouter.delete(
  '/:id',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { id } = req.params;

    await featureFlagService.deleteFlag(id, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Feature flag deleted',
    });
  })
);

/**
 * @route POST /api/admin/feature-flags/check
 * @description Check if a flag is enabled for a context
 */
featureFlagsRouter.post(
  '/check',
  asyncHandler(async (req: Request, res: Response) => {
    const { key, organizationId, userId, plan } = req.body;

    if (!key) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_KEY', message: 'Flag key required' },
      });
      return;
    }

    const enabled = await featureFlagService.isEnabled(key, {
      organizationId,
      userId,
      plan,
    });

    res.json({
      success: true,
      data: { key, enabled },
    });
  })
);
