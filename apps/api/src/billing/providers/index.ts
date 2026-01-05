/**
 * Payment Providers Module
 */

export * from './types';
export type { PaymentProvider } from './PaymentProvider';
export { BasePaymentProvider } from './PaymentProvider';
export { StripeProvider } from './StripeProvider';
export { FlutterwaveProvider } from './FlutterwaveProvider';

import type { PaymentProvider } from './PaymentProvider';
import { PaymentProviderType } from './types';
import { StripeProvider } from './StripeProvider';
import { FlutterwaveProvider } from './FlutterwaveProvider';

/**
 * Provider factory function
 */
export function createPaymentProvider(type: PaymentProviderType): PaymentProvider {
  switch (type) {
    case 'stripe':
      return new StripeProvider();
    case 'flutterwave':
      return new FlutterwaveProvider();
    default:
      throw new Error(`Unknown payment provider: ${type}`);
  }
}

/**
 * Get all available provider types
 */
export function getAvailableProviders(): PaymentProviderType[] {
  return ['stripe', 'flutterwave'];
}
