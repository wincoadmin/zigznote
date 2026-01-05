/**
 * StripeProvider
 * Stripe payment provider implementation
 */

import Stripe from 'stripe';
import { BasePaymentProvider } from './PaymentProvider';
import {
  Customer,
  CreateCustomerInput,
  PaymentMethod,
  Plan,
  CreatePlanInput,
  Subscription,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  Payment,
  CreatePaymentInput,
  Invoice,
  InvoiceLineItem,
  Refund,
  CreateRefundInput,
  CheckoutSession,
  CreateCheckoutInput,
  WebhookEvent,
  ProviderResult,
  ProviderConfig,
  PaymentProviderType,
  SubscriptionStatus,
  PaymentStatus,
  Currency,
  BillingInterval,
} from './types';

export class StripeProvider extends BasePaymentProvider {
  readonly type: PaymentProviderType = 'stripe';
  readonly name = 'Stripe';

  private stripe: Stripe | null = null;
  private webhookSecret: string | null = null;

  override initialize(config: ProviderConfig): void {
    super.initialize(config);
    this.stripe = new Stripe(config.apiKey);
    this.webhookSecret = config.webhookSecret || null;
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }
    return this.stripe;
  }

  // Customer Management
  async createCustomer(input: CreateCustomerInput): Promise<ProviderResult<Customer>> {
    try {
      const customer = await this.getStripe().customers.create({
        email: input.email,
        name: input.name,
        metadata: {
          organizationId: input.organizationId,
          ...input.metadata,
        },
      });

      return {
        success: true,
        data: {
          id: customer.id,
          providerId: customer.id,
          email: customer.email || input.email,
          name: customer.name || undefined,
          metadata: customer.metadata as Record<string, string>,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getCustomer(customerId: string): Promise<ProviderResult<Customer>> {
    try {
      const customer = await this.getStripe().customers.retrieve(customerId);

      if (customer.deleted) {
        return { success: false, error: 'Customer deleted' };
      }

      return {
        success: true,
        data: {
          id: customer.id,
          providerId: customer.id,
          email: customer.email || '',
          name: customer.name || undefined,
          metadata: customer.metadata as Record<string, string>,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<CreateCustomerInput>
  ): Promise<ProviderResult<Customer>> {
    try {
      const customer = await this.getStripe().customers.update(customerId, {
        email: updates.email,
        name: updates.name,
        metadata: updates.metadata,
      });

      return {
        success: true,
        data: {
          id: customer.id,
          providerId: customer.id,
          email: customer.email || '',
          name: customer.name || undefined,
          metadata: customer.metadata as Record<string, string>,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteCustomer(customerId: string): Promise<ProviderResult<void>> {
    try {
      await this.getStripe().customers.del(customerId);
      return { success: true };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Payment Method Management
  async getPaymentMethods(customerId: string): Promise<ProviderResult<PaymentMethod[]>> {
    try {
      const methods = await this.getStripe().paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      const customer = await this.getStripe().customers.retrieve(customerId);
      const defaultMethodId =
        !customer.deleted && typeof customer.invoice_settings?.default_payment_method === 'string'
          ? customer.invoice_settings.default_payment_method
          : null;

      return {
        success: true,
        data: methods.data.map((pm) => ({
          id: pm.id,
          providerId: pm.id,
          type: 'card' as const,
          last4: pm.card?.last4,
          brand: pm.card?.brand,
          expiryMonth: pm.card?.exp_month,
          expiryYear: pm.card?.exp_year,
          isDefault: pm.id === defaultMethodId,
        })),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<ProviderResult<PaymentMethod>> {
    try {
      const pm = await this.getStripe().paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      return {
        success: true,
        data: {
          id: pm.id,
          providerId: pm.id,
          type: 'card',
          last4: pm.card?.last4,
          brand: pm.card?.brand,
          expiryMonth: pm.card?.exp_month,
          expiryYear: pm.card?.exp_year,
          isDefault: false,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<ProviderResult<void>> {
    try {
      await this.getStripe().paymentMethods.detach(paymentMethodId);
      return { success: true };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<ProviderResult<void>> {
    try {
      await this.getStripe().customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
      return { success: true };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Plan Management
  async createPlan(input: CreatePlanInput): Promise<ProviderResult<Plan>> {
    try {
      // Create product first
      const product = await this.getStripe().products.create({
        name: input.name,
        description: input.description,
        metadata: {
          features: JSON.stringify(input.features),
          ...input.metadata,
        },
      });

      // Create price
      const price = await this.getStripe().prices.create({
        product: product.id,
        unit_amount: input.amount,
        currency: input.currency,
        recurring: {
          interval: input.interval,
          trial_period_days: input.trialDays,
        },
        metadata: input.metadata,
      });

      return {
        success: true,
        data: {
          id: price.id,
          providerId: price.id,
          name: input.name,
          description: input.description,
          amount: input.amount,
          currency: input.currency as Currency,
          interval: input.interval,
          trialDays: input.trialDays,
          features: input.features,
          metadata: input.metadata,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPlan(planId: string): Promise<ProviderResult<Plan>> {
    try {
      const price = await this.getStripe().prices.retrieve(planId, {
        expand: ['product'],
      });

      const product = price.product as Stripe.Product;

      return {
        success: true,
        data: {
          id: price.id,
          providerId: price.id,
          name: product.name,
          description: product.description || undefined,
          amount: price.unit_amount || 0,
          currency: price.currency as Currency,
          interval: price.recurring?.interval as BillingInterval,
          trialDays: price.recurring?.trial_period_days || undefined,
          features: product.metadata?.features ? JSON.parse(product.metadata.features) : [],
          metadata: price.metadata,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async listPlans(): Promise<ProviderResult<Plan[]>> {
    try {
      const prices = await this.getStripe().prices.list({
        active: true,
        expand: ['data.product'],
        limit: 100,
      });

      return {
        success: true,
        data: prices.data
          .filter((p) => p.recurring && !(p.product as Stripe.Product).deleted)
          .map((price) => {
            const product = price.product as Stripe.Product;
            return {
              id: price.id,
              providerId: price.id,
              name: product.name,
              description: product.description || undefined,
              amount: price.unit_amount || 0,
              currency: price.currency as Currency,
              interval: price.recurring?.interval as BillingInterval,
              trialDays: price.recurring?.trial_period_days || undefined,
              features: product.metadata?.features ? JSON.parse(product.metadata.features) : [],
              metadata: price.metadata,
            };
          }),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updatePlan(
    planId: string,
    updates: Partial<CreatePlanInput>
  ): Promise<ProviderResult<Plan>> {
    try {
      const price = await this.getStripe().prices.retrieve(planId);
      const productId =
        typeof price.product === 'string' ? price.product : price.product.id;

      // Update product
      if (updates.name || updates.description || updates.features) {
        await this.getStripe().products.update(productId, {
          name: updates.name,
          description: updates.description,
          metadata: updates.features ? { features: JSON.stringify(updates.features) } : undefined,
        });
      }

      return this.getPlan(planId);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async archivePlan(planId: string): Promise<ProviderResult<void>> {
    try {
      await this.getStripe().prices.update(planId, { active: false });
      return { success: true };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Subscription Management
  async createSubscription(input: CreateSubscriptionInput): Promise<ProviderResult<Subscription>> {
    try {
      const subParams: Stripe.SubscriptionCreateParams = {
        customer: input.customerId,
        items: [{ price: input.planId }],
        metadata: input.metadata,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      };

      if (input.paymentMethodId) {
        subParams.default_payment_method = input.paymentMethodId;
      }

      if (input.trialDays) {
        subParams.trial_period_days = input.trialDays;
      }

      const subscription = await this.getStripe().subscriptions.create(subParams);

      return {
        success: true,
        data: this.mapSubscription(subscription),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getSubscription(subscriptionId: string): Promise<ProviderResult<Subscription>> {
    try {
      const subscription = await this.getStripe().subscriptions.retrieve(subscriptionId);
      return {
        success: true,
        data: this.mapSubscription(subscription),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async listSubscriptions(customerId: string): Promise<ProviderResult<Subscription[]>> {
    try {
      const subscriptions = await this.getStripe().subscriptions.list({
        customer: customerId,
        limit: 100,
      });

      return {
        success: true,
        data: subscriptions.data.map((s) => this.mapSubscription(s)),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateSubscription(
    subscriptionId: string,
    updates: UpdateSubscriptionInput
  ): Promise<ProviderResult<Subscription>> {
    try {
      const updateParams: Stripe.SubscriptionUpdateParams = {
        metadata: updates.metadata,
      };

      if (updates.cancelAtPeriodEnd !== undefined) {
        updateParams.cancel_at_period_end = updates.cancelAtPeriodEnd;
      }

      if (updates.planId) {
        const subscription = await this.getStripe().subscriptions.retrieve(subscriptionId);
        const itemId = subscription.items?.data?.[0]?.id;
        if (itemId) {
          updateParams.items = [
            {
              id: itemId,
              price: updates.planId,
            },
          ];
          updateParams.proration_behavior = 'create_prorations';
        }
      }

      const subscription = await this.getStripe().subscriptions.update(subscriptionId, updateParams);

      return {
        success: true,
        data: this.mapSubscription(subscription),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
  ): Promise<ProviderResult<Subscription>> {
    try {
      let subscription: Stripe.Subscription;

      if (immediately) {
        subscription = await this.getStripe().subscriptions.cancel(subscriptionId);
      } else {
        subscription = await this.getStripe().subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }

      return {
        success: true,
        data: this.mapSubscription(subscription),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<ProviderResult<Subscription>> {
    try {
      const subscription = await this.getStripe().subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      return {
        success: true,
        data: this.mapSubscription(subscription),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Payment Management
  async createPayment(input: CreatePaymentInput): Promise<ProviderResult<Payment>> {
    try {
      const intentParams: Stripe.PaymentIntentCreateParams = {
        customer: input.customerId,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        metadata: input.metadata,
      };

      if (input.paymentMethodId) {
        intentParams.payment_method = input.paymentMethodId;
        intentParams.confirm = true;
      }

      const intent = await this.getStripe().paymentIntents.create(intentParams);

      return {
        success: true,
        data: this.mapPayment(intent),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPayment(paymentId: string): Promise<ProviderResult<Payment>> {
    try {
      const intent = await this.getStripe().paymentIntents.retrieve(paymentId);
      return {
        success: true,
        data: this.mapPayment(intent),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async listPayments(customerId: string): Promise<ProviderResult<Payment[]>> {
    try {
      const intents = await this.getStripe().paymentIntents.list({
        customer: customerId,
        limit: 100,
      });

      return {
        success: true,
        data: intents.data.map((i) => this.mapPayment(i)),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Invoice Management
  async getInvoice(invoiceId: string): Promise<ProviderResult<Invoice>> {
    try {
      const invoice = await this.getStripe().invoices.retrieve(invoiceId);
      return {
        success: true,
        data: this.mapInvoice(invoice),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async listInvoices(customerId: string): Promise<ProviderResult<Invoice[]>> {
    try {
      const invoices = await this.getStripe().invoices.list({
        customer: customerId,
        limit: 100,
      });

      return {
        success: true,
        data: invoices.data.map((i) => this.mapInvoice(i)),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getUpcomingInvoice(customerId: string): Promise<ProviderResult<Invoice | null>> {
    try {
      // Use direct API call since the SDK method may not be available in newer versions
      const response = await fetch(`https://api.stripe.com/v1/invoices/upcoming?customer=${customerId}`, {
        headers: {
          'Authorization': `Bearer ${this.config?.apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: true, data: null };
        }
        throw new Error(`Stripe API error: ${response.status}`);
      }

      const invoice = await response.json() as Stripe.Invoice;

      return {
        success: true,
        data: this.mapInvoice(invoice),
      };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        // No upcoming invoice (no active subscription)
        return { success: true, data: null };
      }
      return this.handleError(error);
    }
  }

  // Refund Management
  async createRefund(input: CreateRefundInput): Promise<ProviderResult<Refund>> {
    try {
      const refund = await this.getStripe().refunds.create({
        payment_intent: input.paymentId,
        amount: input.amount,
        reason: input.reason as Stripe.RefundCreateParams.Reason,
      });

      return {
        success: true,
        data: {
          id: refund.id,
          providerId: refund.id,
          paymentId: typeof refund.payment_intent === 'string'
            ? refund.payment_intent
            : refund.payment_intent?.id || '',
          amount: refund.amount,
          currency: refund.currency as Currency,
          status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
          reason: refund.reason || undefined,
          createdAt: new Date(refund.created * 1000),
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getRefund(refundId: string): Promise<ProviderResult<Refund>> {
    try {
      const refund = await this.getStripe().refunds.retrieve(refundId);

      return {
        success: true,
        data: {
          id: refund.id,
          providerId: refund.id,
          paymentId: typeof refund.payment_intent === 'string'
            ? refund.payment_intent
            : refund.payment_intent?.id || '',
          amount: refund.amount,
          currency: refund.currency as Currency,
          status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
          reason: refund.reason || undefined,
          createdAt: new Date(refund.created * 1000),
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Checkout Session
  async createCheckoutSession(input: CreateCheckoutInput): Promise<ProviderResult<CheckoutSession>> {
    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: input.customerId,
        mode: 'subscription',
        line_items: [
          {
            price: input.planId,
            quantity: 1,
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
      };

      if (input.trialDays) {
        sessionParams.subscription_data = {
          trial_period_days: input.trialDays,
        };
      }

      const session = await this.getStripe().checkout.sessions.create(sessionParams);

      return {
        success: true,
        data: {
          id: session.id,
          url: session.url || '',
          expiresAt: new Date(session.expires_at * 1000),
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Webhook
  async constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Promise<ProviderResult<WebhookEvent>> {
    if (!this.webhookSecret) {
      return { success: false, error: 'Webhook secret not configured' };
    }

    try {
      const event = this.getStripe().webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );

      return {
        success: true,
        data: {
          id: event.id,
          type: event.type,
          data: event.data.object as unknown as Record<string, unknown>,
          provider: 'stripe',
          timestamp: new Date(event.created * 1000),
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Helper Methods
  private mapSubscription(sub: Stripe.Subscription): Subscription {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      active: 'active',
      past_due: 'past_due',
      canceled: 'cancelled',
      incomplete: 'incomplete',
      incomplete_expired: 'cancelled',
      trialing: 'trialing',
      unpaid: 'past_due',
      paused: 'paused',
    };

    // Cast to access properties that may not be in strict types
    const subData = sub as unknown as {
      current_period_start: number;
      current_period_end: number;
    };

    return {
      id: sub.id,
      providerId: sub.id,
      customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      planId: sub.items.data[0]?.price.id || '',
      status: statusMap[sub.status] || 'incomplete',
      currentPeriodStart: new Date(subData.current_period_start * 1000),
      currentPeriodEnd: new Date(subData.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : undefined,
      metadata: sub.metadata,
    };
  }

  private mapPayment(intent: Stripe.PaymentIntent): Payment {
    const statusMap: Record<Stripe.PaymentIntent.Status, PaymentStatus> = {
      requires_payment_method: 'pending',
      requires_confirmation: 'pending',
      requires_action: 'pending',
      processing: 'processing',
      requires_capture: 'processing',
      canceled: 'cancelled',
      succeeded: 'succeeded',
    };

    // Cast to access invoice property
    const intentData = intent as unknown as {
      invoice?: string | { id: string } | null;
    };

    return {
      id: intent.id,
      providerId: intent.id,
      customerId: typeof intent.customer === 'string'
        ? intent.customer
        : intent.customer?.id || '',
      amount: intent.amount,
      currency: intent.currency as Currency,
      status: statusMap[intent.status] || 'pending',
      paymentMethodId: typeof intent.payment_method === 'string'
        ? intent.payment_method
        : intent.payment_method?.id,
      description: intent.description || undefined,
      invoiceId: typeof intentData.invoice === 'string'
        ? intentData.invoice
        : intentData.invoice?.id,
      metadata: intent.metadata,
      createdAt: new Date(intent.created * 1000),
    };
  }

  private mapInvoice(invoice: Stripe.Invoice): Invoice {
    const statusMap: Record<string, Invoice['status']> = {
      draft: 'draft',
      open: 'open',
      paid: 'paid',
      void: 'void',
      uncollectible: 'uncollectible',
    };

    const lineItems: InvoiceLineItem[] = invoice.lines?.data.map((line) => ({
      description: line.description || '',
      amount: line.amount,
      quantity: line.quantity || 1,
    })) || [];

    // Cast to access subscription property
    const invoiceData = invoice as unknown as {
      subscription?: string | { id: string } | null;
    };

    return {
      id: invoice.id || '',
      providerId: invoice.id || '',
      customerId: typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id || '',
      subscriptionId: typeof invoiceData.subscription === 'string'
        ? invoiceData.subscription
        : invoiceData.subscription?.id,
      amount: invoice.total,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency as Currency,
      status: statusMap[invoice.status || 'draft'] || 'draft',
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : undefined,
      invoiceUrl: invoice.hosted_invoice_url || undefined,
      invoicePdf: invoice.invoice_pdf || undefined,
      lineItems,
      createdAt: new Date(invoice.created * 1000),
    };
  }

  private handleError<T>(error: unknown): ProviderResult<T> {
    if (error instanceof Stripe.errors.StripeError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
