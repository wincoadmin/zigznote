/**
 * Recall.ai webhook handler
 * Processes events for bot status changes, recordings, and transcriptions
 */

import { Router, Request, Response } from 'express';
import { recallService, type RecallWebhookEvent } from '../../services/recallService';
import { logger } from '../../utils/logger';
import { checkAndMarkProcessed } from '../../utils/webhookIdempotency';

const router: Router = Router();

/**
 * POST /webhooks/recall
 * Receives and processes Recall.ai webhook events
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get raw body for signature verification
    const rawBody = req.body instanceof Buffer
      ? req.body.toString('utf8')
      : JSON.stringify(req.body);

    // Verify signature
    const signature = req.headers['x-recall-signature'] as string;

    if (signature) {
      const isValid = recallService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        logger.warn('Invalid Recall.ai webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    // Parse the event
    const event: RecallWebhookEvent = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    // Idempotency check - prevent duplicate processing
    const botId = event.data?.bot_id || 'unknown';
    const timestamp = event.data?.timestamp || Date.now();
    const eventId = `${botId}-${event.event}-${timestamp}`;

    const isNew = await checkAndMarkProcessed('recall', eventId, event.event);
    if (!isNew) {
      logger.info({ eventId, event: event.event }, 'Duplicate Recall webhook, skipping');
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    logger.info({ event: event.event, botId: event.data?.bot_id }, 'Received Recall.ai webhook');

    // Process the event
    await recallService.handleWebhookEvent(event);

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ error }, 'Error processing Recall.ai webhook');
    // Return 200 to prevent Recall.ai from retrying
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

export default router;
