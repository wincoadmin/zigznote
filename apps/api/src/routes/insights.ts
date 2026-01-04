/**
 * Insights routes
 * Endpoints for custom insight extraction
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { insightsController } from '../controllers/insightsController';
import { requireAuth } from '../middleware';

export const insightsRouter: IRouter = Router();

// All insights routes require authentication
insightsRouter.use(requireAuth);

/**
 * @route GET /api/v1/insights/templates
 * @description Get available insight templates
 */
insightsRouter.get('/templates', insightsController.getTemplates.bind(insightsController));
