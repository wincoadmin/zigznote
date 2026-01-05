/**
 * FlutterwaveProvider
 * Flutterwave payment provider implementation for African markets
 */

import crypto from 'crypto';
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
  Refund,
  CreateRefundInput,
  CheckoutSession,
  CreateCheckoutInput,
  WebhookEvent,
  ProviderResult,
  ProviderConfig,
  PaymentProviderType,
  Currency,
  BillingInterval,
} from './types';

interface FlutterwaveResponse<T> {
  status: string;
  message: string;
  data: T;
}

// Note: FlutterwaveCustomer interface kept for reference when implementing full customer API
// interface FlutterwaveCustomer {
//   id: number;
//   customer_email: string;
//   name?: string;
//   created_at: string;
// }

interface FlutterwavePaymentPlan {
  id: number;
  name: string;
  amount: number;
  interval: string;
  duration: number;
  status: string;
  currency: string;
  plan_token: string;
  created_at: string;
}

interface FlutterwaveSubscription {
  id: number;
  amount: number;
  customer: {
    id: number;
    customer_email: string;
  };
  plan: number;
  status: string;
  created_at: string;
}

interface FlutterwaveTransaction {
  id: number;
  tx_ref: string;
  flw_ref: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  created_at: string;
  customer: {
    id: number;
    email: string;
    name?: string;
  };
}

export class FlutterwaveProvider extends BasePaymentProvider {
  readonly type: PaymentProviderType = 'flutterwave';
  readonly name = 'Flutterwave';

  private secretKey: string | null = null;
  private webhookSecret: string | null = null;
  private readonly apiBase = 'https://api.flutterwave.com/v3';

  // In-memory storage for customer mapping (in production, use database)
  private customerMap = new Map<string, { flwId: number; email: string }>();

