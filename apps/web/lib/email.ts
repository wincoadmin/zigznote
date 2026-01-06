/**
 * Email service using Resend
 * Handles all transactional emails for authentication
 */

import { Resend } from 'resend';

// Lazy initialization to avoid build errors when RESEND_API_KEY is not set
let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@zigznote.com';
const APP_NAME = 'zigznote';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Emerald green theme colors
const THEME = {
  primary: '#10b981',
  primaryDark: '#059669',
  background: '#f9fafb',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
};

/**
 * Base email template with zigznote branding
 */
function baseTemplate(content: string, footer?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${THEME.background};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: ${THEME.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${THEME.primary};">
                ${APP_NAME}
              </h1>
              <p style="margin: 4px 0 0; font-size: 14px; color: ${THEME.textMuted};">
                Your meetings, simplified
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              ${footer || defaultFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function defaultFooter(): string {
  return `
    <p style="margin: 0; font-size: 12px; color: ${THEME.textMuted};">
      This email was sent by ${APP_NAME}. If you didn't request this email, you can safely ignore it.
    </p>
    <p style="margin: 8px 0 0; font-size: 12px; color: ${THEME.textMuted};">
      <a href="${APP_URL}" style="color: ${THEME.primary}; text-decoration: none;">${APP_URL}</a>
    </p>
  `;
}

function buttonStyle(): string {
  return `display: inline-block; padding: 14px 32px; background-color: ${THEME.primary}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;`;
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; color: ${THEME.text};">
      Welcome to ${APP_NAME}!
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      Hi ${name || 'there'},<br><br>
      We're excited to have you on board. ${APP_NAME} helps you capture, transcribe, and summarize your meetings automatically.
    </p>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      Here's what you can do next:
    </p>
    <ul style="margin: 0 0 24px; padding-left: 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.8;">
      <li>Connect your calendar to automatically join meetings</li>
      <li>Start your first meeting recording</li>
      <li>Explore AI-powered summaries and action items</li>
    </ul>
    <p style="margin: 0 0 32px;">
      <a href="${APP_URL}/dashboard" style="${buttonStyle()}">
        Go to Dashboard
      </a>
    </p>
    <p style="margin: 0; font-size: 14px; color: ${THEME.textMuted};">
      Need help? Reply to this email or visit our <a href="${APP_URL}/help" style="color: ${THEME.primary};">help center</a>.
    </p>
  `;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Welcome to ${APP_NAME}!`,
    html: baseTemplate(content),
  });
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; color: ${THEME.text};">
      Verify your email address
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      Hi ${name || 'there'},<br><br>
      Thanks for signing up! Please verify your email address by clicking the button below.
    </p>
    <p style="margin: 0 0 24px;">
      <a href="${verifyUrl}" style="${buttonStyle()}">
        Verify Email Address
      </a>
    </p>
    <p style="margin: 0 0 24px; font-size: 14px; color: ${THEME.textMuted};">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 0 0 24px; font-size: 14px; color: ${THEME.primary}; word-break: break-all;">
      ${verifyUrl}
    </p>
    <p style="margin: 0; font-size: 14px; color: ${THEME.textMuted};">
      This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
    </p>
  `;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Verify your ${APP_NAME} account`,
    html: baseTemplate(content),
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; color: ${THEME.text};">
      Reset your password
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      Hi ${name || 'there'},<br><br>
      We received a request to reset your password. Click the button below to choose a new password.
    </p>
    <p style="margin: 0 0 24px;">
      <a href="${resetUrl}" style="${buttonStyle()}">
        Reset Password
      </a>
    </p>
    <p style="margin: 0 0 24px; font-size: 14px; color: ${THEME.textMuted};">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 0 0 24px; font-size: 14px; color: ${THEME.primary}; word-break: break-all;">
      ${resetUrl}
    </p>
    <p style="margin: 0; font-size: 14px; color: ${THEME.textMuted};">
      This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
  `;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html: baseTemplate(content),
  });
}

/**
 * Send password changed confirmation email
 */
export async function sendPasswordChangedEmail(
  email: string,
  name: string
): Promise<void> {
  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; color: ${THEME.text};">
      Password changed successfully
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      Hi ${name || 'there'},<br><br>
      Your ${APP_NAME} password has been changed successfully.
    </p>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      If you didn't make this change, please <a href="${APP_URL}/reset-password" style="color: ${THEME.primary};">reset your password immediately</a> and contact our support team.
    </p>
    <p style="margin: 0; font-size: 14px; color: ${THEME.textMuted};">
      Time: ${new Date().toLocaleString()}
    </p>
  `;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Your ${APP_NAME} password was changed`,
    html: baseTemplate(content),
  });
}

/**
 * Send new login notification email
 */
export async function sendNewLoginEmail(
  email: string,
  name: string,
  location: string,
  device: string
): Promise<void> {
  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; color: ${THEME.text};">
      New sign-in to your account
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      Hi ${name || 'there'},<br><br>
      We noticed a new sign-in to your ${APP_NAME} account.
    </p>
    <table style="margin: 0 0 24px; width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 12px; border: 1px solid ${THEME.border}; font-size: 14px; color: ${THEME.textMuted};">
          <strong>Location:</strong>
        </td>
        <td style="padding: 12px; border: 1px solid ${THEME.border}; font-size: 14px; color: ${THEME.text};">
          ${location || 'Unknown'}
        </td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid ${THEME.border}; font-size: 14px; color: ${THEME.textMuted};">
          <strong>Device:</strong>
        </td>
        <td style="padding: 12px; border: 1px solid ${THEME.border}; font-size: 14px; color: ${THEME.text};">
          ${device || 'Unknown'}
        </td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid ${THEME.border}; font-size: 14px; color: ${THEME.textMuted};">
          <strong>Time:</strong>
        </td>
        <td style="padding: 12px; border: 1px solid ${THEME.border}; font-size: 14px; color: ${THEME.text};">
          ${new Date().toLocaleString()}
        </td>
      </tr>
    </table>
    <p style="margin: 0; font-size: 14px; color: ${THEME.textMuted};">
      If this wasn't you, please <a href="${APP_URL}/reset-password" style="color: ${THEME.primary};">reset your password</a> immediately.
    </p>
  `;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `New sign-in to your ${APP_NAME} account`,
    html: baseTemplate(content),
  });
}

