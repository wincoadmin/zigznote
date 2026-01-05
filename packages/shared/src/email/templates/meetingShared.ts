/**
 * Meeting Shared Email Template
 */

import type { MeetingSharedData } from '../types';
import { baseTemplate, styles, escapeHtml } from './base';

export function meetingShared(data: MeetingSharedData): string {
  const recipientGreeting = data.recipientName
    ? `Hi ${escapeHtml(data.recipientName)},`
    : 'Hi,';

  const messageBlock = data.message
    ? `<div style="${styles.message}">"${escapeHtml(data.message)}"</div>`
    : '';

  const expiryNote = data.expiresAt
    ? `<p style="${styles.mutedText}">This link expires on ${escapeHtml(data.expiresAt)}</p>`
    : '';

  const content = `
    <h2 style="${styles.heading}">${escapeHtml(data.senderName)} shared a meeting with you</h2>
    <p>${recipientGreeting}</p>
    <div style="${styles.card}">
      <h3 style="margin: 0 0 8px; color: #111827;">${escapeHtml(data.meetingTitle)}</h3>
      <p style="${styles.mutedText}; margin: 0;">${escapeHtml(data.meetingDate)}</p>
    </div>
    ${messageBlock}
    <p style="margin: 24px 0;">
      <a href="${escapeHtml(data.shareUrl)}" style="${styles.button}">View Meeting</a>
    </p>
    ${expiryNote}
    <div style="${styles.footer}">
      <p>This meeting was shared with you via zigznote.</p>
    </div>
  `;

  return baseTemplate(content);
}
