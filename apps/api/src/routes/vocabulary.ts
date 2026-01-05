/**
 * Custom vocabulary routes
 * All routes require authentication (session or API key)
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { vocabularyController } from '../controllers/vocabularyController';
import { requireAuth, optionalApiKeyAuth, requireScope } from '../middleware';

export const vocabularyRouter: IRouter = Router();

// Check for API key first, then fall back to session auth
vocabularyRouter.use(optionalApiKeyAuth);
vocabularyRouter.use(requireAuth);

/**
 * @route GET /api/v1/vocabulary
 * @description List all custom vocabulary terms for the organization
 * @query {string} category - Filter by category (product, company, person, technical, industry, other)
 */
vocabularyRouter.get(
  '/',
  requireScope('transcripts:read'),
  vocabularyController.list.bind(vocabularyController)
);

/**
 * @route GET /api/v1/vocabulary/stats
 * @description Get vocabulary statistics
 */
vocabularyRouter.get(
  '/stats',
  requireScope('transcripts:read'),
  vocabularyController.stats.bind(vocabularyController)
);

/**
 * @route GET /api/v1/vocabulary/:id
 * @description Get a single vocabulary term by ID
 */
vocabularyRouter.get(
  '/:id',
  requireScope('transcripts:read'),
  vocabularyController.getById.bind(vocabularyController)
);

/**
 * @route POST /api/v1/vocabulary
 * @description Create a new vocabulary term (or update if exists)
 * @body {string} term - The term to add (e.g., "zigznote", "Kubernetes")
 * @body {number} boost - Boost value 1.0-2.0 (default: 1.5)
 * @body {string} category - Optional category (product, company, person, technical, industry, other)
 */
vocabularyRouter.post(
  '/',
  requireScope('transcripts:write'),
  vocabularyController.create.bind(vocabularyController)
);

/**
 * @route POST /api/v1/vocabulary/bulk
 * @description Bulk create vocabulary terms
 * @body {array} terms - Array of term objects
 */
vocabularyRouter.post(
  '/bulk',
  requireScope('transcripts:write'),
  vocabularyController.bulkCreate.bind(vocabularyController)
);

/**
 * @route PATCH /api/v1/vocabulary/:id
 * @description Update a vocabulary term
 */
vocabularyRouter.patch(
  '/:id',
  requireScope('transcripts:write'),
  vocabularyController.update.bind(vocabularyController)
);

/**
 * @route DELETE /api/v1/vocabulary/:id
 * @description Delete a vocabulary term
 */
vocabularyRouter.delete(
  '/:id',
  requireScope('transcripts:write'),
  vocabularyController.delete.bind(vocabularyController)
);
