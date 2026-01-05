/**
 * Webhook Processor Job
 * Processes webhook delivery jobs from BullMQ queue
 */

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { WebhookService, WebhookDispatcher, WebhookJobData, MAX_RETRY_ATTEMPTS } from '../integrations';
import { config } from '../config';

const prisma = new PrismaClient();
const webhookService = new WebhookService(prisma);
const webhookDispatcher = new WebhookDispatcher(prisma);

/**
 * Process a webhook delivery job
 */
async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const { webhookId, organizationId, event, payload, attempt } = job.data;

  console.log(`[Webhook] Processing delivery for webhook ${webhookId}, event ${event}, attempt ${attempt}`);

  // Get webhook config
  const webhook = await webhookService.getWebhook(organizationId, webhookId);

  if (!webhook) {
    console.log(`[Webhook] Webhook ${webhookId} not found, skipping`);
    return;
  }

  if (webhook.status !== 'active') {
    console.log(`[Webhook] Webhook ${webhookId} is not active (${webhook.status}), skipping`);
    return;
  }

  // Deliver webhook
  const result = await webhookService.deliver(webhook, event, payload);

  // Record delivery attempt
  await webhookService.recordDelivery(webhookId, event, payload, result, attempt);

  if (result.success) {
    console.log(`[Webhook] Delivery successful for ${webhookId} (${result.duration}ms)`);
    return;
  }

  console.log(`[Webhook] Delivery failed for ${webhookId}: ${result.error}`);

  // Handle failure
  await webhookService.handleFailure(webhookId);

  // Schedule retry if not at max attempts
  if (attempt < MAX_RETRY_ATTEMPTS) {
    const scheduled = await webhookDispatcher.scheduleRetry(
      webhookId,
      organizationId,
      event,
      payload,
      attempt
    );

    if (scheduled) {
      const delay = webhookService.getRetryDelay(attempt);
      console.log(`[Webhook] Scheduled retry ${attempt + 1} for ${webhookId} in ${delay}ms`);
    }
  } else {
    console.log(`[Webhook] Max retries reached for ${webhookId}, marking as failed`);
  }
}

/**
 * Create and start the webhook worker
 */
export function createWebhookWorker(): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>(
    'webhook',
    async (job) => {
      await processWebhookJob(job);
    },
    {
      connection: {
        host: config.redis?.host || 'localhost',
        port: config.redis?.port || 6379,
        password: config.redis?.password,
      },
      concurrency: 10, // Process up to 10 webhooks concurrently
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Webhook] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Webhook] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Webhook] Worker error:', err);
  });

  console.log('[Webhook] Worker started');

  return worker;
}

export default createWebhookWorker;
