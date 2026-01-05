/**
 * Clerk webhook handler
 * Handles user and organization sync events from Clerk
 */

import { Router, Request, Response } from 'express';
import type { Router as IRouter } from 'express';
import { Webhook } from 'svix';
import { authService, type ClerkWebhookEvent } from '../../services/authService';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { checkAndMarkProcessed } from '../../utils/webhookIdempotency';

const router: IRouter = Router();

/**
 * POST /webhooks/clerk
 * Receives and processes Clerk webhook events
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = config.clerk.webhookSecret;

  if (!webhookSecret) {
    logger.error('CLERK_WEBHOOK_SECRET is not configured');
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  // Get Svix headers for verification
  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn('Missing Svix headers in webhook request');
    res.status(400).json({ error: 'Missing webhook headers' });
    return;
  }

  try {
    // Verify webhook signature
    const wh = new Webhook(webhookSecret);

    // Get raw body for verification
    const payload = JSON.stringify(req.body);

    const event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;

    // Idempotency check - prevent duplicate processing
    const isNew = await checkAndMarkProcessed('clerk', svixId, event.type);
    if (!isNew) {
      logger.info({ svixId, eventType: event.type }, 'Duplicate Clerk webhook, skipping');
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    // Process the event
    await authService.syncUserFromWebhook(event);

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ error }, 'Failed to verify or process Clerk webhook');

    if (error instanceof Error && error.message.includes('signature')) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
