/**
 * Admin API routes
 * All routes under /api/admin
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { adminAuthRouter } from './auth';
import { auditLogsRouter } from './auditLogs';
import { apiKeysRouter } from './apiKeys';
import { usersRouter } from './users';
import { organizationsRouter } from './organizations';
import { featureFlagsRouter } from './featureFlags';
import { systemConfigRouter } from './systemConfig';
import { analyticsRouter } from './analytics';
import { operationsRouter } from './operations';
import backupsRouter from './backups';
import integrationsRouter from './integrations';
import { billingRouter } from './billing';
import { checkIpAllowlist } from '../../middleware/adminAuth';

export const adminRouter: IRouter = Router();

// Optional IP allowlist for all admin routes
adminRouter.use(checkIpAllowlist);

// Auth routes (mostly public)
adminRouter.use('/auth', adminAuthRouter);

// Protected admin routes
adminRouter.use('/audit-logs', auditLogsRouter);
adminRouter.use('/api-keys', apiKeysRouter);
adminRouter.use('/users', usersRouter);
adminRouter.use('/organizations', organizationsRouter);
adminRouter.use('/feature-flags', featureFlagsRouter);
adminRouter.use('/system-config', systemConfigRouter);
adminRouter.use('/analytics', analyticsRouter);
adminRouter.use('/operations', operationsRouter);
adminRouter.use('/backups', backupsRouter);
adminRouter.use('/integrations', integrationsRouter);
adminRouter.use('/billing', billingRouter);
