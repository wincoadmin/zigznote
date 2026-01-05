/**
 * StripeProvider Tests
 */

import { StripeProvider } from './StripeProvider';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({
        id: 'cus_test',
        email: 'test@example.com',
        name: 'Test User',
        metadata: { organizationId: 'org_123' },
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'cus_test',
        email: 'test@example.com',
        name: 'Test User',
        metadata: {},
        deleted: false,
        invoice_settings: { default_payment_method: 'pm_default' },
      }),
      update: jest.fn().mockResolvedValue({
        id: 'cus_test',
        email: 'updated@example.com',
        name: 'Updated User',
        metadata: {},
      }),
      del: jest.fn().mockResolvedValue({ deleted: true }),
    },
    paymentMethods: {
      list: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'pm_1',
            card: { last4: '4242', brand: 'visa', exp_month: 12, exp_year: 2025 },
          },
        ],
      }),
      attach: jest.fn().mockResolvedValue({
        id: 'pm_new',
        card: { last4: '5555', brand: 'mastercard', exp_month: 6, exp_year: 2026 },
      }),
      detach: jest.fn().mockResolvedValue({ id: 'pm_1' }),
    },
    products: {
      create: jest.fn().mockResolvedValue({
        id: 'prod_test',
        name: 'Test Product',
      }),
    },
    prices: {
      create: jest.fn().mockResolvedValue({
        id: 'price_test',
        unit_amount: 2900,
        currency: 'usd',
        recurring: { interval: 'month' },
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'price_test',
        unit_amount: 2900,
        currency: 'usd',
        recurring: { interval: 'month' },
        product: {
          name: 'Pro Plan',
          description: 'Pro features',
          metadata: { features: '["Feature 1"]' },
        },
      }),
      list: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'price_1',
            unit_amount: 2900,
            currency: 'usd',
            recurring: { interval: 'month' },
            product: { name: 'Pro', deleted: false, metadata: {} },
          },
        ],
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({
        id: 'sub_test',
        customer: 'cus_test',
        status: 'active',
        current_period_start: Date.now() / 1000,
        current_period_end: Date.now() / 1000 + 30 * 24 * 3600,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: 'price_test' } }] },
        metadata: {},
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'sub_test',
        customer: 'cus_test',
        status: 'active',
        current_period_start: Date.now() / 1000,
        current_period_end: Date.now() / 1000 + 30 * 24 * 3600,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: 'price_test' } }] },
        metadata: {},
      }),
      list: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active',
            current_period_start: Date.now() / 1000,
            current_period_end: Date.now() / 1000 + 30 * 24 * 3600,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_test' } }] },
            metadata: {},
          },
        ],
      }),
      update: jest.fn().mockResolvedValue({
        id: 'sub_test',
        status: 'active',
        cancel_at_period_end: true,
        current_period_start: Date.now() / 1000,
        current_period_end: Date.now() / 1000 + 30 * 24 * 3600,
        items: { data: [{ price: { id: 'price_test' } }] },
        customer: 'cus_test',
        metadata: {},
      }),
      cancel: jest.fn().mockResolvedValue({
        id: 'sub_test',
        status: 'canceled',
        cancel_at_period_end: false,
        current_period_start: Date.now() / 1000,
        current_period_end: Date.now() / 1000,
        items: { data: [{ price: { id: 'price_test' } }] },
        customer: 'cus_test',
        metadata: {},
      }),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test',
        customer: 'cus_test',
        amount: 2900,
        currency: 'usd',
        status: 'succeeded',
        created: Date.now() / 1000,
        metadata: {},
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test',
        customer: 'cus_test',
        amount: 2900,
        currency: 'usd',
        status: 'succeeded',
        created: Date.now() / 1000,
        metadata: {},
      }),
      list: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'pi_test',
            customer: 'cus_test',
            amount: 2900,
            currency: 'usd',
            status: 'succeeded',
            created: Date.now() / 1000,
            metadata: {},
          },
        ],
      }),
    },
    invoices: {
      retrieve: jest.fn().mockResolvedValue({
        id: 'inv_test',
        customer: 'cus_test',
        total: 2900,
        amount_paid: 2900,
        currency: 'usd',
        status: 'paid',
        created: Date.now() / 1000,
        lines: { data: [] },
        status_transitions: { paid_at: Date.now() / 1000 },
      }),
      list: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'inv_test',
            customer: 'cus_test',
            total: 2900,
            amount_paid: 2900,
            currency: 'usd',
            status: 'paid',
            created: Date.now() / 1000,
            lines: { data: [] },
          },
        ],
      }),
      retrieveUpcoming: jest.fn().mockResolvedValue({
        id: 'inv_upcoming',
        customer: 'cus_test',
        total: 2900,
        amount_paid: 0,
        currency: 'usd',
        status: 'draft',
        created: Date.now() / 1000,
        lines: { data: [] },
      }),
    },
    refunds: {
      create: jest.fn().mockResolvedValue({
        id: 'ref_test',
        payment_intent: 'pi_test',
        amount: 2900,
        currency: 'usd',
        status: 'succeeded',
        created: Date.now() / 1000,
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'ref_test',
        payment_intent: 'pi_test',
        amount: 2900,
        currency: 'usd',
        status: 'succeeded',
        created: Date.now() / 1000,
      }),
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test',
          url: 'https://checkout.stripe.com/test',
          expires_at: Date.now() / 1000 + 3600,
        }),
      },
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        id: 'evt_test',
        type: 'invoice.paid',
        data: { object: {} },
        created: Date.now() / 1000,
      }),
    },
  }));
});

