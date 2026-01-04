import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { MeetingController } from '../controllers/meetingController';
import { MeetingService } from '../services/meetingService';

const meetingService = new MeetingService();
const meetingController = new MeetingController(meetingService);

export const meetingsRouter: IRouter = Router();

/**
 * @route GET /api/v1/meetings
 * @description List all meetings with pagination
 */
meetingsRouter.get('/', meetingController.list.bind(meetingController));

/**
 * @route GET /api/v1/meetings/:id
 * @description Get a single meeting by ID
 */
meetingsRouter.get('/:id', meetingController.getById.bind(meetingController));

/**
 * @route POST /api/v1/meetings
 * @description Create a new meeting
 */
meetingsRouter.post('/', meetingController.create.bind(meetingController));

/**
 * @route DELETE /api/v1/meetings/:id
 * @description Delete a meeting
 */
meetingsRouter.delete('/:id', meetingController.delete.bind(meetingController));
