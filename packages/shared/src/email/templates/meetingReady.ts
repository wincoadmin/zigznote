/**
 * Meeting Ready Email Template
 */

import type { MeetingReadyData } from '../types';
import { baseTemplate, styles, escapeHtml } from './base';

export function meetingReady(data: MeetingReadyData): string {
  const content = `
    <h2 style="${styles.heading}">Your meeting is ready!</h2>
    <p>Hi ${escapeHtml(data.userName)},</p>
    <p>Great news! Your meeting "<strong>${escapeHtml(data.meetingTitle)}</strong>" from ${escapeHtml(data.meetingDate)} has been transcribed and summarized.</p>
    <p style="margin: 24px 0;">
      <a href="${escapeHtml(data.meetingUrl)}" style="${styles.button}">View Meeting</a>
    </p>
    <div style="${styles.footer}">
      <p>You received this email because you recorded a meeting with zigznote.</p>
      <p><a href="${escapeHtml(data.unsubscribeUrl)}" style="${styles.footerLink}">Manage notification preferences</a></p>
    </div>
  `;

  return baseTemplate(content);
}