describe('StripeProvider', () => {
  let provider: StripeProvider;

  beforeEach(() => {
    provider = new StripeProvider();
    provider.initialize({
      apiKey: 'sk_test_mock',
      webhookSecret: 'whsec_test',
    });
  });

  describe('initialization', () => {
    it('should have correct type and name', () => {
      expect(provider.type).toBe('stripe');
      expect(provider.name).toBe('Stripe');
    });
  });

  describe('createCustomer', () => {
    it('should create customer successfully', async () => {
      const result = await provider.createCustomer({
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org_123',
      });

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe('test@example.com');
    });
  });

  describe('getCustomer', () => {
    it('should retrieve customer successfully', async () => {
      const result = await provider.getCustomer('cus_test');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('cus_test');
    });
  });

  describe('updateCustomer', () => {
    it('should update customer successfully', async () => {
      const result = await provider.updateCustomer('cus_test', {
        email: 'updated@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe('updated@example.com');
    });
  });

  describe('deleteCustomer', () => {
    it('should delete customer successfully', async () => {
      const result = await provider.deleteCustomer('cus_test');

      expect(result.success).toBe(true);
    });
  });

  describe('getPaymentMethods', () => {
    it('should list payment methods', async () => {
      const result = await provider.getPaymentMethods('cus_test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].last4).toBe('4242');
    });
  });

  describe('attachPaymentMethod', () => {
    it('should attach payment method', async () => {
      const result = await provider.attachPaymentMethod('cus_test', 'pm_new');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('pm_new');
    });
  });

  describe('createPlan', () => {
    it('should create plan with product and price', async () => {
      const result = await provider.createPlan({
        name: 'Pro Plan',
        description: 'Pro features',
        amount: 2900,
        currency: 'usd',
        interval: 'month',
        features: ['Feature 1', 'Feature 2'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(2900);
    });
  });

  describe('getPlan', () => {
    it('should retrieve plan details', async () => {
      const result = await provider.getPlan('price_test');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Pro Plan');
    });
  });

  describe('listPlans', () => {
    it('should list all active plans', async () => {
      const result = await provider.listPlans();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('createSubscription', () => {
    it('should create subscription', async () => {
      const result = await provider.createSubscription({
        customerId: 'cus_test',
        planId: 'price_test',
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('active');
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription', async () => {
      const result = await provider.getSubscription('sub_test');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('sub_test');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const result = await provider.cancelSubscription('sub_test', false);

      expect(result.success).toBe(true);
      expect(result.data?.cancelAtPeriodEnd).toBe(true);
    });

    it('should cancel subscription immediately', async () => {
      const result = await provider.cancelSubscription('sub_test', true);

      expect(result.success).toBe(true);
    });
  });

  describe('resumeSubscription', () => {
    it('should resume cancelled subscription', async () => {
      const result = await provider.resumeSubscription('sub_test');

      expect(result.success).toBe(true);
    });
  });

  describe('createPayment', () => {
    it('should create payment intent', async () => {
      const result = await provider.createPayment({
        customerId: 'cus_test',
        amount: 2900,
        currency: 'usd',
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('succeeded');
    });
  });

  describe('getInvoice', () => {
    it('should retrieve invoice', async () => {
      const result = await provider.getInvoice('inv_test');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('paid');
    });
  });

  describe('listInvoices', () => {
    it('should list customer invoices', async () => {
      const result = await provider.listInvoices('cus_test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getUpcomingInvoice', () => {
    it('should get upcoming invoice', async () => {
      const result = await provider.getUpcomingInvoice('cus_test');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('draft');
    });
  });

  describe('createRefund', () => {
    it('should create refund', async () => {
      const result = await provider.createRefund({
        paymentId: 'pi_test',
        amount: 2900,
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('succeeded');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session', async () => {
      const result = await provider.createCheckoutSession({
        customerId: 'cus_test',
        planId: 'price_test',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.success).toBe(true);
      expect(result.data?.url).toContain('checkout.stripe.com');
    });
  });

  describe('constructWebhookEvent', () => {
    it('should construct webhook event', async () => {
      const result = await provider.constructWebhookEvent(
        '{"test": true}',
        'sig_test'
      );

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('invoice.paid');
    });
  });

  describe('formatAmount', () => {
    it('should format amount correctly', () => {
      expect(provider.formatAmount(2900, 'usd')).toBe('$29.00');
      expect(provider.formatAmount(100, 'usd')).toBe('$1.00');
    });
  });
});
