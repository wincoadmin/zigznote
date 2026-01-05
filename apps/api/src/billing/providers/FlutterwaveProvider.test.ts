/**
 * FlutterwaveProvider Tests
 */

import { FlutterwaveProvider } from './FlutterwaveProvider';

describe('FlutterwaveProvider', () => {
  let provider: FlutterwaveProvider;

  beforeEach(() => {
    provider = new FlutterwaveProvider();
    provider.initialize({
      apiKey: 'FLWPUBK_test',
      secretKey: 'FLWSECK_test',
      webhookSecret: 'flw_webhook_test',
    });
    global.fetch = jest.fn();
  });

  describe('initialization', () => {
    it('should have correct type and name', () => {
      expect(provider.type).toBe('flutterwave');
      expect(provider.name).toBe('Flutterwave');
    });
  });

  describe('createCustomer', () => {
    it('should create customer with local ID', async () => {
      const result = await provider.createCustomer({
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org_123',
      });

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe('test@example.com');
      expect(result.data?.id).toMatch(/^flw_cus_/);
    });
  });

  describe('createPlan', () => {
    it('should create payment plan via API', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'success',
            data: {
              id: 12345,
              name: 'Pro Plan',
              amount: 29,
              interval: 'monthly',
              currency: 'USD',
              plan_token: 'pt_test',
              status: 'active',
              created_at: new Date().toISOString(),
            },
          }),
      });

      const result = await provider.createPlan({
        name: 'Pro Plan',
        amount: 2900,
        currency: 'usd',
        interval: 'month',
        features: ['Feature 1'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Pro Plan');
      expect(result.data?.amount).toBe(2900);
    });

    it('should handle API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            status: 'error',
            message: 'Invalid currency',
          }),
      });

      const result = await provider.createPlan({
        name: 'Pro Plan',
        amount: 2900,
        currency: 'usd',
        interval: 'month',
        features: [],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('getPlan', () => {
    it('should retrieve plan details', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'success',
            data: {
              id: 12345,
              name: 'Pro Plan',
              amount: 29,
              interval: 'monthly',
              currency: 'USD',
              plan_token: 'pt_test',
              status: 'active',
            },
          }),
      });

      const result = await provider.getPlan('12345');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Pro Plan');
    });
  });

  describe('listPlans', () => {
    it('should list all plans', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'success',
            data: [
              {
                id: 12345,
                name: 'Pro',
                amount: 29,
                interval: 'monthly',
                currency: 'USD',
                plan_token: 'pt_1',
                status: 'active',
              },
              {
                id: 12346,
                name: 'Enterprise',
                amount: 99,
                interval: 'monthly',
                currency: 'USD',
                plan_token: 'pt_2',
                status: 'active',
              },
            ],
          }),
      });

      const result = await provider.listPlans();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'success',
            message: 'Subscription cancelled',
          }),
      });

      const result = await provider.cancelSubscription('sub_123');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('cancelled');
    });
  });

  describe('createPayment', () => {
    it('should create payment and return payment link', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'success',
            data: {
              link: 'https://checkout.flutterwave.com/pay/abc123',
            },
          }),
      });

      const result = await provider.createPayment({
        customerId: 'flw_cus_123',
        amount: 2900,
        currency: 'usd',
        description: 'Test payment',
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('pending');
      expect(result.data?.metadata?.payment_link).toContain('flutterwave.com');
    });
  });

  describe('getPayment', () => {
    it('should verify payment status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'success',
            data: {
              id: 123456,
              tx_ref: 'zigznote_123',
              flw_ref: 'FLW-123',
              amount: 29,
              currency: 'USD',
              status: 'successful',
              payment_type: 'card',
              created_at: new Date().toISOString(),
              customer: { id: 1, email: 'test@example.com' },
            },
          }),
      });

      const result = await provider.getPayment('zigznote_123');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('succeeded');
    });
  });

  describe('createRefund', () => {
    it('should create refund', async () => {
      // First mock for getPayment
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              status: 'success',
              data: {
                id: 123,
                tx_ref: 'tx_123',
                flw_ref: 'FLW-123',
                amount: 29,
                currency: 'USD',
                status: 'successful',
                customer: { id: 1, email: 'test@example.com' },
                created_at: new Date().toISOString(),
              },
            }),
        })
        // Then mock for refund
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              status: 'success',
              data: {
                id: 456,
                status: 'completed',
              },
            }),
        });

      const result = await provider.createRefund({
        paymentId: 'tx_123',
        amount: 2900,
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('succeeded');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session with payment link', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'success',
            data: {
              link: 'https://checkout.flutterwave.com/pay/session123',
            },
          }),
      });

      const result = await provider.createCheckoutSession({
        customerId: 'flw_cus_123',
        planId: '12345',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.success).toBe(true);
      expect(result.data?.url).toContain('flutterwave.com');
    });
  });

  describe('constructWebhookEvent', () => {
    it('should verify valid webhook signature', async () => {
      const crypto = require('crypto');
      const payload = JSON.stringify({ event: 'charge.completed', data: {} });
      const hash = crypto
        .createHmac('sha256', 'flw_webhook_test')
        .update(payload)
        .digest('hex');

      const result = await provider.constructWebhookEvent(payload, hash);

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('charge.completed');
    });

    it('should reject invalid signature', async () => {
      const payload = JSON.stringify({ event: 'charge.completed', data: {} });

      const result = await provider.constructWebhookEvent(payload, 'invalid_sig');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid webhook signature');
    });
  });

  describe('formatAmount', () => {
    it('should format African currencies correctly', () => {
      expect(provider.formatAmount(100000, 'NGN')).toBe('₦1,000.00');
      expect(provider.formatAmount(100000, 'KES')).toBe('KSh1,000.00');
      expect(provider.formatAmount(100000, 'GHS')).toBe('GH₵1,000.00');
      expect(provider.formatAmount(100000, 'ZAR')).toBe('R1,000.00');
    });

    it('should format standard currencies', () => {
      expect(provider.formatAmount(2900, 'USD')).toBe('$29.00');
      expect(provider.formatAmount(2900, 'EUR')).toBe('€29.00');
      expect(provider.formatAmount(2900, 'GBP')).toBe('£29.00');
    });
  });

  describe('unsupported operations', () => {
    it('should return error for attach payment method', async () => {
      const result = await provider.attachPaymentMethod('cus_123', 'pm_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support');
    });

    it('should return error for get invoice', async () => {
      const result = await provider.getInvoice('inv_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support invoices');
    });

    it('should return empty for get payment methods', async () => {
      const result = await provider.getPaymentMethods('cus_123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});
