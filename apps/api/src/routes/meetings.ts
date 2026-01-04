/**
 * Meeting routes
 * All routes require authentication
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { meetingController } from '../controllers/meetingController';
import { requireAuth } from '../middleware';

export const meetingsRouter: IRouter = Router();

// All meeting routes require authentication
meetingsRouter.use(requireAuth);

/**
 * @route GET /api/v1/meetings
 * @description List all meetings with pagination and filtering
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @query {string} status - Filter by status (scheduled, recording, processing, completed, failed)
 * @query {string} platform - Filter by platform (zoom, meet, teams, webex, other)
 * @query {string} search - Search in meeting titles
 * @query {string} startTimeFrom - Filter meetings starting after this date
 * @query {string} startTimeTo - Filter meetings starting before this date
 */
meetingsRouter.get('/', meetingController.list.bind(meetingController));

/**
 * @route GET /api/v1/meetings/upcoming
 * @description Get upcoming scheduled meetings
 * @query {number} limit - Maximum number to return (default: 10)
 */
meetingsRouter.get('/upcoming', meetingController.getUpcoming.bind(meetingController));

/**
 * @route GET /api/v1/meetings/recent
 * @description Get recent completed meetings
 * @query {number} limit - Maximum number to return (default: 10)
 */
meetingsRouter.get('/recent', meetingController.getRecent.bind(meetingController));

/**
 * @route GET /api/v1/meetings/stats
 * @description Get meeting statistics for the organization
 */
meetingsRouter.get('/stats', meetingController.getStats.bind(meetingController));

/**
 * @route GET /api/v1/meetings/:id
 * @description Get a single meeting by ID
 */
meetingsRouter.get('/:id', meetingController.getById.bind(meetingController));

/**
 * @route POST /api/v1/meetings
 * @description Create a new meeting
 * @body {string} title - Meeting title (required)
 * @body {string} platform - Platform (zoom, meet, teams, webex, other)
 * @body {string} meetingUrl - Meeting URL
 * @body {string} startTime - Scheduled start time
 * @body {string} endTime - Scheduled end time
 */
meetingsRouter.post('/', meetingController.create.bind(meetingController));

/**
 * @route PUT /api/v1/meetings/:id
 * @description Update a meeting
 */
meetingsRouter.put('/:id', meetingController.update.bind(meetingController));

/**
 * @route DELETE /api/v1/meetings/:id
 * @description Delete a meeting (soft delete)
 */
meetingsRouter.delete('/:id', meetingController.delete.bind(meetingController));

/**
 * @route GET /api/v1/meetings/:id/transcript
 * @description Get the transcript for a meeting
 */
meetingsRouter.get('/:id/transcript', meetingController.getTranscript.bind(meetingController));

/**
 * @route GET /api/v1/meetings/:id/summary
 * @description Get the AI-generated summary for a meeting
 */
meetingsRouter.get('/:id/summary', meetingController.getSummary.bind(meetingController));

/**
 * @route GET /api/v1/meetings/:id/action-items
 * @description Get action items extracted from a meeting
 */
meetingsRouter.get('/:id/action-items', meetingController.getActionItems.bind(meetingController));

/**
 * @route PATCH /api/v1/meetings/:id/action-items/:actionItemId
 * @description Update an action item (mark complete, change assignee, etc.)
 * @body {string} text - Action item text
 * @body {string} assignee - Person responsible
 * @body {Date} dueDate - Due date
 * @body {boolean} completed - Completion status
 */
meetingsRouter.patch(
  '/:id/action-items/:actionItemId',
  meetingController.updateActionItem.bind(meetingController)
);

/**
 * @route DELETE /api/v1/meetings/:id/action-items/:actionItemId
 * @description Delete an action item
 */
meetingsRouter.delete(
  '/:id/action-items/:actionItemId',
  meetingController.deleteActionItem.bind(meetingController)
);

/**
 * @route POST /api/v1/meetings/:id/summary/regenerate
 * @description Regenerate the AI summary for a meeting
 * @body {string} forceModel - Optional: "claude" or "gpt" to force a specific model
 */
meetingsRouter.post(
  '/:id/summary/regenerate',
  meetingController.regenerateSummary.bind(meetingController)
);

/**
 * @route POST /api/v1/meetings/:id/insights
 * @description Extract custom insights from a meeting
 * @body {string} templateId - ID of the insight template to use
 * @body {string} forceModel - Optional: "claude" or "gpt" to force a specific model
 */
import { insightsController } from '../controllers/insightsController';
meetingsRouter.post('/:id/insights', insightsController.extractInsights.bind(insightsController));

/**
 * @route POST /api/v1/meetings/:id/bot
 * @description Create and send a bot to join the meeting
 * @body {string} botName - Optional custom bot name
 * @body {Date} joinAt - Optional scheduled join time
 */
meetingsRouter.post('/:id/bot', meetingController.createBot.bind(meetingController));

/**
 * @route GET /api/v1/meetings/:id/bot
 * @description Get the bot status for a meeting
 */
meetingsRouter.get('/:id/bot', meetingController.getBotStatus.bind(meetingController));

/**
 * @route DELETE /api/v1/meetings/:id/bot
 * @description Stop and remove the bot from a meeting
 */
meetingsRouter.delete('/:id/bot', meetingController.stopBot.bind(meetingController));
