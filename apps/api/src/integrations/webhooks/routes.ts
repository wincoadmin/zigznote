/**
 * Webhook Routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zigznote/database';
import { WebhookService } from './WebhookService';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../middleware/auth';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { WEBHOOK_EVENTS, WebhookEvent } from './types';

const router: Router = Router();
const webhookService = new WebhookService(prisma);

/**
 * GET /webhooks
 * List all webhooks for organization
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth!.organizationId!;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const webhooks = await webhookService.getWebhooks(organizationId);

    // Mask secrets in response
    const maskedWebhooks = webhooks.map((w) => ({
      ...w,
      secret: `${w.secret.substring(0, 12)}...`,
    }));

    res.json({ webhooks: maskedWebhooks });
  })
);

/**
 * GET /webhooks/events
 * List available webhook events
 */
router.get('/events', (_req: Request, res: Response) => {
  res.json({ events: WEBHOOK_EVENTS });
});

/**
 * POST /webhooks
 * Create a new webhook
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth!.organizationId!;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const { name, url, events, headers } = req.body;

    if (!name || typeof name !== 'string' || name.length < 1) {
      throw new BadRequestError('Name is required');
    }

    if (!url || typeof url !== 'string') {
      throw new BadRequestError('URL is required');
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new BadRequestError('URL must use HTTP or HTTPS protocol');
      }
    } catch {
      throw new BadRequestError('Invalid URL format');
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new BadRequestError('At least one event is required');
    }

    // Validate events
    const invalidEvents = events.filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      throw new BadRequestError(`Invalid events: ${invalidEvents.join(', ')}`);
    }

    const webhook = await webhookService.createWebhook(organizationId, {
      name,
      url,
      events: events as WebhookEvent[],
      headers,
    });

    res.status(201).json({
      webhook: {
        ...webhook,
        // Show secret only on creation
      },
    });
  })
);

/**
 * GET /webhooks/:id
 * Get webhook details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth!.organizationId!;
    const id = req.params.id!;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const webhook = await webhookService.getWebhook(organizationId, id);

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    res.json({
      webhook: {
        ...webhook,
        secret: `${webhook.secret.substring(0, 12)}...`,
      },
    });
  })
);

/**
 * PUT /webhooks/:id
 * Update a webhook
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth!.organizationId!;
    const id = req.params.id!;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const { name, url, events, headers, status } = req.body;

    // Validate URL if provided
    if (url) {
      try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new BadRequestError('URL must use HTTP or HTTPS protocol');
        }
      } catch {
        throw new BadRequestError('Invalid URL format');
      }
    }

    // Validate events if provided
    if (events) {
      if (!Array.isArray(events) || events.length === 0) {
        throw new BadRequestError('At least one event is required');
      }
      const invalidEvents = events.filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        throw new BadRequestError(`Invalid events: ${invalidEvents.join(', ')}`);
      }
    }

    // Validate status if provided
    if (status && !['active', 'inactive'].includes(status)) {
      throw new BadRequestError('Status must be active or inactive');
    }

    const webhook = await webhookService.updateWebhook(organizationId, id, {
      name,
      url,
      events: events as WebhookEvent[] | undefined,
      headers,
      status,
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    res.json({
      webhook: {
        ...webhook,
        secret: `${webhook.secret.substring(0, 12)}...`,
      },
    });
  })
);

/**
 * DELETE /webhooks/:id
 * Delete a webhook
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth!.organizationId!;
    const id = req.params.id!;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const success = await webhookService.deleteWebhook(organizationId, id);

    if (!success) {
      throw new NotFoundError('Webhook not found');
    }

    res.json({ success: true });
  })
);

/**
 * POST /webhooks/:id/regenerate-secret
 * Regenerate webhook secret
 */
router.post(
  '/:id/regenerate-secret',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth!.organizationId!;
    const id = req.params.id!;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const newSecret = await webhookService.regenerateSecret(organizationId, id);

    if (!newSecret) {
      throw new NotFoundError('Webhook not found');
    }

    res.json({ secret: newSecret });
  })
);

/**
 * GET /webhooks/:id/deliveries
 * Get webhook delivery history
 */
router.get(
  '/:id/deliveries',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth!.organizationId!;
    const id = req.params.id!;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    // Verify webhook belongs to organization
    const webhook = await webhookService.getWebhook(organizationId, id);
    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    const deliveries = await webhookService.getDeliveries(id, limit);

    res.json({ deliveries });
  })
);

/**
 * POST /webhooks/:id/test
 * Send a test webhook delivery
 */
router.post(
  '/:id/test',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth!.organizationId!;
    const id = req.params.id!;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const webhook = await webhookService.getWebhook(organizationId, id);

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    // Send test payload
    const testData = {
      test: true,
      message: 'This is a test webhook delivery from zigznote',
      timestamp: new Date().toISOString(),
    };

    const result = await webhookService.deliver(webhook, 'meeting.updated', testData);

    res.json({
      success: result.success,
      statusCode: result.statusCode,
      duration: result.duration,
      error: result.error,
    });
  })
);

export default router;