  override initialize(config: ProviderConfig): void {
    super.initialize(config);
    // API key stored in config, secret key used for API calls
    this.secretKey = config.secretKey || config.apiKey;
    this.webhookSecret = config.webhookSecret || null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<FlutterwaveResponse<T>> {
    if (!this.secretKey) {
      throw new Error('Flutterwave not initialized');
    }

    const response = await fetch(`${this.apiBase}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json() as FlutterwaveResponse<T>;

    if (!response.ok || data.status !== 'success') {
      throw new Error(data.message || `Flutterwave API error: ${response.status}`);
    }

    return data;
  }

  // Customer Management
  // Note: Flutterwave doesn't have a dedicated customer API like Stripe
  // Customers are created implicitly during transactions
  async createCustomer(input: CreateCustomerInput): Promise<ProviderResult<Customer>> {
    // Generate a unique customer ID
    const customerId = `flw_cus_${crypto.randomBytes(12).toString('hex')}`;

    // Store customer info (in production, this would be in database)
    this.customerMap.set(customerId, {
      flwId: 0, // Will be set after first transaction
      email: input.email,
    });

    return {
      success: true,
      data: {
        id: customerId,
        providerId: customerId,
        email: input.email,
        name: input.name,
        metadata: {
          organizationId: input.organizationId,
          ...input.metadata,
        },
      },
    };
  }

  async getCustomer(customerId: string): Promise<ProviderResult<Customer>> {
    const customer = this.customerMap.get(customerId);

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    return {
      success: true,
      data: {
        id: customerId,
        providerId: customerId,
        email: customer.email,
      },
    };
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<CreateCustomerInput>
  ): Promise<ProviderResult<Customer>> {
    const customer = this.customerMap.get(customerId);

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    if (updates.email) {
      customer.email = updates.email;
    }

    return {
      success: true,
      data: {
        id: customerId,
        providerId: customerId,
        email: customer.email,
        name: updates.name,
      },
    };
  }

  async deleteCustomer(customerId: string): Promise<ProviderResult<void>> {
    this.customerMap.delete(customerId);
    return { success: true };
  }

  // Payment Method Management
  // Flutterwave handles payment methods through saved cards/tokens
  async getPaymentMethods(_customerId: string): Promise<ProviderResult<PaymentMethod[]>> {
    // Flutterwave doesn't have a customer-centric payment method API
    // Payment methods are tokenized per-transaction
    return { success: true, data: [] };
  }

  async attachPaymentMethod(
    _customerId: string,
    _paymentMethodId: string
  ): Promise<ProviderResult<PaymentMethod>> {
    return {
      success: false,
      error: 'Flutterwave does not support attaching payment methods. Use checkout flow instead.',
    };
  }

  async detachPaymentMethod(_paymentMethodId: string): Promise<ProviderResult<void>> {
    return { success: true };
  }

  async setDefaultPaymentMethod(
    _customerId: string,
    _paymentMethodId: string
  ): Promise<ProviderResult<void>> {
    return { success: true };
  }

  // Plan Management
  async createPlan(input: CreatePlanInput): Promise<ProviderResult<Plan>> {
    try {
      const intervalMap: Record<BillingInterval, string> = {
        month: 'monthly',
        year: 'yearly',
      };

      const response = await this.request<FlutterwavePaymentPlan>('/payment-plans', {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          amount: input.amount / 100, // Flutterwave uses major currency units
          interval: intervalMap[input.interval],
          duration: 0, // Infinite duration
          currency: input.currency.toUpperCase(),
        }),
      });

      return {
        success: true,
        data: {
          id: response.data.id.toString(),
          providerId: response.data.plan_token,
          name: response.data.name,
          description: input.description,
          amount: Math.round(response.data.amount * 100),
          currency: response.data.currency.toLowerCase() as Currency,
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
      const response = await this.request<FlutterwavePaymentPlan>(`/payment-plans/${planId}`);

      const intervalMap: Record<string, BillingInterval> = {
        monthly: 'month',
        yearly: 'year',
        weekly: 'month', // Fallback
        daily: 'month', // Fallback
      };

      return {
        success: true,
        data: {
          id: response.data.id.toString(),
          providerId: response.data.plan_token,
          name: response.data.name,
          amount: Math.round(response.data.amount * 100),
          currency: response.data.currency.toLowerCase() as Currency,
          interval: intervalMap[response.data.interval] || 'month',
          features: [],
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async listPlans(): Promise<ProviderResult<Plan[]>> {
    try {
      const response = await this.request<FlutterwavePaymentPlan[]>('/payment-plans');

      const intervalMap: Record<string, BillingInterval> = {
        monthly: 'month',
        yearly: 'year',
        weekly: 'month',
        daily: 'month',
      };

      return {
        success: true,
        data: response.data
          .filter((p) => p.status === 'active')
          .map((plan) => ({
            id: plan.id.toString(),
            providerId: plan.plan_token,
            name: plan.name,
            amount: Math.round(plan.amount * 100),
            currency: plan.currency.toLowerCase() as Currency,
            interval: intervalMap[plan.interval] || 'month',
            features: [],
          })),
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
      const response = await this.request<FlutterwavePaymentPlan>(`/payment-plans/${planId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: updates.name,
          status: 'active',
        }),
      });

      const intervalMap: Record<string, BillingInterval> = {
        monthly: 'month',
        yearly: 'year',
        weekly: 'month',
        daily: 'month',
      };