/**
 * Send 2FA enabled notification email
 */
export async function send2FAEnabledEmail(
  email: string,
  name: string
): Promise<void> {
  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; color: ${THEME.text};">
      Two-factor authentication enabled
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      Hi ${name || 'there'},<br><br>
      Two-factor authentication has been enabled for your ${APP_NAME} account. This adds an extra layer of security.
    </p>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      Make sure to save your backup codes in a safe place. You'll need them if you lose access to your authenticator app.
    </p>
    <p style="margin: 0; font-size: 14px; color: ${THEME.textMuted};">
      If you didn't enable this, please contact our support team immediately.
    </p>
  `;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Two-factor authentication enabled on ${APP_NAME}`,
    html: baseTemplate(content),
  });
}

/**
 * Send 2FA disabled notification email
 */
export async function send2FADisabledEmail(
  email: string,
  name: string
): Promise<void> {
  const content = `
    <h2 style="margin: 0 0 16px; font-size: 24px; color: ${THEME.text};">
      Two-factor authentication disabled
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      Hi ${name || 'there'},<br><br>
      Two-factor authentication has been disabled for your ${APP_NAME} account.
    </p>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${THEME.textMuted}; line-height: 1.6;">
      We recommend keeping 2FA enabled for better security. You can re-enable it anytime from your security settings.
    </p>
    <p style="margin: 0; font-size: 14px; color: ${THEME.textMuted};">
      If you didn't make this change, please <a href="${APP_URL}/reset-password" style="color: ${THEME.primary};">reset your password</a> immediately.
    </p>
  `;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Two-factor authentication disabled on ${APP_NAME}`,
    html: baseTemplate(content),
  });
}
