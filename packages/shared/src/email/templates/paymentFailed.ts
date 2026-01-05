/**
 * Payment Failed Email Template
 */

import type { PaymentFailedData } from '../types';
import { baseTemplate, styles, escapeHtml } from './base';

export function paymentFailed(data: PaymentFailedData): string {
  const content = `
    <h2 style="${styles.heading}">Payment Failed</h2>
    <p>Hi ${escapeHtml(data.userName)},</p>
    <div style="${styles.alert}">
      <p style="margin: 0;">We couldn't process your payment of <strong>${escapeHtml(data.amount)}</strong> for your ${escapeHtml(data.planName)} subscription.</p>
    </div>
    <p>We'll automatically retry on ${escapeHtml(data.nextRetryDate)}. To avoid any service interruption, please update your payment method:</p>
    <p style="margin: 24px 0;">
      <a href="${escapeHtml(data.updatePaymentUrl)}" style="${styles.button}">Update Payment Method</a>
    </p>
    <p style="${styles.mutedText}">If you have any questions, please contact our support team.</p>
    <div style="${styles.footer}">
      <p>This is an important billing notification from zigznote.</p>
    </div>
  `;

  return baseTemplate(content);
}