      return {
        success: true,
        data: {
          id: response.data.id.toString(),
          providerId: response.data.plan_token,
          name: response.data.name,
          amount: Math.round(response.data.amount * 100),
          currency: response.data.currency.toLowerCase() as Currency,
          interval: intervalMap[response.data.interval] || 'month',
          features: updates.features || [],
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async archivePlan(planId: string): Promise<ProviderResult<void>> {
    try {
      await this.request(`/payment-plans/${planId}/cancel`, {
        method: 'PUT',
      });
      return { success: true };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Subscription Management
  async createSubscription(input: CreateSubscriptionInput): Promise<ProviderResult<Subscription>> {
    // Flutterwave subscriptions are created through the checkout flow
    // Return a placeholder that will be updated after checkout completion
    const subscriptionId = `flw_sub_${crypto.randomBytes(12).toString('hex')}`;

    return {
      success: true,
      data: {
        id: subscriptionId,
        providerId: subscriptionId,
        customerId: input.customerId,
        planId: input.planId,
        status: 'incomplete',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        metadata: input.metadata,
      },
    };
  }

  async getSubscription(subscriptionId: string): Promise<ProviderResult<Subscription>> {
    try {
      const response = await this.request<FlutterwaveSubscription>(
        `/subscriptions/${subscriptionId}`
      );

      return {
        success: true,
        data: {
          id: response.data.id.toString(),
          providerId: response.data.id.toString(),
          customerId: response.data.customer.id.toString(),
          planId: response.data.plan.toString(),
          status: response.data.status === 'active' ? 'active' : 'cancelled',
          currentPeriodStart: new Date(response.data.created_at),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async listSubscriptions(customerId: string): Promise<ProviderResult<Subscription[]>> {
    try {
      const customer = this.customerMap.get(customerId);
      if (!customer || !customer.flwId) {
        return { success: true, data: [] };
      }

      const response = await this.request<FlutterwaveSubscription[]>(
        `/subscriptions?customer=${customer.flwId}`
      );

      return {
        success: true,
        data: response.data.map((sub) => ({
          id: sub.id.toString(),
          providerId: sub.id.toString(),
          customerId: sub.customer.id.toString(),
          planId: sub.plan.toString(),
          status: sub.status === 'active' ? 'active' : 'cancelled',
          currentPeriodStart: new Date(sub.created_at),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        })),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateSubscription(
    subscriptionId: string,
    _updates: UpdateSubscriptionInput
  ): Promise<ProviderResult<Subscription>> {
    // Flutterwave doesn't support subscription updates
    // Return current subscription state
    return this.getSubscription(subscriptionId);
  }

  async cancelSubscription(
    subscriptionId: string,
    _immediately: boolean = false
  ): Promise<ProviderResult<Subscription>> {
    try {
      await this.request(`/subscriptions/${subscriptionId}/cancel`, {
        method: 'PUT',
      });

      return {
        success: true,
        data: {
          id: subscriptionId,
          providerId: subscriptionId,
          customerId: '',
          planId: '',
          status: 'cancelled',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<ProviderResult<Subscription>> {
    try {
      await this.request(`/subscriptions/${subscriptionId}/activate`, {
        method: 'PUT',
      });

      return this.getSubscription(subscriptionId);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Payment Management
  async createPayment(input: CreatePaymentInput): Promise<ProviderResult<Payment>> {
    try {
      const txRef = `zigznote_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const customer = this.customerMap.get(input.customerId);

      // Initiate standard payment
      const response = await this.request<{ link: string }>('/payments', {
        method: 'POST',
        body: JSON.stringify({
          tx_ref: txRef,
          amount: input.amount / 100,
          currency: input.currency.toUpperCase(),
          redirect_url: input.metadata?.redirect_url || 'https://zigznote.com/payment/complete',
          customer: {
            email: customer?.email || input.metadata?.email || '',
            name: input.metadata?.name || '',
          },
          customizations: {
            title: 'zigznote',
            description: input.description || 'Payment',
          },
          meta: input.metadata,
        }),
      });

      return {
        success: true,
        data: {
          id: txRef,
          providerId: txRef,
          customerId: input.customerId,
          amount: input.amount,
          currency: input.currency,
          status: 'pending',
          description: input.description,
          metadata: {
            ...input.metadata,
            payment_link: response.data.link,
          },
          createdAt: new Date(),
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPayment(paymentId: string): Promise<ProviderResult<Payment>> {
    try {
      // Try to get by transaction ID first
      const response = await this.request<FlutterwaveTransaction>(
        `/transactions/${paymentId}/verify`
      );

      const statusMap: Record<string, Payment['status']> = {
        successful: 'succeeded',
        pending: 'pending',
        failed: 'failed',
      };

      return {
        success: true,
        data: {
          id: response.data.tx_ref,
          providerId: response.data.flw_ref,
          customerId: response.data.customer.id.toString(),
          amount: Math.round(response.data.amount * 100),
          currency: response.data.currency.toLowerCase() as Currency,
          status: statusMap[response.data.status] || 'pending',
          createdAt: new Date(response.data.created_at),
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async listPayments(customerId: string): Promise<ProviderResult<Payment[]>> {
    try {
      const customer = this.customerMap.get(customerId);
      if (!customer) {
        return { success: true, data: [] };
      }

      const response = await this.request<FlutterwaveTransaction[]>(
        `/transactions?customer_email=${encodeURIComponent(customer.email)}`
      );

      const statusMap: Record<string, Payment['status']> = {
        successful: 'succeeded',
        pending: 'pending',
        failed: 'failed',
      };

      return {
        success: true,
        data: response.data.map((tx) => ({
          id: tx.tx_ref,
          providerId: tx.flw_ref,
          customerId: tx.customer.id.toString(),
          amount: Math.round(tx.amount * 100),
          currency: tx.currency.toLowerCase() as Currency,
          status: statusMap[tx.status] || 'pending',
          createdAt: new Date(tx.created_at),
        })),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Invoice Management
  // Flutterwave doesn't have a traditional invoice system
  async getInvoice(_invoiceId: string): Promise<ProviderResult<Invoice>> {
    return {
      success: false,
      error: 'Flutterwave does not support invoices. Use transactions instead.',
    };
  }

  async listInvoices(_customerId: string): Promise<ProviderResult<Invoice[]>> {
    return { success: true, data: [] };
  }

  async getUpcomingInvoice(_customerId: string): Promise<ProviderResult<Invoice | null>> {
    return { success: true, data: null };
  }

  // Refund Management
  async createRefund(input: CreateRefundInput): Promise<ProviderResult<Refund>> {
    try {
      // Get transaction ID from payment
      const paymentResult = await this.getPayment(input.paymentId);
      if (!paymentResult.success || !paymentResult.data) {
        return { success: false, error: 'Payment not found' };
      }

      const response = await this.request<{ id: number; status: string }>(
        `/transactions/${paymentResult.data.providerId}/refund`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: input.amount ? input.amount / 100 : undefined,
          }),
        }
      );

      return {
        success: true,
        data: {
          id: response.data.id.toString(),
          providerId: response.data.id.toString(),
          paymentId: input.paymentId,
          amount: input.amount || paymentResult.data.amount,
          currency: paymentResult.data.currency,
          status: response.data.status === 'completed' ? 'succeeded' : 'pending',
          reason: input.reason,
          createdAt: new Date(),
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getRefund(_refundId: string): Promise<ProviderResult<Refund>> {
    return {
      success: false,
      error: 'Flutterwave does not support refund lookup. Check transaction status instead.',
    };
  }

  // Checkout Session
  async createCheckoutSession(input: CreateCheckoutInput): Promise<ProviderResult<CheckoutSession>> {
    try {
      const customer = this.customerMap.get(input.customerId);
      const txRef = `zigznote_sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const response = await this.request<{ link: string }>('/payments', {
        method: 'POST',
        body: JSON.stringify({
          tx_ref: txRef,
          amount: 0, // Will be set from plan
          currency: 'USD',
          redirect_url: input.successUrl,
          payment_plan: parseInt(input.planId, 10),
          customer: {
            email: customer?.email || '',
          },
          customizations: {
            title: 'zigznote Subscription',
            description: 'Subscribe to zigznote',
          },
          meta: input.metadata,
        }),
      });

      return {
        success: true,
        data: {
          id: txRef,
          url: response.data.link,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
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

    // Verify signature
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(typeof payload === 'string' ? payload : payload.toString())
      .digest('hex');

    if (hash !== signature) {
      return { success: false, error: 'Invalid webhook signature' };
    }

    try {
      const data = JSON.parse(typeof payload === 'string' ? payload : payload.toString());

      return {
        success: true,
        data: {
          id: data.id?.toString() || crypto.randomUUID(),
          type: data.event || 'charge.completed',
          data: data.data || data,
          provider: 'flutterwave',
          timestamp: new Date(),
        },
      };
    } catch {
      return { success: false, error: 'Invalid webhook payload' };
    }
  }

  // Amount formatting for African currencies
  override formatAmount(amount: number, currency: string): string {
    const currencySymbols: Record<string, string> = {
      NGN: '₦',
      KES: 'KSh',
      GHS: 'GH₵',
      ZAR: 'R',
      USD: '$',
      EUR: '€',
      GBP: '£',
    };

    const symbol = currencySymbols[currency.toUpperCase()] || currency;
    const majorUnits = amount / 100;

    return `${symbol}${majorUnits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  private handleError<T>(error: unknown): ProviderResult<T> {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
