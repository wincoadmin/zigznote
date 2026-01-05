/**
 * Action Item Reminder Email Template
 */

import type { ActionItemReminderData } from '../types';
import { baseTemplate, styles, escapeHtml } from './base';

export function actionItemReminder(data: ActionItemReminderData): string {
  const content = `
    <h2 style="${styles.heading}">Action Item Reminder</h2>
    <p>Hi ${escapeHtml(data.userName)},</p>
    <p>You have an action item due ${escapeHtml(data.dueDate)}:</p>
    <div style="${styles.actionItem}">
      <strong>${escapeHtml(data.actionItem)}</strong>
      <p style="${styles.mutedText}; margin: 8px 0 0;">From: ${escapeHtml(data.meetingTitle)}</p>
    </div>
    <p style="margin: 24px 0;">
      <a href="${escapeHtml(data.meetingUrl)}" style="${styles.button}">View Meeting</a>
    </p>
    <div style="${styles.footer}">
      <p>You received this email because you have pending action items in zigznote.</p>
      <p><a href="${escapeHtml(data.unsubscribeUrl)}" style="${styles.footerLink}">Manage notification preferences</a></p>
    </div>
  `;

  return baseTemplate(content);
}
