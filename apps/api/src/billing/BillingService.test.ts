/**
 * BillingService Tests
 */

import { BillingService } from './BillingService';

// Mock the providers module
jest.mock('./providers', () => ({
  createPaymentProvider: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    createCustomer: jest.fn().mockResolvedValue({
      success: true,
      data: { id: 'cus_mock', providerId: 'cus_mock', email: 'test@example.com' },
    }),
    createSubscription: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'sub_mock',
        providerId: 'sub_mock',
        customerId: 'cus_mock',
        planId: 'price_mock',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
      },
    }),
    cancelSubscription: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'sub_mock',
        status: 'cancelled',
        cancelAtPeriodEnd: true,
      },
    }),
    resumeSubscription: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'sub_mock',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
    }),
    createCheckoutSession: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'cs_mock',
        url: 'https://checkout.stripe.com/session',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    }),
    constructWebhookEvent: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'evt_mock',
        type: 'invoice.paid',
        data: {},
        provider: 'stripe',
        timestamp: new Date(),
      },
    }),
  })),
}));

// Mock config
jest.mock('../config', () => ({
  config: {
    stripe: {
      secretKey: 'sk_test_mock',
      webhookSecret: 'whsec_mock',
    },
    flutterwave: {
      publicKey: 'FLWPUBK_mock',
      secretKey: 'FLWSECK_mock',
      webhookSecret: 'flw_whsec_mock',
    },
    webUrl: 'http://localhost:3000',
  },
}));

