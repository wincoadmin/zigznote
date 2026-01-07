/**
 * Integration Status API
 * GET - Check if an integration is connected
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';

const SUPPORTED_PROVIDERS = ['slack', 'hubspot', 'google-calendar', 'zoom', 'microsoft-teams', 'salesforce'];

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

    // Check for existing integration connection
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ connected: false });
    }

    // Check IntegrationConnection table
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        organizationId: user.organizationId,
        provider: provider,
        status: 'connected',
      },
    });

    if (connection) {
      const credentials = connection.credentials as Record<string, unknown>;
      return NextResponse.json({
        connected: true,
        status: connection.status,
        teamName: credentials?.teamName || credentials?.team_name,
        portalId: credentials?.portalId || credentials?.portal_id,
        connectedAt: connection.connectedAt,
      });
    }

    return NextResponse.json({ connected: false });
  } catch (error) {
    console.error('Error checking integration status:', error);
    return NextResponse.json({ connected: false });
  }
}
