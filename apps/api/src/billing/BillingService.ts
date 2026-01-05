/**
 * BillingService
 * Provider-agnostic billing service that abstracts over Stripe and Flutterwave
 */

import { PrismaClient } from '@prisma/client';
import {
  PaymentProvider,
  PaymentProviderType,
  createPaymentProvider,
  ProviderConfig,
  SubscriptionStatus,
  PaymentStatus,
  Currency,
  BillingInterval,
} from './providers';
import { config } from '../config';

interface BillingCustomer {
  id: string;
  organizationId: string;
  email: string;
  name?: string;
  defaultProvider: PaymentProviderType;
}

interface BillingPlan {
  id: string;
  slug: string;
  name: string;
  description?: string;
  amount: number;
  currency: Currency;
  interval: BillingInterval;
  trialDays: number;
  features: string[];
  limits: Record<string, number>;
}

interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  provider: PaymentProviderType;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
}

interface Payment {
  id: string;
  customerId: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  description?: string;
  receiptUrl?: string;
  createdAt: Date;
}

interface CreateSubscriptionInput {
  organizationId: string;
  planSlug: string;
  paymentMethodId?: string;
  provider?: PaymentProviderType;
}

interface CheckoutSessionInput {
  organizationId: string;
  planSlug: string;
  successUrl: string;
  cancelUrl: string;
  provider?: PaymentProviderType;
}

export class BillingService {
  private providers: Map<PaymentProviderType, PaymentProvider> = new Map();

  constructor(private prisma: PrismaClient) {
    this.initializeProviders();
  }

  /**
   * Initialize payment providers based on configuration
   */
  private initializeProviders(): void {
    // Initialize Stripe if configured
    if (config.stripe?.secretKey) {
      const stripeProvider = createPaymentProvider('stripe');
      const stripeConfig: ProviderConfig = {
        apiKey: config.stripe.secretKey,
        webhookSecret: config.stripe.webhookSecret,
      };
      stripeProvider.initialize(stripeConfig);
      this.providers.set('stripe', stripeProvider);
    }

    // Initialize Flutterwave if configured
    if (config.flutterwave?.secretKey) {
      const flutterwaveProvider = createPaymentProvider('flutterwave');
      const flutterwaveConfig: ProviderConfig = {
        apiKey: config.flutterwave.publicKey || '',
        secretKey: config.flutterwave.secretKey,
        webhookSecret: config.flutterwave.webhookSecret,
      };
      flutterwaveProvider.initialize(flutterwaveConfig);
      this.providers.set('flutterwave', flutterwaveProvider);
    }
  }

