/**
 * Payment Provider Types
 * Common types for all payment providers
 */

export type PaymentProviderType = 'stripe' | 'flutterwave';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'incomplete'
  | 'trialing'
  | 'paused';

export type Currency = 'usd' | 'eur' | 'gbp' | 'ngn' | 'kes' | 'ghs' | 'zar';

export type BillingInterval = 'month' | 'year';

/**
 * Customer representation
 */
export interface Customer {
  id: string;
  providerId: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface CreateCustomerInput {
  email: string;
  name?: string;
  organizationId: string;
  metadata?: Record<string, string>;
}

/**
 * Payment method representation
 */
export interface PaymentMethod {
  id: string;
  providerId: string;
  type: 'card' | 'bank_account' | 'mobile_money';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

/**
 * Plan/Price representation
 */
export interface Plan {
  id: string;
  providerId: string;
  name: string;
  description?: string;
  amount: number;
  currency: Currency;
  interval: BillingInterval;
  trialDays?: number;
  features: string[];
  metadata?: Record<string, string>;
}

export interface CreatePlanInput {
  name: string;
  description?: string;
  amount: number;
  currency: Currency;
  interval: BillingInterval;
  trialDays?: number;
  features: string[];
  metadata?: Record<string, string>;
}

/**
 * Subscription representation
 */
export interface Subscription {
  id: string;
  providerId: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionInput {
  customerId: string;
  planId: string;
  paymentMethodId?: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface UpdateSubscriptionInput {
  planId?: string;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, string>;
}

/**
 * Payment/Charge representation
 */
export interface Payment {
  id: string;
  providerId: string;
  customerId: string;
  subscriptionId?: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  paymentMethodId?: string;
  description?: string;
  receiptUrl?: string;
  invoiceId?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
}

export interface CreatePaymentInput {
  customerId: string;
  amount: number;
  currency: Currency;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, string>;
}

/**
 * Invoice representation
 */
export interface Invoice {
  id: string;
  providerId: string;
  customerId: string;
  subscriptionId?: string;
  amount: number;
  amountPaid: number;
  currency: Currency;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  dueDate?: Date;
  paidAt?: Date;
  invoiceUrl?: string;
  invoicePdf?: string;
  lineItems: InvoiceLineItem[];
  createdAt: Date;
}

export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
}

/**
 * Refund representation
 */
export interface Refund {
  id: string;
  providerId: string;
  paymentId: string;
  amount: number;
  currency: Currency;
  status: 'pending' | 'succeeded' | 'failed';
  reason?: string;
  createdAt: Date;
}

export interface CreateRefundInput {
  paymentId: string;
  amount?: number; // Partial refund if specified
  reason?: string;
}

/**
 * Checkout session for hosted payment pages
 */
export interface CheckoutSession {
  id: string;
  url: string;
  expiresAt: Date;
}

export interface CreateCheckoutInput {
  customerId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

/**
 * Webhook event from payment provider
 */
export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  provider: PaymentProviderType;
  timestamp: Date;
}

/**
 * Provider result wrapper
 */
export interface ProviderResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  apiKey: string;
  secretKey?: string;
  webhookSecret?: string;
  testMode?: boolean;
}
