/**
 * Welcome Email Template
 */

import type { WelcomeEmailData } from '../types';
import { baseTemplate, styles, escapeHtml } from './base';

export function welcome(data: WelcomeEmailData): string {
  const content = `
    <h2 style="${styles.heading}">Welcome to zigznote!</h2>
    <p>Hi ${escapeHtml(data.userName)},</p>
    <p>Thanks for signing up! We're excited to help you get more from your meetings.</p>

    <div style="${styles.card}">
      <h3 style="margin: 0 0 16px; color: #374151;">Get started in 3 easy steps:</h3>
      <ol style="margin: 0; padding-left: 20px; color: #4b5563;">
        <li style="margin-bottom: 12px;">Connect your calendar to automatically detect meetings</li>
        <li style="margin-bottom: 12px;">Join your first meeting - our bot will join and take notes</li>
        <li style="margin-bottom: 12px;">Review your transcript, summary, and action items</li>
      </ol>
    </div>

    <p style="margin: 24px 0;">
      <a href="${escapeHtml(data.loginUrl)}" style="${styles.button}">Go to Dashboard</a>
      <a href="${escapeHtml(data.guideUrl)}" style="${styles.buttonSecondary}; margin-left: 12px;">Read Getting Started Guide</a>
    </p>

    <p>Need help? Reply to this email or check out our <a href="https://zigznote.com/help" style="color: #6366f1;">help center</a>.</p>

    <div style="${styles.footer}">
      <p>Welcome to the zigznote family!</p>
      <p style="${styles.mutedText}">zigznote - Your meetings, simplified</p>
    </div>
  `;

  return baseTemplate(content);
}
