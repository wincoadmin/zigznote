/**
 * Integration Disconnect API
 * DELETE - Disconnect an integration
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';

const SUPPORTED_PROVIDERS = ['slack', 'hubspot', 'google-calendar', 'zoom', 'microsoft-teams'];

export async function DELETE(
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

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Delete the integration connection
    await prisma.integrationConnection.deleteMany({
      where: {
        organizationId: user.organizationId,
        provider: provider,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting integration:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}
