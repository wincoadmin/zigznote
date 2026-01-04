/**
 * Meeting routes
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { meetingController } from '../controllers/meetingController';

export const meetingsRouter: IRouter = Router();

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
