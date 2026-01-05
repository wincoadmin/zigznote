/**
 * WebhookDispatcher
 * Dispatches webhook events to BullMQ for async delivery
 */

import { Queue } from 'bullmq';
import type { PrismaClient } from '@zigznote/database';
import { WebhookService } from './WebhookService';
import { WebhookEvent, MAX_RETRY_ATTEMPTS } from './types';
import { config } from '../../config';

interface WebhookJobData {
  webhookId: string;
  organizationId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  attempt: number;
}

export class WebhookDispatcher {
  private queue: Queue<WebhookJobData>;
  private webhookService: WebhookService;

  constructor(prisma: PrismaClient) {
    this.webhookService = new WebhookService(prisma);
    this.queue = new Queue<WebhookJobData>('webhook', {
      connection: {
        host: config.redis?.host || 'localhost',
        port: config.redis?.port || 6379,
        password: config.redis?.password,
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs for debugging
      },
    });
  }

  /**
   * Dispatch event to all subscribed webhooks
   */
  async dispatch(
    organizationId: string,
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<number> {
    const webhooks = await this.webhookService.getWebhooksForEvent(organizationId, event);

    if (webhooks.length === 0) {
      return 0;
    }

    const jobs = webhooks.map((webhook) => ({
      name: `webhook-${webhook.id}-${event}`,
      data: {
        webhookId: webhook.id,
        organizationId,
        event,
        payload: data,
        attempt: 1,
      },
    }));

    await this.queue.addBulk(jobs);

    return webhooks.length;
  }

  /**
   * Schedule retry for failed webhook
   */
  async scheduleRetry(
    webhookId: string,
    organizationId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
    attempt: number
  ): Promise<boolean> {
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      return false;
    }

    const delay = this.webhookService.getRetryDelay(attempt);

    await this.queue.add(
      `webhook-retry-${webhookId}-${event}`,
      {
        webhookId,
        organizationId,
        event,
        payload,
        attempt: attempt + 1,
      },
      { delay }
    );

    return true;
  }

  /**
   * Get queue for worker setup
   */
  getQueue(): Queue<WebhookJobData> {
    return this.queue;
  }

  /**
   * Close queue connection
   */
  async close(): Promise<void> {
    await this.queue.close();
  }
}

export type { WebhookJobData };
