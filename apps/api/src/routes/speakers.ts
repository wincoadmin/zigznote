/**
 * Speaker alias routes
 * All routes require authentication (session or API key)
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { speakerController } from '../controllers/speakerController';
import { requireAuth, optionalApiKeyAuth, requireScope } from '../middleware';

export const speakersRouter: IRouter = Router();

// Check for API key first, then fall back to session auth
speakersRouter.use(optionalApiKeyAuth);
speakersRouter.use(requireAuth);

/**
 * @route GET /api/v1/speakers
 * @description List all speaker aliases for the organization
 */
speakersRouter.get(
  '/',
  requireScope('transcripts:read'),
  speakerController.list.bind(speakerController)
);

/**
 * @route GET /api/v1/speakers/:id
 * @description Get a single speaker alias by ID
 */
speakersRouter.get(
  '/:id',
  requireScope('transcripts:read'),
  speakerController.getById.bind(speakerController)
);

/**
 * @route POST /api/v1/speakers
 * @description Create a new speaker alias
 * @body {string} speakerLabel - Speaker label from transcript (e.g., "Speaker 0")
 * @body {string} displayName - Display name (e.g., "John Smith")
 * @body {string} email - Optional email address
 * @body {string} meetingId - Optional meeting ID where speaker was identified
 * @body {number} confidence - Confidence level (0-1)
 */
speakersRouter.post(
  '/',
  requireScope('transcripts:write'),
  speakerController.create.bind(speakerController)
);

/**
 * @route PUT /api/v1/speakers
 * @description Create or update a speaker alias (upsert by organizationId + speakerLabel)
 */
speakersRouter.put(
  '/',
  requireScope('transcripts:write'),
  speakerController.upsert.bind(speakerController)
);

/**
 * @route POST /api/v1/speakers/bulk
 * @description Bulk create/update speaker aliases
 * @body {array} aliases - Array of speaker alias objects
 */
speakersRouter.post(
  '/bulk',
  requireScope('transcripts:write'),
  speakerController.bulkUpsert.bind(speakerController)
);

/**
 * @route PATCH /api/v1/speakers/:id
 * @description Update a speaker alias
 */
speakersRouter.patch(
  '/:id',
  requireScope('transcripts:write'),
  speakerController.update.bind(speakerController)
);

/**
 * @route DELETE /api/v1/speakers/:id
 * @description Delete a speaker alias
 */
speakersRouter.delete(
  '/:id',
  requireScope('transcripts:write'),
  speakerController.delete.bind(speakerController)
);
