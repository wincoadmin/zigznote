/**
 * Admin organization management routes
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import { adminOrganizationService } from '../../services/adminOrganizationService';
import {
  requireAdminAuth,
  requireSupport,
  requireAdminRoleLevel,
  type AdminAuthenticatedRequest,
} from '../../middleware/adminAuth';
import { asyncHandler, validateRequest } from '../../middleware';

export const organizationsRouter: IRouter = Router();

// All routes require at least support role
organizationsRouter.use(requireAdminAuth, requireSupport);

// Validation schemas
const listSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
    plan: z.string().optional(),
    accountType: z.enum(['REGULAR', 'TRIAL', 'COMPLIMENTARY', 'PARTNER', 'INTERNAL']).optional(),
    search: z.string().optional(),
    includeDeleted: z.enum(['true', 'false']).optional(),
  }),
};

const updateSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    plan: z.string().min(1).max(50).optional(),
    settings: z.record(z.unknown()).optional(),
  }),
};

const billingOverrideSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    accountType: z.enum(['REGULAR', 'TRIAL', 'COMPLIMENTARY', 'PARTNER', 'INTERNAL']),
    reason: z.string().min(1).max(500),
  }),
};

const planSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    plan: z.string().min(1).max(50),
  }),
};

const settingsSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.record(z.unknown()),
};

const searchSchema = {
  query: z.object({
    q: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
  }),
};

/**
 * @route GET /api/admin/organizations
 * @description List organizations with pagination and filters
 */
organizationsRouter.get(
  '/',
  validateRequest(listSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, plan, accountType, search, includeDeleted } =
      req.query as z.infer<typeof listSchema.query>;

    const result = await adminOrganizationService.listOrganizations(
      { page, limit },
      {
        plan,
        accountType,
        search,
        includeDeleted: includeDeleted === 'true',
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
 * @route GET /api/admin/organizations/search
 * @description Search organizations
 */
organizationsRouter.get(
  '/search',
  validateRequest(searchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, limit } = req.query as unknown as z.infer<typeof searchSchema.query>;

    const orgs = await adminOrganizationService.searchOrganizations(q, limit);

    res.json({
      success: true,
      data: orgs,
    });
  })
);

/**
 * @route GET /api/admin/organizations/stats
 * @description Get organization statistics
 */
organizationsRouter.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await adminOrganizationService.getOrganizationStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route GET /api/admin/organizations/:id
 * @description Get organization details
 */
organizationsRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id!;
    const includeDeleted = req.query.includeDeleted === 'true';

    const org = await adminOrganizationService.getOrganization(id, includeDeleted);
    if (!org) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: org,
    });
  })
);

/**
 * @route GET /api/admin/organizations/:id/users
 * @description Get users in organization
 */
organizationsRouter.get(
  '/:id/users',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await adminOrganizationService.getOrganizationUsers(id, { page, limit });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  })
);

/**
 * @route PATCH /api/admin/organizations/:id
 * @description Update organization (requires admin role)
 */
organizationsRouter.patch(
  '/:id',
  requireAdminRoleLevel,
  validateRequest(updateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;
    const updates = req.body as z.infer<typeof updateSchema.body>;

    const updated = await adminOrganizationService.updateOrganization(id, updates, {
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
 * @route PUT /api/admin/organizations/:id/plan
 * @description Update organization plan (requires admin role)
 */
organizationsRouter.put(
  '/:id/plan',
  requireAdminRoleLevel,
  validateRequest(planSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;
    const { plan } = req.body as z.infer<typeof planSchema.body>;

    const updated = await adminOrganizationService.updatePlan(id, plan, {
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
 * @route PATCH /api/admin/organizations/:id/settings
 * @description Update organization settings (requires admin role)
 */
organizationsRouter.patch(
  '/:id/settings',
  requireAdminRoleLevel,
  validateRequest(settingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;
    const settings = req.body as Record<string, unknown>;

    const updated = await adminOrganizationService.updateSettings(id, settings, {
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
 * @route POST /api/admin/organizations/:id/billing-override
 * @description Set billing override (requires admin role)
 */
organizationsRouter.post(
  '/:id/billing-override',
  requireAdminRoleLevel,
  validateRequest(billingOverrideSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;
    const { accountType, reason } = req.body as z.infer<typeof billingOverrideSchema.body>;

    const updated = await adminOrganizationService.setBillingOverride(
      id,
      { accountType, reason },
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
      message: `Billing override set to ${accountType}`,
    });
  })
);

/**
 * @route DELETE /api/admin/organizations/:id/billing-override
 * @description Clear billing override (requires admin role)
 */
organizationsRouter.delete(
  '/:id/billing-override',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;

    const updated = await adminOrganizationService.clearBillingOverride(id, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: updated,
      message: 'Billing override cleared',
    });
  })
);

/**
 * @route POST /api/admin/organizations/:id/suspend
 * @description Suspend organization (requires admin role)
 */
organizationsRouter.post(
  '/:id/suspend',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;

    await adminOrganizationService.suspendOrganization(id, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Organization suspended',
    });
  })
);

/**
 * @route POST /api/admin/organizations/:id/restore
 * @description Restore suspended organization (requires admin role)
 */
organizationsRouter.post(
  '/:id/restore',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const id = req.params.id!;

    const org = await adminOrganizationService.restoreOrganization(id, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: org,
      message: 'Organization restored',
    });
  })
);
