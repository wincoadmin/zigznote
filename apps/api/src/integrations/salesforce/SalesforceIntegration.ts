/**
 * SalesforceIntegration
 * OAuth-based Salesforce integration for CRM sync
 * - Log meeting summaries to Contacts/Accounts
 * - Create Tasks from action items
 * - Link meetings to Opportunities
 */

import type { PrismaClient } from '@zigznote/database';
import { OAuthIntegration } from '../base/OAuthIntegration';
import {
  OAuthConfig,
  IntegrationResult,
  IntegrationCredentials,
  OAuthTokenResponse,
  MeetingSummaryPayload,
} from '../base/types';
import { config } from '../../config';

interface SalesforceUser {
  id: string;
  username: string;
  email: string;
  name: string;
  organization_id: string;
}

interface SalesforceContact {
  Id: string;
  Name: string;
  Email: string;
  AccountId?: string;
  Account?: {
    Id: string;
    Name: string;
  };
}

// SalesforceAccount and SalesforceTask are returned by query results
// but not directly used as standalone types yet

interface SalesforceQueryResult<T> {
  totalSize: number;
  done: boolean;
  records: T[];
}

interface SalesforceCreateResult {
  id: string;
  success: boolean;
  errors: string[];
}

export class SalesforceIntegration extends OAuthIntegration {
  protected oauthConfig: OAuthConfig = {
    clientId: config.salesforce?.clientId || '',
    clientSecret: config.salesforce?.clientSecret || '',
    redirectUri: config.salesforce?.redirectUri || `${config.apiUrl}/api/v1/integrations/salesforce/callback`,
    scopes: ['api', 'refresh_token', 'full'],
    authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
  };

  constructor(prisma: PrismaClient) {
    super(prisma, 'salesforce');
  }

