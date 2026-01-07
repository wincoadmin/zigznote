/**
 * MicrosoftIntegration
 * OAuth-based Microsoft 365/Teams integration for calendar and meetings
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

interface MicrosoftUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle?: string;
  officeLocation?: string;
}

interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  bodyPreview: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  organizer: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  attendees: Array<{
    type: string;
    emailAddress: {
      name: string;
      address: string;
    };
    status: {
      response: string;
    };
  }>;
  onlineMeeting?: {
    joinUrl: string;
  };
  isOnlineMeeting: boolean;
  onlineMeetingProvider?: string;
  webLink: string;
}

interface MicrosoftEventsResponse {
  value: MicrosoftCalendarEvent[];
  '@odata.nextLink'?: string;
}

export class MicrosoftIntegration extends OAuthIntegration {
  private tenantId: string;

  protected oauthConfig: OAuthConfig;

  private readonly graphApiBase = 'https://graph.microsoft.com/v1.0';

  constructor(prisma: PrismaClient) {
    super(prisma, 'microsoft');

    this.tenantId = config.microsoft?.tenantId || 'common';

    this.oauthConfig = {
      clientId: config.microsoft?.clientId || '',
      clientSecret: config.microsoft?.clientSecret || '',
      redirectUri: config.microsoft?.redirectUri || `${config.apiUrl}/api/v1/integrations/microsoft/callback`,
      scopes: [
        'openid',
        'profile',
        'email',
        'offline_access',
        'User.Read',
        'Calendars.Read',
        'OnlineMeetings.Read',
      ],
      authorizationUrl: `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
    };
  }

  /**
   * Get current user info from Microsoft Graph
   */
  async getCurrentUser(organizationId: string): Promise<IntegrationResult<MicrosoftUser>> {
    return this.authenticatedRequest<MicrosoftUser>(organizationId, `${this.graphApiBase}/me`);
  }

  /**
   * Save Microsoft connection with user info
   */
  async saveMicrosoftConnection(
    organizationId: string,
    tokenResponse: OAuthTokenResponse,
    user: MicrosoftUser
  ): Promise<IntegrationResult> {
    const credentials: IntegrationCredentials = {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      tokenExpires: tokenResponse.expiresIn
        ? new Date(Date.now() + tokenResponse.expiresIn * 1000)
        : undefined,
      userId: user.id,
      email: user.mail || user.userPrincipalName,
    };

    const settings = {
      enabled: true,
      autoSync: false,
      userName: user.displayName,
    };

    await this.saveConnection(organizationId, credentials, settings);

    return { success: true };
  }

  /**
   * Get calendar events from Microsoft Graph
   */
  async getCalendarEvents(
    organizationId: string,
    startDateTime?: Date,
    endDateTime?: Date
  ): Promise<IntegrationResult<MicrosoftCalendarEvent[]>> {
    const now = new Date();
    const start = startDateTime || now;
    const end = endDateTime || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

    const params = new URLSearchParams({
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      $select: 'id,subject,bodyPreview,start,end,location,organizer,attendees,onlineMeeting,isOnlineMeeting,onlineMeetingProvider,webLink',
      $orderby: 'start/dateTime',
      $top: '50',
    });

    const result = await this.authenticatedRequest<MicrosoftEventsResponse>(
      organizationId,
      `${this.graphApiBase}/me/calendarView?${params.toString()}`
    );

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error,
        requiresReconfiguration: result.requiresReconfiguration,
      };
    }

    return {
      success: true,
      data: result.data.value,
    };
  }

  /**
   * Get Teams meetings (events with online meeting links)
   */
  async getTeamsMeetings(
    organizationId: string,
    startDateTime?: Date,
    endDateTime?: Date
  ): Promise<IntegrationResult<MicrosoftCalendarEvent[]>> {
    const eventsResult = await this.getCalendarEvents(organizationId, startDateTime, endDateTime);

    if (!eventsResult.success || !eventsResult.data) {
      return eventsResult;
    }

    // Filter to only include Teams meetings
    const teamsMeetings = eventsResult.data.filter(
      (event) =>
        event.isOnlineMeeting &&
        (event.onlineMeetingProvider === 'teamsForBusiness' ||
          event.onlineMeeting?.joinUrl?.includes('teams.microsoft.com'))
    );

    return {
      success: true,
      data: teamsMeetings,
    };
  }

  /**
   * Get specific calendar event by ID
   */
  async getCalendarEvent(
    organizationId: string,
    eventId: string
  ): Promise<IntegrationResult<MicrosoftCalendarEvent>> {
    return this.authenticatedRequest<MicrosoftCalendarEvent>(
      organizationId,
      `${this.graphApiBase}/me/events/${eventId}`
    );
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
        email: result.data?.mail || result.data?.userPrincipalName,
        name: result.data?.displayName,
      },
    };
  }

  /**
   * Send meeting summary - Microsoft doesn't support pushing summaries
   * This is here to satisfy the abstract interface
   */
  async sendMeetingSummary(
    _organizationId: string,
    _payload: MeetingSummaryPayload,
    _options?: Record<string, unknown>
  ): Promise<IntegrationResult> {
    return {
      success: false,
      error: 'Microsoft integration does not support pushing meeting summaries',
    };
  }
}
