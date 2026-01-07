/**
 * Organization Settings API
 * Direct database access (following Next.js API route pattern)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create organization settings
    let settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: user.organizationId },
    });

    if (!settings) {
      settings = await prisma.organizationSettings.create({
        data: { organizationId: user.organizationId },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        organizationName: user.organization?.name || '',
        recordingConsentEnabled: settings.recordingConsentEnabled,
        consentAnnouncementText: settings.consentAnnouncementText,
        requireExplicitConsent: settings.requireExplicitConsent,
        defaultBotName: settings.defaultBotName,
        joinAnnouncementEnabled: settings.joinAnnouncementEnabled,
        autoJoinMeetings: (settings as any).autoJoinMeetings ?? true,
        autoGenerateSummaries: (settings as any).autoGenerateSummaries ?? true,
        extractActionItems: (settings as any).extractActionItems ?? true,
      },
    });
  } catch (error) {
    console.error('Error fetching organization settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organization settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and check admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to update organization settings' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Filter only allowed fields
    const allowedFields = [
      'recordingConsentEnabled',
      'consentAnnouncementText',
      'requireExplicitConsent',
      'defaultBotName',
      'joinAnnouncementEnabled',
      'autoJoinMeetings',
      'autoGenerateSummaries',
      'extractActionItems',
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Upsert organization settings
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        recordingConsentEnabled: settings.recordingConsentEnabled,
        consentAnnouncementText: settings.consentAnnouncementText,
        requireExplicitConsent: settings.requireExplicitConsent,
        defaultBotName: settings.defaultBotName,
        joinAnnouncementEnabled: settings.joinAnnouncementEnabled,
        autoJoinMeetings: (settings as any).autoJoinMeetings ?? true,
        autoGenerateSummaries: (settings as any).autoGenerateSummaries ?? true,
        extractActionItems: (settings as any).extractActionItems ?? true,
      },
    });
  } catch (error) {
    console.error('Error updating organization settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update organization settings' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and check admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to delete organization' },
        { status: 403 }
      );
    }

    // Delete organization (cascade will delete related data)
    await prisma.organization.delete({
      where: { id: user.organizationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
