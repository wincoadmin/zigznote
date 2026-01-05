/**
 * WebhookService Tests
 */

import { WebhookService } from './WebhookService';
import { WebhookEvent, MAX_RETRY_ATTEMPTS } from './types';

// Mock PrismaClient
const mockPrisma = {
  webhook: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  webhookDelivery: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhookService(mockPrisma as any);
  });

  describe('generateSignature', () => {
    it('should generate valid HMAC-SHA256 signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'whsec_test_secret';

      const signature = service.generateSignature(payload, secret);

      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'whsec_test_secret';

      const sig1 = service.generateSignature('payload1', secret);
      const sig2 = service.generateSignature('payload2', secret);

      const v1_1 = sig1.split(',')[1];
      const v1_2 = sig2.split(',')[1];

      expect(v1_1).not.toBe(v1_2);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'whsec_test_secret';

      const signature = service.generateSignature(payload, secret);
      const isValid = service.verifySignature(payload, signature, secret, 5); // 5 second tolerance

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'whsec_test_secret';
      const wrongSecret = 'whsec_wrong_secret';

      const signature = service.generateSignature(payload, secret);
      const isValid = service.verifySignature(payload, signature, wrongSecret);

      expect(isValid).toBe(false);
    });

    it('should reject expired signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'whsec_test_secret';

      // Create signature with old timestamp
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
      const signature = `t=${oldTimestamp},v1=invalid`;

      const isValid = service.verifySignature(payload, signature, secret, 300);

      expect(isValid).toBe(false);
    });

    it('should reject malformed signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'whsec_test_secret';

      expect(service.verifySignature(payload, 'invalid', secret)).toBe(false);
      expect(service.verifySignature(payload, 't=123', secret)).toBe(false);
      expect(service.verifySignature(payload, 'v1=abc', secret)).toBe(false);
    });
  });

  describe('createWebhook', () => {
    it('should create webhook with generated secret', async () => {
      const organizationId = 'org_123';
      const input = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['meeting.completed'] as WebhookEvent[],
      };

      const createdWebhook = {
        id: 'wh_123',
        organizationId,
        ...input,
        secret: 'whsec_generated',
        status: 'active',
        headers: {},
        failureCount: 0,
        lastTriggeredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.webhook.create.mockResolvedValue(createdWebhook);

      const result = await service.createWebhook(organizationId, input);

      expect(mockPrisma.webhook.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId,
          name: input.name,
          url: input.url,
          events: input.events,
          secret: expect.stringMatching(/^whsec_[a-f0-9]{64}$/),
          status: 'active',
          failureCount: 0,
        }),
      });

      expect(result.id).toBe('wh_123');
      expect(result.name).toBe('Test Webhook');
    });
  });

  describe('getWebhooks', () => {
    it('should return all webhooks for organization', async () => {
      const organizationId = 'org_123';
      const webhooks = [
        {
          id: 'wh_1',
          organizationId,
          name: 'Webhook 1',
          url: 'https://example.com/1',
          secret: 'whsec_secret1',
          events: ['meeting.completed'],
          status: 'active',
          headers: {},
          failureCount: 0,
          lastTriggeredAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'wh_2',
          organizationId,
          name: 'Webhook 2',
          url: 'https://example.com/2',
          secret: 'whsec_secret2',
          events: ['summary.ready'],
          status: 'active',
          headers: {},
          failureCount: 0,
          lastTriggeredAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.webhook.findMany.mockResolvedValue(webhooks);

      const result = await service.getWebhooks(organizationId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Webhook 1');
      expect(result[1].name).toBe('Webhook 2');
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook properties', async () => {
      const organizationId = 'org_123';
      const webhookId = 'wh_123';

      mockPrisma.webhook.findFirst.mockResolvedValue({
        id: webhookId,
        organizationId,
      });

      mockPrisma.webhook.update.mockResolvedValue({
        id: webhookId,
        organizationId,
        name: 'Updated Name',
        url: 'https://updated.com/webhook',
        secret: 'whsec_secret',
        events: ['meeting.completed'],
        status: 'active',
        headers: {},
        failureCount: 0,
        lastTriggeredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateWebhook(organizationId, webhookId, {
        name: 'Updated Name',
        url: 'https://updated.com/webhook',
      });

      expect(result?.name).toBe('Updated Name');
    });

    it('should return null for non-existent webhook', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue(null);

      const result = await service.updateWebhook('org_123', 'wh_nonexistent', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });

    it('should reset failure count when reactivating', async () => {
      const organizationId = 'org_123';
      const webhookId = 'wh_123';

      mockPrisma.webhook.findFirst.mockResolvedValue({
        id: webhookId,
        organizationId,
        failureCount: 5,
        status: 'failed',
      });

      mockPrisma.webhook.update.mockResolvedValue({
        id: webhookId,
        organizationId,
        name: 'Webhook',
        url: 'https://example.com',
        secret: 'whsec_secret',
        events: ['meeting.completed'],
        status: 'active',
        headers: {},
        failureCount: 0,
        lastTriggeredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updateWebhook(organizationId, webhookId, { status: 'active' });

      expect(mockPrisma.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'active',
            failureCount: 0,
          }),
        })
      );
    });
  });

  describe('deleteWebhook', () => {
    it('should delete existing webhook', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue({ id: 'wh_123' });
      mockPrisma.webhook.delete.mockResolvedValue({});

      const result = await service.deleteWebhook('org_123', 'wh_123');

      expect(result).toBe(true);
      expect(mockPrisma.webhook.delete).toHaveBeenCalledWith({
        where: { id: 'wh_123' },
      });
    });

    it('should return false for non-existent webhook', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue(null);

      const result = await service.deleteWebhook('org_123', 'wh_nonexistent');

      expect(result).toBe(false);
      expect(mockPrisma.webhook.delete).not.toHaveBeenCalled();
    });
  });

  describe('regenerateSecret', () => {
    it('should generate new secret for webhook', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue({ id: 'wh_123' });
      mockPrisma.webhook.update.mockResolvedValue({});

      const newSecret = await service.regenerateSecret('org_123', 'wh_123');

      expect(newSecret).toMatch(/^whsec_[a-f0-9]{64}$/);
      expect(mockPrisma.webhook.update).toHaveBeenCalledWith({
        where: { id: 'wh_123' },
        data: { secret: newSecret },
      });
    });

    it('should return null for non-existent webhook', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue(null);

      const result = await service.regenerateSecret('org_123', 'wh_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getWebhooksForEvent', () => {
    it('should return only active webhooks subscribed to event', async () => {
      const webhooks = [
        {
          id: 'wh_1',
          organizationId: 'org_123',
          name: 'Webhook 1',
          url: 'https://example.com/1',
          secret: 'whsec_secret',
          events: ['meeting.completed', 'summary.ready'],
          status: 'active',
          headers: {},
          failureCount: 0,
          lastTriggeredAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.webhook.findMany.mockResolvedValue(webhooks);

      const result = await service.getWebhooksForEvent('org_123', 'meeting.completed');

      expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org_123',
          status: 'active',
          events: { has: 'meeting.completed' },
        },
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('deliver', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('should successfully deliver webhook', async () => {
      const webhook = {
        id: 'wh_123',
        organizationId: 'org_123',
        name: 'Test',
        url: 'https://example.com/webhook',
        secret: 'whsec_test',
        events: ['meeting.completed'] as WebhookEvent[],
        status: 'active' as const,
        failureCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });

      mockPrisma.webhook.update.mockResolvedValue({});

      const result = await service.deliver(webhook, 'meeting.completed', { test: true });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Id': 'wh_123',
            'X-Webhook-Event': 'meeting.completed',
            'X-Webhook-Signature': expect.any(String),
          }),
        })
      );
    });

    it('should handle delivery failure', async () => {
      const webhook = {
        id: 'wh_123',
        organizationId: 'org_123',
        name: 'Test',
        url: 'https://example.com/webhook',
        secret: 'whsec_test',
        events: ['meeting.completed'] as WebhookEvent[],
        status: 'active' as const,
        failureCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Error'),
      });

      const result = await service.deliver(webhook, 'meeting.completed', { test: true });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain('HTTP 500');
    });

    it('should handle network errors', async () => {
      const webhook = {
        id: 'wh_123',
        organizationId: 'org_123',
        name: 'Test',
        url: 'https://example.com/webhook',
        secret: 'whsec_test',
        events: ['meeting.completed'] as WebhookEvent[],
        status: 'active' as const,
        failureCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.deliver(webhook, 'meeting.completed', { test: true });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('handleFailure', () => {
    it('should increment failure count', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue({
        id: 'wh_123',
        failureCount: 3,
      });

      await service.handleFailure('wh_123');

      expect(mockPrisma.webhook.update).toHaveBeenCalledWith({
        where: { id: 'wh_123' },
        data: { failureCount: 4 },
      });
    });

    it('should disable webhook after 10 failures', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue({
        id: 'wh_123',
        failureCount: 9,
      });

      await service.handleFailure('wh_123');

      expect(mockPrisma.webhook.update).toHaveBeenCalledWith({
        where: { id: 'wh_123' },
        data: {
          status: 'failed',
          failureCount: 10,
        },
      });
    });
  });

  describe('getRetryDelay', () => {
    it('should return correct delays for each attempt', () => {
      expect(service.getRetryDelay(1)).toBe(1000); // 1 second
      expect(service.getRetryDelay(2)).toBe(5000); // 5 seconds
      expect(service.getRetryDelay(3)).toBe(30000); // 30 seconds
      expect(service.getRetryDelay(4)).toBe(300000); // 5 minutes
      expect(service.getRetryDelay(5)).toBe(3600000); // 1 hour
    });

    it('should cap at max delay for attempts beyond limit', () => {
      expect(service.getRetryDelay(10)).toBe(3600000); // 1 hour (max)
    });
  });

  describe('recordDelivery', () => {
    it('should record successful delivery', async () => {
      const delivery = {
        id: 'del_123',
        webhookId: 'wh_123',
        event: 'meeting.completed',
        payload: { test: true },
        status: 'success',
        attempts: 1,
        lastAttemptAt: new Date(),
        responseStatus: 200,
        responseBody: 'OK',
        error: null,
        createdAt: new Date(),
      };

      mockPrisma.webhookDelivery.upsert.mockResolvedValue(delivery);

      const result = await service.recordDelivery(
        'wh_123',
        'meeting.completed',
        { test: true },
        { success: true, statusCode: 200, duration: 100 },
        1
      );

      expect(result.status).toBe('success');
    });

    it('should mark as failed after max attempts', async () => {
      const delivery = {
        id: 'del_123',
        webhookId: 'wh_123',
        event: 'meeting.completed',
        payload: { test: true },
        status: 'failed',
        attempts: MAX_RETRY_ATTEMPTS,
        lastAttemptAt: new Date(),
        responseStatus: null,
        responseBody: null,
        error: 'Network error',
        createdAt: new Date(),
      };

      mockPrisma.webhookDelivery.upsert.mockResolvedValue(delivery);

      const result = await service.recordDelivery(
        'wh_123',
        'meeting.completed',
        { test: true },
        { success: false, error: 'Network error', duration: 100 },
        MAX_RETRY_ATTEMPTS
      );

      expect(result.status).toBe('failed');
    });
  });
});
