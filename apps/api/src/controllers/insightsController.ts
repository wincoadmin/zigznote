/**
 * Insights controller for custom insight extraction
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES } from '@zigznote/shared';
import { meetingRepository, transcriptRepository } from '@zigznote/database';
import { errors } from '../utils/errors';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../middleware';

// Redis connection for job queue
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let redisConnection: Redis | null = null;
let summarizationQueue: Queue | null = null;

function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return redisConnection;
}

function getSummarizationQueue(): Queue {
  if (!summarizationQueue) {
    summarizationQueue = new Queue(QUEUE_NAMES.SUMMARIZATION, {
      connection: getRedisConnection(),
    });
  }
  return summarizationQueue;
}

// Built-in insight templates (matches summarization worker)
const BUILT_IN_TEMPLATES = [
  {
    id: 'sales_signals',
    name: 'Sales Signals',
    description: 'Extract buying signals, objections, and next steps from sales calls',
    outputSchema: 'json',
  },
  {
    id: 'interview_notes',
    name: 'Interview Notes',
    description: 'Extract key points from candidate interviews',
    outputSchema: 'json',
  },
  {
    id: 'project_status',
    name: 'Project Status',
    description: 'Extract project status, blockers, and updates',
    outputSchema: 'json',
  },
  {
    id: 'customer_feedback',
    name: 'Customer Feedback',
    description: 'Extract feature requests and feedback from customer calls',
    outputSchema: 'json',
  },
  {
    id: 'meeting_effectiveness',
    name: 'Meeting Effectiveness',
    description: 'Analyze meeting efficiency and participation',
    outputSchema: 'json',
  },
];

/**
 * Controller for insights endpoints
 */
export class InsightsController {
  /**
   * Get available insight templates
   * GET /api/v1/insights/templates
   */
  async getTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({
        success: true,
        data: BUILT_IN_TEMPLATES,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Extract insights from a meeting
   * POST /api/v1/meetings/:id/insights
   */
  async extractInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id: meetingId } = req.params;

      if (!meetingId) {
        throw errors.badRequest('Meeting ID is required');
      }

      const organizationId = authReq.auth!.organizationId;

      // Validate request body
      const schema = z.object({
        templateId: z.string().min(1),
        forceModel: z.enum(['claude', 'gpt']).optional(),
      });

      const { templateId, forceModel } = schema.parse(req.body);

      // Verify template exists
      const template = BUILT_IN_TEMPLATES.find((t) => t.id === templateId);
      if (!template) {
        throw errors.badRequest(`Template not found: ${templateId}`);
      }

      // Verify meeting access
      const meeting = await meetingRepository.findById(meetingId);
      if (!meeting) {
        throw errors.notFound('Meeting');
      }
      if (meeting.organizationId !== organizationId) {
        throw errors.forbidden('Access denied to this meeting');
      }

      // Check if transcript exists
      const transcript = await transcriptRepository.findByMeetingId(meetingId);
      if (!transcript) {
        throw errors.badRequest('No transcript available for this meeting');
      }

      // Queue the insights extraction job
      const queue = getSummarizationQueue();
      const job = await queue.add('customInsights', {
        meetingId,
        transcriptId: transcript.id,
        templateId,
        forceModel,
      });

      logger.info({ meetingId, templateId, jobId: job.id }, 'Insights extraction queued');

      res.status(202).json({
        success: true,
        data: {
          jobId: job.id || 'unknown',
          templateId,
          templateName: template.name,
          message: 'Insights extraction has been queued',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Extract insights synchronously (for smaller transcripts)
   * POST /api/v1/meetings/:id/insights/sync
   * Note: This would require importing the insights service from summarization worker
   * For now, we'll just queue the job and return immediately
   */
  async extractInsightsSync(req: Request, res: Response, next: NextFunction): Promise<void> {
    // For Phase 4, we'll use async extraction via queue
    // Synchronous extraction would be added in a future phase if needed
    return this.extractInsights(req, res, next);
  }
}

// Export singleton instance
export const insightsController = new InsightsController();
