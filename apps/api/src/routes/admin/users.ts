/**
 * Admin user management routes
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import { adminUserService } from '../../services/adminUserService';
import {
  requireAdminAuth,
  requireSupport,
  requireAdminRoleLevel,
  type AdminAuthenticatedRequest,
} from '../../middleware/adminAuth';
import { asyncHandler, validateRequest } from '../../middleware';

export const usersRouter: IRouter = Router();

// All routes require at least support role
usersRouter.use(requireAdminAuth, requireSupport);

// Validation schemas
const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
    organizationId: z.string().uuid().optional(),
    role: z.string().optional(),
    search: z.string().optional(),
    includeDeleted: z.enum(['true', 'false']).optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
    avatarUrl: z.string().url().nullable().optional(),
  }),
});

const searchSchema = z.object({
  query: z.object({
    q: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
  }),
});

/**
 * @route GET /api/admin/users
 * @description List users with pagination and filters
 */
usersRouter.get(
  '/',
  validateRequest(listSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, organizationId, role, search, includeDeleted } =
      req.query as z.infer<typeof listSchema>['query'];

    const result = await adminUserService.listUsers(
      { page, limit },
      {
        organizationId,
        role,
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
 * @route GET /api/admin/users/search
 * @description Search users
 */
usersRouter.get(
  '/search',
  validateRequest(searchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, limit } = req.query as z.infer<typeof searchSchema>['query'];

    const users = await adminUserService.searchUsers(q, limit);

    res.json({
      success: true,
      data: users,
    });
  })
);

/**
 * @route GET /api/admin/users/stats
 * @description Get user statistics
 */
usersRouter.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await adminUserService.getUserStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route GET /api/admin/users/:id
 * @description Get user details
 */
usersRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const includeDeleted = req.query.includeDeleted === 'true';

    const user = await adminUserService.getUser(id, includeDeleted);
    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * @route PATCH /api/admin/users/:id
 * @description Update user (requires admin role)
 */
usersRouter.patch(
  '/:id',
  requireAdminRoleLevel,
  validateRequest(updateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { id } = req.params;
    const updates = req.body as z.infer<typeof updateSchema>['body'];

    const updated = await adminUserService.updateUser(id, updates, {
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
 * @route POST /api/admin/users/:id/suspend
 * @description Suspend user (requires admin role)
 */
usersRouter.post(
  '/:id/suspend',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { id } = req.params;

    await adminUserService.suspendUser(id, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'User suspended',
    });
  })
);

/**
 * @route POST /api/admin/users/:id/restore
 * @description Restore suspended user (requires admin role)
 */
usersRouter.post(
  '/:id/restore',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { id } = req.params;

    const user = await adminUserService.restoreUser(id, {
      adminId: adminReq.adminAuth!.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: user,
      message: 'User restored',
    });
  })
);

/**
 * @route POST /api/admin/users/:id/impersonate
 * @description Impersonate user (requires admin role)
 */
usersRouter.post(
  '/:id/impersonate',
  requireAdminRoleLevel,
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;
    const { id } = req.params;

    const { token, expiresAt } = await adminUserService.impersonateUser(
      id,
      adminReq.adminAuth!.adminId,
      {
        adminId: adminReq.adminAuth!.adminId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      success: true,
      data: {
        impersonationToken: token,
        expiresAt: expiresAt.toISOString(),
      },
      message: 'Impersonation session started. Token valid for 30 minutes.',
    });
  })
);

/**
 * @route POST /api/admin/users/impersonation/validate
 * @description Validate impersonation token
 */
usersRouter.post(
  '/impersonation/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Token required' },
      });
      return;
    }

    const tokenData = adminUserService.validateImpersonationToken(token);
    if (!tokenData) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        userId: tokenData.userId,
        adminId: tokenData.adminId,
        expiresAt: tokenData.expiresAt.toISOString(),
      },
    });
  })
);

/**
 * @route POST /api/admin/users/impersonation/end
 * @description End impersonation session
 */
usersRouter.post(
  '/impersonation/end',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (token) {
      adminUserService.endImpersonation(token);
    }

    res.json({
      success: true,
      message: 'Impersonation session ended',
    });
  })
);

/**
 * @route DELETE /api/admin/users/:id
 * @description Permanently delete user (requires super_admin)
 */
usersRouter.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminReq = req as AdminAuthenticatedRequest;

    // Only super_admin can permanently delete
    if (adminReq.adminAuth?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only super admins can permanently delete users' },
      });
      return;
    }

    const { id } = req.params;

    await adminUserService.deleteUserPermanently(id, {
      adminId: adminReq.adminAuth.adminId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'User permanently deleted',
    });
  })
);