  /**
   * Get a provider by type
   */
  private getProvider(type: PaymentProviderType): PaymentProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Payment provider ${type} not configured`);
    }
    return provider;
  }

  /**
   * Get or create a billing customer for an organization
   */
  async getOrCreateCustomer(
    organizationId: string,
    email: string,
    name?: string,
    preferredProvider?: PaymentProviderType
  ): Promise<BillingCustomer> {
    // Check if customer exists
    let customer = await this.prisma.billingCustomer.findUnique({
      where: { organizationId },
    });

    if (customer) {
      return {
        id: customer.id,
        organizationId: customer.organizationId,
        email: customer.email,
        name: customer.name || undefined,
        defaultProvider: customer.defaultProvider as PaymentProviderType,
      };
    }

    // Determine provider
    const provider = preferredProvider || this.getDefaultProvider();

    // Create customer in payment provider
    const providerInstance = this.getProvider(provider);
    const result = await providerInstance.createCustomer({
      email,
      name,
      organizationId,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to create customer');
    }

    // Store customer in database
    customer = await this.prisma.billingCustomer.create({
      data: {
        organizationId,
        email,
        name,
        defaultProvider: provider,
        stripeCustomerId: provider === 'stripe' ? result.data.providerId : null,
        flutterwaveId: provider === 'flutterwave' ? result.data.providerId : null,
      },
    });

    return {
      id: customer.id,
      organizationId: customer.organizationId,
      email: customer.email,
      name: customer.name || undefined,
      defaultProvider: customer.defaultProvider as PaymentProviderType,
    };
  }

  /**
   * Get all available plans
   */
  async getPlans(): Promise<BillingPlan[]> {
    const plans = await this.prisma.billingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return plans.map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description || undefined,
      amount: plan.amount,
      currency: plan.currency as Currency,
      interval: plan.interval as BillingInterval,
      trialDays: plan.trialDays,
      features: (plan.features as string[]) || [],
      limits: (plan.limits as Record<string, number>) || {},
    }));
  }

  /**
   * Get plan by slug
   */
  async getPlanBySlug(slug: string): Promise<BillingPlan | null> {
    const plan = await this.prisma.billingPlan.findUnique({
      where: { slug },
    });

    if (!plan) return null;

    return {
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description || undefined,
      amount: plan.amount,
      currency: plan.currency as Currency,
      interval: plan.interval as BillingInterval,
      trialDays: plan.trialDays,
      features: (plan.features as string[]) || [],
      limits: (plan.limits as Record<string, number>) || {},
    };
  }

  /**
   * Create a subscription
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    // Get organization
    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      include: { billingCustomer: true },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Get plan
    const plan = await this.prisma.billingPlan.findUnique({
      where: { slug: input.planSlug },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    // Get or create customer
    const customer = await this.getOrCreateCustomer(
      input.organizationId,
      organization.billingCustomer?.email || '',
      organization.name,
      input.provider
    );

    const provider = input.provider || customer.defaultProvider;
    const providerInstance = this.getProvider(provider);

    // Get provider-specific plan ID
    const providerPlanId = provider === 'stripe' ? plan.stripePriceId : plan.flutterwavePlan;

    if (!providerPlanId) {
      throw new Error(`Plan not configured for ${provider}`);
    }

    // Get provider customer ID
    const providerCustomerId =
      provider === 'stripe'
        ? (await this.prisma.billingCustomer.findUnique({ where: { id: customer.id } }))
            ?.stripeCustomerId
        : (await this.prisma.billingCustomer.findUnique({ where: { id: customer.id } }))
            ?.flutterwaveId;

    if (!providerCustomerId) {
      throw new Error('Customer not set up for this provider');
    }

    // Create subscription with provider
    const result = await providerInstance.createSubscription({
      customerId: providerCustomerId,
      planId: providerPlanId,
      paymentMethodId: input.paymentMethodId,
      trialDays: plan.trialDays,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to create subscription');
    }

    // Store subscription in database
    const subscription = await this.prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: plan.id,
        provider,
        providerSubId: result.data.providerId,
        status: result.data.status,
        currentPeriodStart: result.data.currentPeriodStart,
        currentPeriodEnd: result.data.currentPeriodEnd,
        cancelAtPeriodEnd: result.data.cancelAtPeriodEnd,
        trialEnd: result.data.trialEnd,
      },
    });

    // Update organization plan
    await this.prisma.organization.update({
      where: { id: input.organizationId },
      data: { plan: plan.slug },
    });

    return {
      id: subscription.id,
      customerId: subscription.customerId,
      planId: subscription.planId,
      provider: subscription.provider as PaymentProviderType,
      status: subscription.status as SubscriptionStatus,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd || undefined,
    };
  }

  /**
   * Create a checkout session for hosted payment
   */
  async createCheckoutSession(input: CheckoutSessionInput): Promise<{ url: string }> {
    // Get organization
    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      include: { billingCustomer: true },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Get plan
    const plan = await this.prisma.billingPlan.findUnique({
      where: { slug: input.planSlug },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    // Get or create customer
    const customer = await this.getOrCreateCustomer(
      input.organizationId,
      organization.billingCustomer?.email || '',
      organization.name,
      input.provider
    );

    const provider = input.provider || customer.defaultProvider;
    const providerInstance = this.getProvider(provider);

    // Get provider-specific plan ID
    const providerPlanId = provider === 'stripe' ? plan.stripePriceId : plan.flutterwavePlan;

    if (!providerPlanId) {
      throw new Error(`Plan not configured for ${provider}`);
    }

    // Get provider customer ID
    const dbCustomer = await this.prisma.billingCustomer.findUnique({ where: { id: customer.id } });
    const providerCustomerId =
      provider === 'stripe' ? dbCustomer?.stripeCustomerId : dbCustomer?.flutterwaveId;

    if (!providerCustomerId) {
      throw new Error('Customer not set up for this provider');
    }

    // Create checkout session
    const result = await providerInstance.createCheckoutSession({
      customerId: providerCustomerId,
      planId: providerPlanId,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      trialDays: plan.trialDays,
      metadata: {
        organizationId: input.organizationId,
        planId: plan.id,
      },
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to create checkout session');
    }

    return { url: result.data.url };
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || !subscription.providerSubId) {
      throw new Error('Subscription not found');
    }

    const provider = this.getProvider(subscription.provider as PaymentProviderType);

    const result = await provider.cancelSubscription(subscription.providerSubId, immediately);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to cancel subscription');
    }

    // Update database
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: result.data.status,
        cancelAtPeriodEnd: result.data.cancelAtPeriodEnd,
        cancelledAt: immediately ? new Date() : null,
      },
    });

    return {
      id: updated.id,
      customerId: updated.customerId,
      planId: updated.planId,
      provider: updated.provider as PaymentProviderType,
      status: updated.status as SubscriptionStatus,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
      trialEnd: updated.trialEnd || undefined,
    };
  }

  /**
   * Resume a cancelled subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || !subscription.providerSubId) {
      throw new Error('Subscription not found');
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new Error('Subscription is not scheduled for cancellation');
    }

    const provider = this.getProvider(subscription.provider as PaymentProviderType);

    const result = await provider.resumeSubscription(subscription.providerSubId);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to resume subscription');
    }

    // Update database
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: result.data.status,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });

    return {
      id: updated.id,
      customerId: updated.customerId,
      planId: updated.planId,
      provider: updated.provider as PaymentProviderType,
      status: updated.status as SubscriptionStatus,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
      trialEnd: updated.trialEnd || undefined,
    };
  }

  /**
   * Get subscription for organization
   */
  async getSubscription(organizationId: string): Promise<Subscription | null> {
    const customer = await this.prisma.billingCustomer.findUnique({
      where: { organizationId },
    });

    if (!customer) return null;

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        customerId: customer.id,
        status: { in: ['active', 'trialing', 'past_due'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) return null;

    return {
      id: subscription.id,
      customerId: subscription.customerId,
      planId: subscription.planId,
      provider: subscription.provider as PaymentProviderType,
      status: subscription.status as SubscriptionStatus,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd || undefined,
    };
  }

  /**
   * Get payment history for organization
   */
  async getPaymentHistory(organizationId: string): Promise<Payment[]> {
    const customer = await this.prisma.billingCustomer.findUnique({
      where: { organizationId },
    });

    if (!customer) return [];

    const payments = await this.prisma.payment.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return payments.map((p) => ({
      id: p.id,
      customerId: p.customerId,
      amount: p.amount,
      currency: p.currency as Currency,
      status: p.status as PaymentStatus,
      description: p.description || undefined,
      receiptUrl: p.receiptUrl || undefined,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Get invoices for organization
   */
  async getInvoices(organizationId: string): Promise<
    Array<{
      id: string;
      amount: number;
      currency: Currency;
      status: string;
      invoiceUrl?: string;
      createdAt: Date;
    }>
  > {
    const customer = await this.prisma.billingCustomer.findUnique({
      where: { organizationId },
    });

    if (!customer) return [];

    const invoices = await this.prisma.invoice.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return invoices.map((inv) => ({
      id: inv.id,
      amount: inv.amount,
      currency: inv.currency as Currency,
      status: inv.status,
      invoiceUrl: inv.invoiceUrl || undefined,
      createdAt: inv.createdAt,
    }));
  }

  /**
   * Handle webhook from payment provider
   */
  async handleWebhook(
    provider: PaymentProviderType,
    payload: string | Buffer,
    signature: string
  ): Promise<void> {
    const providerInstance = this.getProvider(provider);

    const result = await providerInstance.constructWebhookEvent(payload, signature);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Invalid webhook');
    }

    const event = result.data;

    // Handle different event types
    switch (event.type) {
      case 'invoice.paid':
      case 'charge.completed':
        await this.handlePaymentSucceeded(provider, event.data);
        break;

      case 'invoice.payment_failed':
      case 'charge.failed':
        await this.handlePaymentFailed(provider, event.data);
        break;

      case 'customer.subscription.updated':
      case 'subscription.updated':
        await this.handleSubscriptionUpdated(provider, event.data);
        break;

      case 'customer.subscription.deleted':
      case 'subscription.cancelled':
        await this.handleSubscriptionCancelled(provider, event.data);
        break;

      default:
        console.log(`[Billing] Unhandled webhook event: ${event.type}`);
    }
  }

  /**
   * Get the default payment provider
   */
  private getDefaultProvider(): PaymentProviderType {
    if (this.providers.has('stripe')) return 'stripe';
    if (this.providers.has('flutterwave')) return 'flutterwave';
    throw new Error('No payment providers configured');
  }

  // Webhook handlers
  private async handlePaymentSucceeded(
    provider: PaymentProviderType,
    data: Record<string, unknown>
  ): Promise<void> {
    console.log(`[Billing] Payment succeeded (${provider}):`, data.id);
    // Update payment status in database
  }

  private async handlePaymentFailed(
    provider: PaymentProviderType,
    data: Record<string, unknown>
  ): Promise<void> {
    console.log(`[Billing] Payment failed (${provider}):`, data.id);
    // Update subscription status, send notification
  }

  private async handleSubscriptionUpdated(
    provider: PaymentProviderType,
    data: Record<string, unknown>
  ): Promise<void> {
    console.log(`[Billing] Subscription updated (${provider}):`, data.id);

    const providerSubId = data.id as string;

    // Find and update subscription in database
    const subscription = await this.prisma.subscription.findFirst({
      where: { providerSubId, provider },
    });

    if (subscription) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: (data.status as string) || subscription.status,
          currentPeriodEnd: data.current_period_end
            ? new Date((data.current_period_end as number) * 1000)
            : subscription.currentPeriodEnd,
          cancelAtPeriodEnd: (data.cancel_at_period_end as boolean) ?? subscription.cancelAtPeriodEnd,
        },
      });
    }
  }

  private async handleSubscriptionCancelled(
    provider: PaymentProviderType,
    data: Record<string, unknown>
  ): Promise<void> {
    console.log(`[Billing] Subscription cancelled (${provider}):`, data.id);

    const providerSubId = data.id as string;

    // Find and update subscription in database
    const subscription = await this.prisma.subscription.findFirst({
      where: { providerSubId, provider },
      include: { customer: true },
    });

    if (subscription) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });

      // Downgrade organization to free plan
      await this.prisma.organization.update({
        where: { id: subscription.customer.organizationId },
        data: { plan: 'free' },
      });
    }
  }
}
