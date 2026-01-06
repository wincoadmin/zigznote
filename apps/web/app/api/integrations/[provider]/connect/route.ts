/**
 * Integration Connect API
 * GET - Initiate OAuth flow for an integration
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SUPPORTED_PROVIDERS = ['slack', 'hubspot', 'google-calendar', 'zoom', 'microsoft-teams'];

// OAuth configuration - in production these would come from env vars
const OAUTH_CONFIGS: Record<string, { clientId?: string; scopes: string[] }> = {
  slack: {
    clientId: process.env.SLACK_CLIENT_ID,
    scopes: ['channels:read', 'chat:write', 'users:read'],
  },
  hubspot: {
    clientId: process.env.HUBSPOT_CLIENT_ID,
    scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write'],
  },
  'google-calendar': {
    clientId: process.env.GOOGLE_CLIENT_ID,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  },
  zoom: {
    clientId: process.env.ZOOM_CLIENT_ID,
    scopes: ['meeting:read', 'user:read'],
  },
  'microsoft-teams': {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    scopes: ['Calendars.Read', 'OnlineMeetings.Read'],
  },
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const session = await auth();
    const { provider } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }

    const config = OAUTH_CONFIGS[provider];

    // Check if OAuth is configured for this provider
    if (!config?.clientId) {
      return NextResponse.json({
        error: 'not_configured',
        message: `${provider} integration is not configured. Please contact your administrator to set up OAuth credentials.`,
        provider,
      }, { status: 400 });
    }

    // Generate OAuth URL based on provider
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/${provider}/callback`;
    const state = Buffer.from(JSON.stringify({
      userId: session.user.id,
      nonce: Math.random().toString(36).substring(7),
    })).toString('base64');

    let authUrl: string;

    switch (provider) {
      case 'slack':
        authUrl = `https://slack.com/oauth/v2/authorize?client_id=${config.clientId}&scope=${config.scopes.join(',')}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
        break;
      case 'hubspot':
        authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${config.clientId}&scope=${config.scopes.join(' ')}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
        break;
      case 'google-calendar':
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.clientId}&scope=${config.scopes.join(' ')}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&access_type=offline`;
        break;
      case 'zoom':
        authUrl = `https://zoom.us/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code`;
        break;
      case 'microsoft-teams':
        authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${config.clientId}&scope=${config.scopes.join(' ')}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code`;
        break;
      default:
        return NextResponse.json({ error: 'Provider not supported' }, { status: 400 });
    }

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
