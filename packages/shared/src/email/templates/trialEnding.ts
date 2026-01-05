/**
 * Trial Ending Email Template
 */

import type { TrialEndingData } from '../types';
import { baseTemplate, styles, escapeHtml } from './base';

export function trialEnding(data: TrialEndingData): string {
  const urgencyColor = data.daysRemaining <= 1 ? '#dc2626' : data.daysRemaining <= 3 ? '#f59e0b' : '#6366f1';

  const featuresHtml = data.featuresIncluded.map(feature => `
    <li style="margin-bottom: 8px; color: #4b5563;">${escapeHtml(feature)}</li>
  `).join('');

  const content = `
    <h2 style="${styles.heading}">Your trial ends in ${data.daysRemaining} day${data.daysRemaining !== 1 ? 's' : ''}</h2>
    <p>Hi ${escapeHtml(data.userName)},</p>

    <div style="${styles.alertWarning}">
      <p style="margin: 0;">
        <strong style="color: ${urgencyColor};">Your free trial expires on ${escapeHtml(data.trialEndDate)}.</strong>
      </p>
      <p style="margin: 8px 0 0;">Upgrade now to keep access to all your meeting data and features.</p>
    </div>

    <h3 style="margin: 24px 0 12px; color: #374151;">What you'll keep with Pro:</h3>
    <ul style="margin: 0; padding-left: 20px;">
      ${featuresHtml}
    </ul>

    <p style="margin: 24px 0;">
      <a href="${escapeHtml(data.upgradeUrl)}" style="${styles.button}">Upgrade Now</a>
    </p>

    <p style="${styles.mutedText}">
      Questions? Reply to this email and our team will be happy to help.
    </p>

    <div style="${styles.footer}">
      <p>This is a reminder about your zigznote trial.</p>
    </div>
  `;

  return baseTemplate(content);
}
