/**
 * HubSpotIntegration
 * OAuth-based HubSpot CRM integration
 */

import type { PrismaClient } from '@zigznote/database';
import { OAuthIntegration } from '../base/OAuthIntegration';
import {
  OAuthConfig,
  IntegrationResult,
  MeetingSummaryPayload,
  IntegrationCredentials,
} from '../base/types';
import { config } from '../../config';

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
  };
}

// HubSpotCompany interface reserved for future CRM features
// interface HubSpotCompany {
//   id: string;
//   properties: { name?: string; domain?: string; };
// }

interface HubSpotEngagement {
  id: string;
  properties: Record<string, unknown>;
}

interface HubSpotTask {
  id: string;
  properties: {
    hs_task_subject: string;
    hs_task_body?: string;
    hs_task_status: string;
    hs_timestamp: string;
  };
}

export class HubSpotIntegration extends OAuthIntegration {
  protected oauthConfig: OAuthConfig = {
    clientId: config.hubspot?.clientId || '',
    clientSecret: config.hubspot?.clientSecret || '',
    redirectUri:
      config.hubspot?.redirectUri || `${config.apiUrl}/api/v1/integrations/hubspot/callback`,
    scopes: [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.companies.read',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'sales-email-read',
      'timeline',
    ],
    authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
  };

  private readonly apiBase = 'https://api.hubapi.com';

  constructor(prisma: PrismaClient) {
    super(prisma, 'hubspot');
  }

  /**
   * Save HubSpot connection with portal info
   */
  async saveHubSpotConnection(
    organizationId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<IntegrationResult> {
    // Get portal info
    const portalInfo = await this.getPortalInfo(accessToken);

    const credentials: IntegrationCredentials = {
      accessToken,
      refreshToken,
      tokenExpires: new Date(Date.now() + expiresIn * 1000),
      portalId: portalInfo.data?.portalId,
      hubDomain: portalInfo.data?.hubDomain,
    };

    const settings = {
      enabled: true,
      autoSync: false,
      createTasks: true,
      logMeetings: true,
    };

    await this.saveConnection(organizationId, credentials, settings);

    return { success: true };
  }

  /**
   * Get HubSpot portal info
   */
  private async getPortalInfo(
    accessToken: string
  ): Promise<IntegrationResult<{ portalId: string; hubDomain: string }>> {
    try {
      const response = await fetch(`${this.apiBase}/oauth/v1/access-tokens/${accessToken}`);

      if (!response.ok) {
        return { success: false, error: 'Failed to get portal info' };
      }

      const data = (await response.json()) as { hub_id: string; hub_domain: string };

      return {
        success: true,
        data: {
          portalId: data.hub_id.toString(),
          hubDomain: data.hub_domain,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search for contacts by email
   */
  async searchContacts(
    organizationId: string,
    emails: string[]
  ): Promise<IntegrationResult<HubSpotContact[]>> {
    if (emails.length === 0) {
      return { success: true, data: [] };
    }

    const result = await this.authenticatedRequest<{
      results: HubSpotContact[];
    }>(organizationId, `${this.apiBase}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: emails.map((email) => ({
              propertyName: 'email',
              operator: 'EQ',
              value: email,
            })),
          },
        ],
        properties: ['email', 'firstname', 'lastname', 'company'],
        limit: 100,
      }),
    });

    if (!result.success) {
      return result as unknown as IntegrationResult<HubSpotContact[]>;
    }

    return {
      success: true,
      data: result.data?.results || [],
    };
  }

  /**
   * Match meeting participants to HubSpot contacts
   */
  async matchParticipantsToContacts(
    organizationId: string,
    participants: Array<{ name: string; email?: string }>
  ): Promise<
    IntegrationResult<{
      matched: Array<{ participant: { name: string; email?: string }; contact: HubSpotContact }>;
      unmatched: Array<{ name: string; email?: string }>;
    }>
  > {
    const emails = participants.filter((p) => p.email).map((p) => p.email as string);

    if (emails.length === 0) {
      return {
        success: true,
        data: {
          matched: [],
          unmatched: participants,
        },
      };
    }

    const contactsResult = await this.searchContacts(organizationId, emails);

    if (!contactsResult.success) {
      return {
        success: false,
        error: contactsResult.error,
        requiresReconfiguration: contactsResult.requiresReconfiguration,
      };
    }

    const contacts = contactsResult.data || [];
    const contactByEmail = new Map(
      contacts.map((c) => [c.properties.email?.toLowerCase(), c])
    );

    const matched: Array<{
      participant: { name: string; email?: string };
      contact: HubSpotContact;
    }> = [];
    const unmatched: Array<{ name: string; email?: string }> = [];

    for (const participant of participants) {
      if (participant.email) {
        const contact = contactByEmail.get(participant.email.toLowerCase());
        if (contact) {
          matched.push({ participant, contact });
        } else {
          unmatched.push(participant);
        }
      } else {
        unmatched.push(participant);
      }
    }

    return {
      success: true,
      data: { matched, unmatched },
    };
  }

  /**
   * Log meeting as engagement/activity
   */
  async logMeetingActivity(
    organizationId: string,
    payload: MeetingSummaryPayload,
    contactIds: string[]
  ): Promise<IntegrationResult<HubSpotEngagement>> {
    const connection = await this.getConnection(organizationId);

    if (!connection?.settings.logMeetings) {
      return { success: false, error: 'Meeting logging disabled' };
    }

    const noteBody = this.buildMeetingNoteBody(payload);

    // Create engagement (meeting)
    const result = await this.authenticatedRequest<HubSpotEngagement>(
      organizationId,
      `${this.apiBase}/crm/v3/objects/meetings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            hs_meeting_title: payload.title,
            hs_meeting_body: noteBody,
            hs_meeting_start_time: payload.startTime.toISOString(),
            hs_meeting_end_time: payload.endTime?.toISOString() || payload.startTime.toISOString(),
            hs_meeting_outcome: 'COMPLETED',
            hs_internal_meeting_notes: payload.summary.executiveSummary,
          },
          associations: contactIds.map((contactId) => ({
            to: { id: contactId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 200 }],
          })),
        }),
      }
    );

    if (!result.success) {
      this.log('error', 'Failed to log HubSpot meeting', {
        organizationId,
        meetingId: payload.meetingId,
        error: result.error,
      });
    }

    return result;
  }

