/**
 * WebhookService
 * Manages webhook CRUD, signature generation, and delivery
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import {
  WebhookConfig,
  WebhookDelivery,
  WebhookEvent,
  WebhookPayload,
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookDeliveryResult,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAYS,
} from './types';

export class WebhookService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a secure webhook secret
   */
  private generateSecret(): string {
    return `whsec_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Generate HMAC-SHA256 signature for payload
   */
  generateSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: string,
    signature: string,
    secret: string,
    tolerance: number = 300
  ): boolean {
    const parts = signature.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signaturePart = parts.find((p) => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const timestamp = parseInt(timestampPart.slice(2), 10);
    const expectedSignature = signaturePart.slice(3);

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > tolerance) {
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(computedSignature)
    );
  }

  /**
   * Create a new webhook
   */
  async createWebhook(
    organizationId: string,
    input: CreateWebhookInput
  ): Promise<WebhookConfig> {
    const secret = this.generateSecret();

    const webhook = await this.prisma.webhook.create({
      data: {
        organizationId,
        name: input.name,
        url: input.url,
        secret,
        events: input.events,
        headers: input.headers || {},
        status: 'active',
        failureCount: 0,
      },
    });

    return this.mapToWebhookConfig(webhook);
  }

  /**
   * Get all webhooks for an organization
   */
  async getWebhooks(organizationId: string): Promise<WebhookConfig[]> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map((w) => this.mapToWebhookConfig(w));
  }

  /**
   * Get a single webhook
   */
  async getWebhook(
    organizationId: string,
    webhookId: string
  ): Promise<WebhookConfig | null> {
    const webhook = await this.prisma.webhook.findFirst({
      where: {
        id: webhookId,
        organizationId,
      },
    });

    return webhook ? this.mapToWebhookConfig(webhook) : null;
  }

  /**
   * Update a webhook
   */
  async updateWebhook(
    organizationId: string,
    webhookId: string,
    input: UpdateWebhookInput
  ): Promise<WebhookConfig | null> {
    const existing = await this.prisma.webhook.findFirst({
      where: {
        id: webhookId,
        organizationId,
      },
    });

    if (!existing) {
      return null;
    }

    const webhook = await this.prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.url && { url: input.url }),
        ...(input.events && { events: input.events }),
        ...(input.headers && { headers: input.headers }),
        ...(input.status && { status: input.status }),
        // Reset failure count when re-activating
        ...(input.status === 'active' && { failureCount: 0 }),
      },
    });

    return this.mapToWebhookConfig(webhook);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(organizationId: string, webhookId: string): Promise<boolean> {
    const existing = await this.prisma.webhook.findFirst({
      where: {
        id: webhookId,
        organizationId,
      },
    });

    if (!existing) {
      return false;
    }

    await this.prisma.webhook.delete({
      where: { id: webhookId },
    });

    return true;
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(
    organizationId: string,
    webhookId: string
  ): Promise<string | null> {
    const existing = await this.prisma.webhook.findFirst({
      where: {
        id: webhookId,
        organizationId,
      },
    });

    if (!existing) {
      return null;
    }

    const newSecret = this.generateSecret();

    await this.prisma.webhook.update({
      where: { id: webhookId },
      data: { secret: newSecret },
    });

    return newSecret;
  }

  /**
   * Get webhooks subscribed to an event
   */
  async getWebhooksForEvent(
    organizationId: string,
    event: WebhookEvent
  ): Promise<WebhookConfig[]> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        organizationId,
        status: 'active',
        events: { has: event },
      },
    });

    return webhooks.map((w) => this.mapToWebhookConfig(w));
  }

  /**
   * Deliver webhook payload
   */
  async deliver(
    webhook: WebhookConfig,
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<WebhookDeliveryResult> {
    const deliveryId = crypto.randomUUID();
    const payload: WebhookPayload = {
      id: deliveryId,
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString, webhook.secret);

    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Id': webhook.id,
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'User-Agent': 'zigznote-webhook/1.0',
        ...webhook.headers,
      };

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const duration = Date.now() - startTime;
      const responseBody = await response.text();

      if (response.ok) {
        // Reset failure count on success
        await this.prisma.webhook.update({
          where: { id: webhook.id },
          data: {
            failureCount: 0,
            lastTriggeredAt: new Date(),
          },
        });

        return {
          success: true,
          statusCode: response.status,
          responseBody: responseBody.substring(0, 1000), // Limit stored response
          duration,
        };
      } else {
        return {
          success: false,
          statusCode: response.status,
          responseBody: responseBody.substring(0, 1000),
          error: `HTTP ${response.status}: ${response.statusText}`,
          duration,
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Record delivery attempt
   */
  async recordDelivery(
    webhookId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
    result: WebhookDeliveryResult,
    attempt: number
  ): Promise<WebhookDelivery> {
    const delivery = await this.prisma.webhookDelivery.upsert({
      where: {
        id: `${webhookId}-${payload.id || crypto.randomUUID()}`,
      },
      create: {
        id: `${webhookId}-${payload.id || crypto.randomUUID()}`,
        webhookId,
        event,
        payload,
        status: result.success ? 'success' : attempt >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
        attempts: attempt,
        lastAttemptAt: new Date(),
        responseStatus: result.statusCode,
        responseBody: result.responseBody,
        error: result.error,
      },
      update: {
        status: result.success ? 'success' : attempt >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
        attempts: attempt,
        lastAttemptAt: new Date(),
        responseStatus: result.statusCode,
        responseBody: result.responseBody,
        error: result.error,
      },
    });

    return this.mapToWebhookDelivery(delivery);
  }

  /**
   * Handle webhook failure
   */
  async handleFailure(webhookId: string): Promise<void> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) return;

    const newFailureCount = webhook.failureCount + 1;

    // Disable webhook after too many consecutive failures
    if (newFailureCount >= 10) {
      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: {
          status: 'failed',
          failureCount: newFailureCount,
        },
      });
    } else {
      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: { failureCount: newFailureCount },
      });
    }
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveries(
    webhookId: string,
    limit: number = 50
  ): Promise<WebhookDelivery[]> {
    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return deliveries.map((d) => this.mapToWebhookDelivery(d));
  }

  /**
   * Get retry delay for attempt number
   */
  getRetryDelay(attempt: number): number {
    return RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
  }

  /**
   * Map database record to WebhookConfig
   */
  private mapToWebhookConfig(webhook: {
    id: string;
    organizationId: string;
    name: string;
    url: string;
    secret: string;
    events: string[];
    status: string;
    headers: unknown;
    createdAt: Date;
    updatedAt: Date;
    lastTriggeredAt: Date | null;
    failureCount: number;
  }): WebhookConfig {
    return {
      id: webhook.id,
      organizationId: webhook.organizationId,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events as WebhookEvent[],
      status: webhook.status as 'active' | 'inactive' | 'failed',
      headers: webhook.headers as Record<string, string>,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      lastTriggeredAt: webhook.lastTriggeredAt || undefined,
      failureCount: webhook.failureCount,
    };
  }

  /**
   * Map database record to WebhookDelivery
   */
  private mapToWebhookDelivery(delivery: {
    id: string;
    webhookId: string;
    event: string;
    payload: unknown;
    status: string;
    attempts: number;
    lastAttemptAt: Date | null;
    responseStatus: number | null;
    responseBody: string | null;
    error: string | null;
    createdAt: Date;
  }): WebhookDelivery {
    return {
      id: delivery.id,
      webhookId: delivery.webhookId,
      event: delivery.event as WebhookEvent,
      payload: delivery.payload as Record<string, unknown>,
      status: delivery.status as 'pending' | 'success' | 'failed',
      attempts: delivery.attempts,
      lastAttemptAt: delivery.lastAttemptAt || undefined,
      responseStatus: delivery.responseStatus || undefined,
      responseBody: delivery.responseBody || undefined,
      error: delivery.error || undefined,
      createdAt: delivery.createdAt,
    };
  }
}