const mockPrisma = {
  billingCustomer: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  billingPlan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  subscription: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    findMany: jest.fn(),
  },
  invoice: {
    findMany: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingService(mockPrisma as any);
  });

  describe('getOrCreateCustomer', () => {
    it('should return existing customer', async () => {
      const existingCustomer = {
        id: 'bc_123',
        organizationId: 'org_123',
        email: 'existing@example.com',
        name: 'Existing Customer',
        defaultProvider: 'stripe',
      };

      mockPrisma.billingCustomer.findUnique.mockResolvedValue(existingCustomer);

      const result = await service.getOrCreateCustomer(
        'org_123',
        'new@example.com',
        'New Name'
      );

      expect(result.id).toBe('bc_123');
      expect(result.email).toBe('existing@example.com');
      expect(mockPrisma.billingCustomer.create).not.toHaveBeenCalled();
    });

    it('should create new customer if not exists', async () => {
      mockPrisma.billingCustomer.findUnique.mockResolvedValue(null);
      mockPrisma.billingCustomer.create.mockResolvedValue({
        id: 'bc_new',
        organizationId: 'org_123',
        email: 'new@example.com',
        name: 'New Customer',
        defaultProvider: 'stripe',
        stripeCustomerId: 'cus_mock',
      });

      const result = await service.getOrCreateCustomer(
        'org_123',
        'new@example.com',
        'New Customer'
      );

      expect(result.id).toBe('bc_new');
      expect(mockPrisma.billingCustomer.create).toHaveBeenCalled();
    });
  });

  describe('getPlans', () => {
    it('should return active plans sorted by order', async () => {
      const plans = [
        {
          id: 'plan_1',
          slug: 'free',
          name: 'Free',
          description: 'Free plan',
          amount: 0,
          currency: 'usd',
          interval: 'month',
          trialDays: 0,
          features: ['Feature 1'],
          limits: {},
          isActive: true,
          sortOrder: 0,
        },
        {
          id: 'plan_2',
          slug: 'pro',
          name: 'Pro',
          description: 'Pro plan',
          amount: 2900,
          currency: 'usd',
          interval: 'month',
          trialDays: 14,
          features: ['Feature 1', 'Feature 2'],
          limits: { meetings: 100 },
          isActive: true,
          sortOrder: 1,
        },
      ];

      mockPrisma.billingPlan.findMany.mockResolvedValue(plans);

      const result = await service.getPlans();

      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('free');
      expect(result[1].slug).toBe('pro');
      expect(mockPrisma.billingPlan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    });
  });

  describe('getPlanBySlug', () => {
    it('should return plan by slug', async () => {
      const plan = {
        id: 'plan_1',
        slug: 'pro',
        name: 'Pro',
        description: 'Pro plan',
        amount: 2900,
        currency: 'usd',
        interval: 'month',
        trialDays: 14,
        features: ['Feature 1'],
        limits: {},
      };

      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);

      const result = await service.getPlanBySlug('pro');

      expect(result?.slug).toBe('pro');
      expect(result?.amount).toBe(2900);
    });

    it('should return null for non-existent plan', async () => {
      mockPrisma.billingPlan.findUnique.mockResolvedValue(null);

      const result = await service.getPlanBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      const organization = {
        id: 'org_123',
        name: 'Test Org',
        billingCustomer: {
          id: 'bc_123',
          email: 'org@example.com',
        },
      };

      const plan = {
        id: 'plan_123',
        slug: 'pro',
        name: 'Pro',
        amount: 2900,
        currency: 'usd',
        interval: 'month',
        trialDays: 14,
        stripePriceId: 'price_stripe',
        flutterwavePlan: 'plan_flw',
      };

      const customer = {
        id: 'bc_123',
        organizationId: 'org_123',
        email: 'org@example.com',
        stripeCustomerId: 'cus_stripe',
        defaultProvider: 'stripe',
      };

      mockPrisma.organization.findUnique.mockResolvedValue(organization);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.billingCustomer.findUnique.mockResolvedValue(customer);
      mockPrisma.subscription.create.mockResolvedValue({
        id: 'sub_123',
        customerId: 'bc_123',
        planId: 'plan_123',
        provider: 'stripe',
        providerSubId: 'sub_mock',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      const result = await service.createSubscription({
        organizationId: 'org_123',
        planSlug: 'pro',
      });

      expect(result.status).toBe('active');
      expect(mockPrisma.subscription.create).toHaveBeenCalled();
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org_123' },
        data: { plan: 'pro' },
      });
    });

    it('should throw error for missing organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.createSubscription({
          organizationId: 'nonexistent',
          planSlug: 'pro',
        })
      ).rejects.toThrow('Organization not found');
    });

    it('should throw error for missing plan', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org_123',
        billingCustomer: { email: 'test@example.com' },
      });
      mockPrisma.billingPlan.findUnique.mockResolvedValue(null);

      await expect(
        service.createSubscription({
          organizationId: 'org_123',
          planSlug: 'nonexistent',
        })
      ).rejects.toThrow('Plan not found');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub_123',
        providerSubId: 'sub_provider',
        provider: 'stripe',
      });

      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub_123',
        customerId: 'bc_123',
        planId: 'plan_123',
        provider: 'stripe',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: true,
        cancelledAt: null,
      });

      const result = await service.cancelSubscription('sub_123', false);

      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it('should throw error for non-existent subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.cancelSubscription('nonexistent')).rejects.toThrow(
        'Subscription not found'
      );
    });
  });

  describe('resumeSubscription', () => {
    it('should resume cancelled subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub_123',
        providerSubId: 'sub_provider',
        provider: 'stripe',
        cancelAtPeriodEnd: true,
      });

      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub_123',
        customerId: 'bc_123',
        planId: 'plan_123',
        provider: 'stripe',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      });

      const result = await service.resumeSubscription('sub_123');

      expect(result.cancelAtPeriodEnd).toBe(false);
    });

    it('should throw error if subscription not scheduled for cancellation', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub_123',
        providerSubId: 'sub_provider',
        provider: 'stripe',
        cancelAtPeriodEnd: false,
      });

      await expect(service.resumeSubscription('sub_123')).rejects.toThrow(
        'Subscription is not scheduled for cancellation'
      );
    });
  });

  describe('getSubscription', () => {
    it('should return active subscription for organization', async () => {
      mockPrisma.billingCustomer.findUnique.mockResolvedValue({
        id: 'bc_123',
      });

      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub_123',
        customerId: 'bc_123',
        planId: 'plan_123',
        provider: 'stripe',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      });

      const result = await service.getSubscription('org_123');

      expect(result?.status).toBe('active');
    });

    it('should return null if no customer', async () => {
      mockPrisma.billingCustomer.findUnique.mockResolvedValue(null);

      const result = await service.getSubscription('org_123');

      expect(result).toBeNull();
    });

    it('should return null if no active subscription', async () => {
      mockPrisma.billingCustomer.findUnique.mockResolvedValue({ id: 'bc_123' });
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const result = await service.getSubscription('org_123');

      expect(result).toBeNull();
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history', async () => {
      mockPrisma.billingCustomer.findUnique.mockResolvedValue({ id: 'bc_123' });
      mockPrisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay_1',
          customerId: 'bc_123',
          amount: 2900,
          currency: 'usd',
          status: 'succeeded',
          createdAt: new Date(),
        },
        {
          id: 'pay_2',
          customerId: 'bc_123',
          amount: 2900,
          currency: 'usd',
          status: 'succeeded',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getPaymentHistory('org_123');

      expect(result).toHaveLength(2);
    });

    it('should return empty array if no customer', async () => {
      mockPrisma.billingCustomer.findUnique.mockResolvedValue(null);

      const result = await service.getPaymentHistory('org_123');

      expect(result).toEqual([]);
    });
  });

  describe('getInvoices', () => {
    it('should return invoice history', async () => {
      mockPrisma.billingCustomer.findUnique.mockResolvedValue({ id: 'bc_123' });
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv_1',
          customerId: 'bc_123',
          amount: 2900,
          currency: 'usd',
          status: 'paid',
          invoiceUrl: 'https://stripe.com/invoice',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getInvoices('org_123');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('paid');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session', async () => {
      const organization = {
        id: 'org_123',
        name: 'Test Org',
        billingCustomer: { email: 'org@example.com' },
      };

      const plan = {
        id: 'plan_123',
        slug: 'pro',
        stripePriceId: 'price_stripe',
        trialDays: 14,
      };

      const customer = {
        id: 'bc_123',
        stripeCustomerId: 'cus_stripe',
        defaultProvider: 'stripe',
      };

      mockPrisma.organization.findUnique.mockResolvedValue(organization);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.billingCustomer.findUnique.mockResolvedValue(customer);

      const result = await service.createCheckoutSession({
        organizationId: 'org_123',
        planSlug: 'pro',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.url).toBe('https://checkout.stripe.com/session');
    });
  });
});