  /**
   * Create tasks from action items
   */
  async createTasksFromActionItems(
    organizationId: string,
    payload: MeetingSummaryPayload,
    contactIds: string[]
  ): Promise<IntegrationResult<HubSpotTask[]>> {
    const connection = await this.getConnection(organizationId);

    if (!connection?.settings.createTasks) {
      return { success: false, error: 'Task creation disabled' };
    }

    if (payload.actionItems.length === 0) {
      return { success: true, data: [] };
    }

    const tasks: HubSpotTask[] = [];

    for (const item of payload.actionItems) {
      const dueDate = item.dueDate ? new Date(item.dueDate) : new Date();
      dueDate.setDate(dueDate.getDate() + 7); // Default 7 days if no due date

      const result = await this.authenticatedRequest<HubSpotTask>(
        organizationId,
        `${this.apiBase}/crm/v3/objects/tasks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              hs_task_subject: item.text.substring(0, 200),
              hs_task_body: `From meeting: ${payload.title}\n\n${item.text}${item.assignee ? `\n\nAssignee: ${item.assignee}` : ''}`,
              hs_task_status: 'NOT_STARTED',
              hs_task_priority: 'MEDIUM',
              hs_timestamp: dueDate.toISOString(),
            },
            associations:
              contactIds.length > 0
                ? [
                    {
                      to: { id: contactIds[0] },
                      types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }],
                    },
                  ]
                : undefined,
          }),
        }
      );

      if (result.success && result.data) {
        tasks.push(result.data);
      }
    }

    return { success: true, data: tasks };
  }

  /**
   * Send meeting summary (main method)
   */
  async sendMeetingSummary(
    organizationId: string,
    payload: MeetingSummaryPayload
  ): Promise<IntegrationResult> {
    // Match participants to contacts
    const matchResult = await this.matchParticipantsToContacts(
      organizationId,
      payload.participants
    );

    if (!matchResult.success) {
      return matchResult;
    }

    const contactIds = matchResult.data?.matched.map((m) => m.contact.id) || [];

    // Log meeting activity
    const meetingResult = await this.logMeetingActivity(organizationId, payload, contactIds);

    // Create tasks from action items
    const tasksResult = await this.createTasksFromActionItems(
      organizationId,
      payload,
      contactIds
    );

    return {
      success: true,
      data: {
        meeting: meetingResult.success ? meetingResult.data : null,
        tasks: tasksResult.success ? tasksResult.data : [],
        matchedContacts: matchResult.data?.matched.length || 0,
        unmatchedParticipants: matchResult.data?.unmatched.length || 0,
      },
    };
  }

  /**
   * Test connection
   */
  async testConnection(organizationId: string): Promise<IntegrationResult> {
    const result = await this.authenticatedRequest<{ portalId: number }>(
      organizationId,
      `${this.apiBase}/integrations/v1/me`
    );

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: { portalId: result.data?.portalId },
    };
  }

  /**
   * Build meeting note body
   */
  private buildMeetingNoteBody(payload: MeetingSummaryPayload): string {
    let body = `<h2>${payload.title}</h2>`;
    body += `<p><strong>Date:</strong> ${new Date(payload.startTime).toLocaleString()}</p>`;
    body += `<p><strong>Duration:</strong> ${payload.duration ? Math.round(payload.duration / 60) : '?'} minutes</p>`;
    body += `<p><strong>Participants:</strong> ${payload.participants.map((p) => p.name).join(', ')}</p>`;

    body += `<h3>Summary</h3>`;
    body += `<p>${payload.summary.executiveSummary}</p>`;

    if (payload.summary.topics.length > 0) {
      body += `<h3>Topics Discussed</h3><ul>`;
      for (const topic of payload.summary.topics) {
        body += `<li><strong>${topic.title}:</strong> ${topic.summary}</li>`;
      }
      body += `</ul>`;
    }

    if (payload.summary.decisions.length > 0) {
      body += `<h3>Decisions Made</h3><ul>`;
      for (const decision of payload.summary.decisions) {
        body += `<li>${decision}</li>`;
      }
      body += `</ul>`;
    }

    if (payload.actionItems.length > 0) {
      body += `<h3>Action Items</h3><ul>`;
      for (const item of payload.actionItems) {
        body += `<li>${item.text}`;
        if (item.assignee) body += ` (${item.assignee})`;
        if (item.dueDate) body += ` - Due: ${item.dueDate}`;
        body += `</li>`;
      }
      body += `</ul>`;
    }

    return body;
  }
}
