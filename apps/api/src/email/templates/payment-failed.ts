/**
 * Payment Failed Email Templates
 * Used for dunning (payment recovery) flow
 */

export interface PaymentFailedEmailData {
  userName: string;
  graceEndsAt: string;
  updateUrl: string;
}

export const paymentFailedTemplates = {
  first: {
    subject: 'Action Required: Payment failed for zigznote',
    html: (data: PaymentFailedEmailData) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111827; margin-bottom: 24px;">Hi ${data.userName},</h2>

  <p>We weren't able to process your payment for zigznote.</p>

  <p>Don't worry - your account is still active. We'll retry the payment automatically.</p>

  <p>To avoid any interruption, please update your payment method:</p>

  <p style="margin: 32px 0;">
    <a href="${data.updateUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 500;">Update Payment Method</a>
  </p>

  <p>Your access will remain active until <strong>${data.graceEndsAt}</strong>.</p>

  <p>Questions? Just reply to this email.</p>

  <p style="margin-top: 32px; color: #6B7280;">- The zigznote team</p>
</body>
</html>
    `.trim(),
  },

  second: {
    subject: 'Reminder: Please update your payment method',
    html: (data: PaymentFailedEmailData) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111827; margin-bottom: 24px;">Hi ${data.userName},</h2>

  <p>This is a friendly reminder that your payment is still pending.</p>

  <p>Your account access will be paused on <strong>${data.graceEndsAt}</strong> if we can't process payment.</p>

  <p style="margin: 32px 0;">
    <a href="${data.updateUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 500;">Update Payment Method</a>
  </p>

  <p style="margin-top: 32px; color: #6B7280;">- The zigznote team</p>
</body>
</html>
    `.trim(),
  },

  final: {
    subject: 'Final notice: Your zigznote access will be paused soon',
    html: (data: PaymentFailedEmailData) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111827; margin-bottom: 24px;">Hi ${data.userName},</h2>

  <p style="color: #DC2626; font-weight: 600;"><strong>Your account access will be paused on ${data.graceEndsAt}.</strong></p>

  <p>We've tried to process your payment several times without success.</p>

  <p>Please update your payment method now to keep your access:</p>

  <p style="margin: 32px 0;">
    <a href="${data.updateUrl}" style="background: #DC2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 500;">Update Payment Now</a>
  </p>

  <p>After your access is paused, you'll still be able to view your data but won't be able to record new meetings.</p>

  <p style="margin-top: 32px; color: #6B7280;">- The zigznote team</p>
</body>
</html>
    `.trim(),
  },
};

export type PaymentFailedTemplateKey = keyof typeof paymentFailedTemplates;