  /**
   * Override parseTokenResponse for Salesforce-specific response
   */
  protected parseTokenResponse(data: Record<string, unknown>): OAuthTokenResponse & { instance_url?: string } {
    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresIn: undefined, // Salesforce doesn't return expires_in
      tokenType: data.token_type as string,
      scope: data.scope as string,
      instance_url: data.instance_url as string,
    };
  }

  /**
   * Override token exchange to capture instance_url
   */
  async exchangeCodeForTokens(
    code: string
  ): Promise<IntegrationResult<OAuthTokenResponse & { instance_url?: string }>> {
    try {
      const response = await fetch(this.oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: this.oauthConfig.clientId,
          client_secret: this.oauthConfig.clientSecret,
          redirect_uri: this.oauthConfig.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.log('error', 'Salesforce OAuth failed', { status: response.status, error: errorData });
        return {
          success: false,
          error: `Salesforce OAuth failed: ${response.status}`,
        };
      }

      const data = await response.json();
      const tokenResponse = this.parseTokenResponse(data);

      return {
        success: true,
        data: tokenResponse,
      };
    } catch (error) {
      this.log('error', 'Salesforce OAuth error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(organizationId: string): Promise<IntegrationResult<SalesforceUser>> {
    const connection = await this.getConnection(organizationId);
    if (!connection?.credentials.instanceUrl) {
      return { success: false, error: 'Instance URL not found' };
    }

    return this.authenticatedRequest<SalesforceUser>(
      organizationId,
      `${connection.credentials.instanceUrl}/services/oauth2/userinfo`
    );
  }

  /**
   * Save Salesforce connection with user info
   */
  async saveSalesforceConnection(
    organizationId: string,
    tokenResponse: OAuthTokenResponse & { instance_url?: string },
    user: SalesforceUser
  ): Promise<IntegrationResult> {
    const credentials: IntegrationCredentials = {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      instanceUrl: tokenResponse.instance_url,
      userId: user.id,
      email: user.email,
      organizationId: user.organization_id,
    };

    const settings = {
      enabled: true,
      autoSync: false,
      userName: user.name,
      logMeetingsToContacts: true,
      createTasksFromActionItems: true,
    };

    await this.saveConnection(organizationId, credentials, settings);

    return { success: true };
  }

  /**
   * Execute SOQL query
   */
  async query<T>(
    organizationId: string,
    soql: string
  ): Promise<IntegrationResult<SalesforceQueryResult<T>>> {
    const connection = await this.getConnection(organizationId);
    if (!connection?.credentials.instanceUrl) {
      return { success: false, error: 'Instance URL not found' };
    }

    const encodedQuery = encodeURIComponent(soql);
    return this.authenticatedRequest<SalesforceQueryResult<T>>(
      organizationId,
      `${connection.credentials.instanceUrl}/services/data/v58.0/query?q=${encodedQuery}`
    );
  }

  /**
   * Find contacts by email addresses
   */
  async findContactsByEmail(
    organizationId: string,
    emails: string[]
  ): Promise<IntegrationResult<SalesforceContact[]>> {
    if (emails.length === 0) {
      return { success: true, data: [] };
    }

    const emailList = emails.map((e) => `'${e.replace(/'/g, "\\'")}'`).join(',');
    const soql = `SELECT Id, Name, Email, AccountId, Account.Id, Account.Name FROM Contact WHERE Email IN (${emailList})`;

    const result = await this.query<SalesforceContact>(organizationId, soql);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error,
        requiresReconfiguration: result.requiresReconfiguration,
      };
    }

    return {
      success: true,
      data: result.data.records,
    };
  }

  /**
   * Create a Task in Salesforce
   */
  async createTask(
    organizationId: string,
    task: {
      subject: string;
      description?: string;
      status?: string;
      priority?: string;
      whoId?: string; // Contact or Lead ID
      whatId?: string; // Account, Opportunity, etc. ID
      activityDate?: string;
    }
  ): Promise<IntegrationResult<SalesforceCreateResult>> {
    const connection = await this.getConnection(organizationId);
    if (!connection?.credentials.instanceUrl) {
      return { success: false, error: 'Instance URL not found' };
    }

    return this.authenticatedRequest<SalesforceCreateResult>(
      organizationId,
      `${connection.credentials.instanceUrl}/services/data/v58.0/sobjects/Task`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Subject: task.subject,
          Description: task.description,
          Status: task.status || 'Not Started',
          Priority: task.priority || 'Normal',
          WhoId: task.whoId,
          WhatId: task.whatId,
          ActivityDate: task.activityDate,
        }),
      }
    );
  }

  /**
   * Create an Event (meeting log) in Salesforce
   */
  async createEvent(
    organizationId: string,
    event: {
      subject: string;
      description?: string;
      startDateTime: Date;
      endDateTime: Date;
      whoId?: string;
      whatId?: string;
    }
  ): Promise<IntegrationResult<SalesforceCreateResult>> {
    const connection = await this.getConnection(organizationId);
    if (!connection?.credentials.instanceUrl) {
      return { success: false, error: 'Instance URL not found' };
    }

    return this.authenticatedRequest<SalesforceCreateResult>(
      organizationId,
      `${connection.credentials.instanceUrl}/services/data/v58.0/sobjects/Event`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Subject: event.subject,
          Description: event.description,
          StartDateTime: event.startDateTime.toISOString(),
          EndDateTime: event.endDateTime.toISOString(),
          WhoId: event.whoId,
          WhatId: event.whatId,
        }),
      }
    );
  }

  /**
   * Log meeting to Salesforce
   * - Creates an Event record
   * - Links to matching Contacts
   * - Creates Tasks from action items
   */
  async logMeeting(
    organizationId: string,
    payload: MeetingSummaryPayload
  ): Promise<IntegrationResult<{ eventId?: string; taskIds: string[] }>> {
    const connection = await this.getConnection(organizationId);

    if (!connection) {
      return {
        success: false,
        error: 'Salesforce not connected',
        requiresReconfiguration: true,
      };
    }

    const results = {
      eventId: undefined as string | undefined,
      taskIds: [] as string[],
    };

    try {
      // Find contacts from participant emails
      const emails = payload.participants
        .map((p) => p.email)
        .filter((e): e is string => !!e);

      const contactsResult = await this.findContactsByEmail(organizationId, emails);
      const contacts = contactsResult.success ? contactsResult.data || [] : [];

      // Get first contact's ID for linking
      const primaryContact = contacts[0];
      const primaryContactId = primaryContact?.Id;
      const primaryAccountId = primaryContact?.AccountId;

      // Create Event for the meeting
      const eventDescription = [
        `**Summary:** ${payload.summary.executiveSummary}`,
        '',
        '**Topics:**',
        ...payload.summary.topics.map((t) => `- ${t.title}: ${t.summary}`),
        '',
        '**Decisions:**',
        ...payload.summary.decisions.map((d) => `- ${d}`),
        '',
        '**Participants:**',
        ...payload.participants.map((p) => `- ${p.name}${p.email ? ` (${p.email})` : ''}`),
      ].join('\n');

      const eventResult = await this.createEvent(organizationId, {
        subject: `Meeting: ${payload.title}`,
        description: eventDescription.substring(0, 32000), // Salesforce limit
        startDateTime: payload.startTime,
        endDateTime: payload.endTime || new Date(payload.startTime.getTime() + (payload.duration || 3600) * 1000),
        whoId: primaryContactId,
        whatId: primaryAccountId,
      });

      if (eventResult.success && eventResult.data) {
        results.eventId = eventResult.data.id;
      }

      // Create Tasks from action items
      if (connection.settings.createTasksFromActionItems) {
        for (const item of payload.actionItems) {
          const taskResult = await this.createTask(organizationId, {
            subject: item.text.substring(0, 255),
            description: `From meeting: ${payload.title}\n\n${item.text}`,
            status: 'Not Started',
            priority: 'Normal',
            whoId: primaryContactId,
            whatId: primaryAccountId,
            activityDate: item.dueDate,
          });

          if (taskResult.success && taskResult.data) {
            results.taskIds.push(taskResult.data.id);
          }
        }
      }

      this.log('info', 'Meeting logged to Salesforce', {
        organizationId,
        meetingId: payload.meetingId,
        eventId: results.eventId,
        taskCount: results.taskIds.length,
      });

      return { success: true, data: results };
    } catch (error) {
      this.log('error', 'Failed to log meeting to Salesforce', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test connection by fetching user info
   */
  async testConnection(organizationId: string): Promise<IntegrationResult> {
    const result = await this.getCurrentUser(organizationId);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        requiresReconfiguration: result.requiresReconfiguration,
      };
    }

    return {
      success: true,
      data: {
        email: result.data?.email,
        name: result.data?.name,
      },
    };
  }

  /**
   * Send meeting summary - delegates to logMeeting
   */
  async sendMeetingSummary(
    organizationId: string,
    payload: MeetingSummaryPayload,
    _options?: Record<string, unknown>
  ): Promise<IntegrationResult> {
    return this.logMeeting(organizationId, payload);
  }
}
