/**
 * Admin system config routes
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import { systemConfigService } from '../../services/systemConfigService';
import {
  requireAdminAuth,
  requireSupport,
  requireAdminRoleLevel,
  type AdminAuthenticatedRequest,
} from '../../middleware/adminAuth';
import { asyncHandler, validateRequest } from '../../middleware';

export const systemConfigRouter: IRouter = Router();

// All routes require at least support role
systemConfigRouter.use(requireAdminAuth, requireSupport);

// Validation schemas
const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
    category: z.string().optional(),
    encrypted: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
  }),
});

const createSchema = z.object({
  body: z.object({
    key: z.string().min(1).max(100).regex(/^[a-z0-9_.-]+$/, {
      message: 'Key must be lowercase alphanumeric with dots, underscores, or hyphens',
    }),
    value: z.unknown(),
    encrypted: z.boolean().default(false),
    category: z.string().max(50).default('general'),
  }),
});

const updateSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    value: z.unknown().optional(),
    encrypted: z.boolean().optional(),
    category: z.string().max(50).optional(),
  }),
});

const setValueSchema = z.object({
  body: z.object({
    key: z.string().min(1).max(100),
    value: z.unknown(),
    encrypted: z.boolean().optional(),
    category: z.string().max(50).optional(),
  }),
});

/**
 * @route GET /api/admin/system-config
 * @description List system configs
 */
systemConfigRouter.get(
  '/',
  validateRequest(listSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, category, encrypted, search } =
      req.query as z.infer<typeof listSchema>['query'];

    const result = await systemConfigService.listConfigs(
      { page, limit },
      {
        category,
        encrypted: encrypted ? encrypted === 'true' : undefined,
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
 * @route GET /api/admin/system-config/stats
 * @description Get config statistics
 */
systemConfigRouter.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await systemConfigService.getConfigStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route GET /api/admin/system-config/categories
 * @description Get all categories
 */
systemConfigRouter.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const categories = await systemConfigService.getCategories();

    res.json({
      success: true,
      data: categories,
    });
  })
);

/**
 * @route GET /api/admin/system-config/category/:category
 * @description Get configs by category
 */
systemConfigRouter.get(
  '/category/:category',
  asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.params;

    const configs = await systemConfigService.getConfigsByCategory(category);

    res.json({
      success: true,
      data: configs,
    });
  })
);

/**
 * @route GET /api/admin/system-config/prefix/:prefix
 * @description Get configs by prefix
 */
systemConfigRouter.get(
  '/prefix/:prefix',
  asyncHandler(async (req: Request, res: Response) => {
    const { prefix } = req.params;

    const configs = await systemConfigService.getConfigsByPrefix(prefix);

    res.json({
      success: true,
      data: configs,
    });
  })
);

/**
 * @route GET /api/admin/system-config/key/:key
 * @description Get config by key
 */
systemConfigRouter.get(
  '/key/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;

    const config = await systemConfigService.getConfigByKey(key);
    if (!config) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Config not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * @route GET /api/admin/system-config/:id
 * @description Get a single config
 */
systemConfigRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const config = await systemConfigService.getConfig(id);
    if (!config) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Config not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * @route POST /api/admin/system-config
 * @description Create a new config (requires admin role)
 */
systemConfigRouter.post(
  '/',
  requireAdminRoleLevel,
  validateRequest(createSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const input = req.body as z.infer<typeof createSchema>['body'];

    const created = await systemConfigService.createConfig(
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
 * @route PUT /api/admin/system-config/set
 * @description Set config value by key (upsert, requires admin role)
 */
systemConfigRouter.put(
  '/set',
  requireAdminRoleLevel,
  validateRequest(setValueSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { key, value, encrypted, category } = req.body as z.infer<typeof setValueSchema>['body'];

    const config = await systemConfigService.setValue(
      key,
      value,
      adminReq.adminAuth!.adminId,
      {
        adminId: adminReq.adminAuth!.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
      },
      { encrypted, category }
    );

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * @route PATCH /api/admin/system-config/:id
 * @description Update a config (requires admin role)
 */
systemConfigRouter.patch(
  '/:id',
  requireAdminRoleLevel,
  validateRequest(updateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { id } = req.params;
    const input = req.body as z.infer<typeof updateSchema>['body'];

    const updated = await systemConfigService.updateConfig(
      id,
      input,
      adminReq.adminAuth!.adminId,
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
 * @route DELETE /api/admin/system-config/:id
 * @description Delete a config (requires admin role)
 */
systemConfigRouter.delete(
  '/:id',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { id } = req.params;

    await systemConfigService.deleteConfig(id, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Config deleted',
    });
  })
);
