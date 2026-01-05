/**
 * Weekly Digest Email Template
 */

import type { WeeklyDigestData } from '../types';
import { baseTemplate, styles, escapeHtml } from './base';

export function weeklyDigest(data: WeeklyDigestData): string {
  const topMeetingsHtml = data.topMeetings.length > 0
    ? data.topMeetings.map(meeting => `
        <div style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <a href="${escapeHtml(meeting.url)}" style="color: #6366f1; text-decoration: none; font-weight: 500;">
            ${escapeHtml(meeting.title)}
          </a>
          <p style="${styles.mutedText}; margin: 4px 0 0;">${escapeHtml(meeting.date)}</p>
        </div>
      `).join('')
    : '<p style="' + styles.mutedText + '">No meetings this week</p>';

  const pendingItemsHtml = data.pendingActionItems.length > 0
    ? data.pendingActionItems.slice(0, 5).map(item => `
        <div style="${styles.actionItem}">
          <p style="margin: 0; font-weight: 500;">${escapeHtml(item.text)}</p>
          <p style="${styles.mutedText}; margin: 4px 0 0;">
            From: ${escapeHtml(item.meetingTitle)}
            ${item.dueDate ? ` | Due: ${escapeHtml(item.dueDate)}` : ''}
          </p>
        </div>
      `).join('')
    : '<p style="' + styles.mutedText + '">All caught up! No pending action items.</p>';

  const content = `
    <h2 style="${styles.heading}">Your Weekly Summary</h2>
    <p>Hi ${escapeHtml(data.userName)},</p>
    <p>Here's your meeting summary for ${escapeHtml(data.weekStart)} - ${escapeHtml(data.weekEnd)}:</p>

    <div style="${styles.card}">
      <div style="display: flex; justify-content: space-between; text-align: center;">
        <div style="flex: 1;">
          <p style="font-size: 32px; font-weight: 700; color: #6366f1; margin: 0;">${data.meetingsCount}</p>
          <p style="${styles.mutedText}; margin: 4px 0 0;">Meetings</p>
        </div>
        <div style="flex: 1;">
          <p style="font-size: 32px; font-weight: 700; color: #6366f1; margin: 0;">${data.actionItemsCount}</p>
          <p style="${styles.mutedText}; margin: 4px 0 0;">Action Items</p>
        </div>
        <div style="flex: 1;">
          <p style="font-size: 32px; font-weight: 700; color: #10b981; margin: 0;">${data.completedCount}</p>
          <p style="${styles.mutedText}; margin: 4px 0 0;">Completed</p>
        </div>
      </div>
    </div>

    <h3 style="margin: 24px 0 12px; color: #374151;">Recent Meetings</h3>
    ${topMeetingsHtml}

    <h3 style="margin: 24px 0 12px; color: #374151;">Pending Action Items</h3>
    ${pendingItemsHtml}

    <p style="margin: 24px 0;">
      <a href="${escapeHtml(data.dashboardUrl)}" style="${styles.button}">Open Dashboard</a>
    </p>

    <div style="${styles.footer}">
      <p>You received this weekly digest because you're subscribed to zigznote updates.</p>
      <p><a href="${escapeHtml(data.unsubscribeUrl)}" style="${styles.footerLink}">Manage notification preferences</a></p>
    </div>
  `;

  return baseTemplate(content);
}
