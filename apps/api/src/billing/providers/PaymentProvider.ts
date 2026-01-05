/**
 * PaymentProvider Interface
 * Abstract interface that all payment providers must implement
 */

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
} from './types';

/**
 * Abstract PaymentProvider interface
 * All payment provider implementations must implement this interface
 */
export interface PaymentProvider {
  /**
   * Provider identification
   */
  readonly type: PaymentProviderType;
  readonly name: string;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: ProviderConfig): void;

  /**
   * Customer Management
   */
  createCustomer(input: CreateCustomerInput): Promise<ProviderResult<Customer>>;
  getCustomer(customerId: string): Promise<ProviderResult<Customer>>;
  updateCustomer(
    customerId: string,
    updates: Partial<CreateCustomerInput>
  ): Promise<ProviderResult<Customer>>;
  deleteCustomer(customerId: string): Promise<ProviderResult<void>>;

  /**
   * Payment Method Management
   */
  getPaymentMethods(customerId: string): Promise<ProviderResult<PaymentMethod[]>>;
  attachPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<ProviderResult<PaymentMethod>>;
  detachPaymentMethod(paymentMethodId: string): Promise<ProviderResult<void>>;
  setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<ProviderResult<void>>;

  /**
   * Plan/Price Management
   */
  createPlan(input: CreatePlanInput): Promise<ProviderResult<Plan>>;
  getPlan(planId: string): Promise<ProviderResult<Plan>>;
  listPlans(): Promise<ProviderResult<Plan[]>>;
  updatePlan(planId: string, updates: Partial<CreatePlanInput>): Promise<ProviderResult<Plan>>;
  archivePlan(planId: string): Promise<ProviderResult<void>>;

  /**
   * Subscription Management
   */
  createSubscription(input: CreateSubscriptionInput): Promise<ProviderResult<Subscription>>;
  getSubscription(subscriptionId: string): Promise<ProviderResult<Subscription>>;
  listSubscriptions(customerId: string): Promise<ProviderResult<Subscription[]>>;
  updateSubscription(
    subscriptionId: string,
    updates: UpdateSubscriptionInput
  ): Promise<ProviderResult<Subscription>>;
  cancelSubscription(
    subscriptionId: string,
    immediately?: boolean
  ): Promise<ProviderResult<Subscription>>;
  resumeSubscription(subscriptionId: string): Promise<ProviderResult<Subscription>>;

  /**
   * Payment/Charge Management
   */
  createPayment(input: CreatePaymentInput): Promise<ProviderResult<Payment>>;
  getPayment(paymentId: string): Promise<ProviderResult<Payment>>;
  listPayments(customerId: string): Promise<ProviderResult<Payment[]>>;

  /**
   * Invoice Management
   */
  getInvoice(invoiceId: string): Promise<ProviderResult<Invoice>>;
  listInvoices(customerId: string): Promise<ProviderResult<Invoice[]>>;
  getUpcomingInvoice(customerId: string): Promise<ProviderResult<Invoice | null>>;

  /**
   * Refund Management
   */
  createRefund(input: CreateRefundInput): Promise<ProviderResult<Refund>>;
  getRefund(refundId: string): Promise<ProviderResult<Refund>>;

  /**
   * Checkout Sessions (for hosted payment pages)
   */
  createCheckoutSession(input: CreateCheckoutInput): Promise<ProviderResult<CheckoutSession>>;

  /**
   * Webhook Handling
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Promise<ProviderResult<WebhookEvent>>;

  /**
   * Utility Methods
   */
  formatAmount(amount: number, currency: string): string;
  parseAmount(formattedAmount: string, currency: string): number;
}

/**
 * Base class with common functionality
 */
export abstract class BasePaymentProvider implements PaymentProvider {
  abstract readonly type: PaymentProviderType;
  abstract readonly name: string;

  protected config: ProviderConfig | null = null;

  initialize(config: ProviderConfig): void {
    this.config = config;
  }

  protected ensureInitialized(): void {
    if (!this.config) {
      throw new Error(`${this.name} provider not initialized. Call initialize() first.`);
    }
  }

  /**
   * Default amount formatting (works for most currencies)
   */
  formatAmount(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    });
    return formatter.format(amount / 100); // Assume amount in cents
  }

  parseAmount(formattedAmount: string, _currency: string): number {
    const cleaned = formattedAmount.replace(/[^0-9.-]/g, '');
    return Math.round(parseFloat(cleaned) * 100);
  }

  // Abstract methods to be implemented by providers
  abstract createCustomer(input: CreateCustomerInput): Promise<ProviderResult<Customer>>;
  abstract getCustomer(customerId: string): Promise<ProviderResult<Customer>>;
  abstract updateCustomer(
    customerId: string,
    updates: Partial<CreateCustomerInput>
  ): Promise<ProviderResult<Customer>>;
  abstract deleteCustomer(customerId: string): Promise<ProviderResult<void>>;

  abstract getPaymentMethods(customerId: string): Promise<ProviderResult<PaymentMethod[]>>;
  abstract attachPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<ProviderResult<PaymentMethod>>;
  abstract detachPaymentMethod(paymentMethodId: string): Promise<ProviderResult<void>>;
  abstract setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<ProviderResult<void>>;

  abstract createPlan(input: CreatePlanInput): Promise<ProviderResult<Plan>>;
  abstract getPlan(planId: string): Promise<ProviderResult<Plan>>;
  abstract listPlans(): Promise<ProviderResult<Plan[]>>;
  abstract updatePlan(
    planId: string,
    updates: Partial<CreatePlanInput>
  ): Promise<ProviderResult<Plan>>;
  abstract archivePlan(planId: string): Promise<ProviderResult<void>>;

  abstract createSubscription(input: CreateSubscriptionInput): Promise<ProviderResult<Subscription>>;
  abstract getSubscription(subscriptionId: string): Promise<ProviderResult<Subscription>>;
  abstract listSubscriptions(customerId: string): Promise<ProviderResult<Subscription[]>>;
  abstract updateSubscription(
    subscriptionId: string,
    updates: UpdateSubscriptionInput
  ): Promise<ProviderResult<Subscription>>;
  abstract cancelSubscription(
    subscriptionId: string,
    immediately?: boolean
  ): Promise<ProviderResult<Subscription>>;
  abstract resumeSubscription(subscriptionId: string): Promise<ProviderResult<Subscription>>;

  abstract createPayment(input: CreatePaymentInput): Promise<ProviderResult<Payment>>;
  abstract getPayment(paymentId: string): Promise<ProviderResult<Payment>>;
  abstract listPayments(customerId: string): Promise<ProviderResult<Payment[]>>;

  abstract getInvoice(invoiceId: string): Promise<ProviderResult<Invoice>>;
  abstract listInvoices(customerId: string): Promise<ProviderResult<Invoice[]>>;
  abstract getUpcomingInvoice(customerId: string): Promise<ProviderResult<Invoice | null>>;

  abstract createRefund(input: CreateRefundInput): Promise<ProviderResult<Refund>>;
  abstract getRefund(refundId: string): Promise<ProviderResult<Refund>>;

  abstract createCheckoutSession(input: CreateCheckoutInput): Promise<ProviderResult<CheckoutSession>>;

  abstract constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Promise<ProviderResult<WebhookEvent>>;
}
