/**
 * Payment Providers Module
 */

export * from './types';
export { PaymentProvider, BasePaymentProvider } from './PaymentProvider';
export { StripeProvider } from './StripeProvider';
export { FlutterwaveProvider } from './FlutterwaveProvider';

import { PaymentProvider, PaymentProviderType } from './types';
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
