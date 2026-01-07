/**
 * Organization Settings API
 * Handles both Organization model fields and OrganizationSettings model fields
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
        // Organization model fields
        organizationName: user.organization?.name || '',
        timezone: user.organization?.timezone || 'UTC',
        industry: user.organization?.industry || '',
        companySize: user.organization?.companySize || '',
        website: user.organization?.website || '',
        // OrganizationSettings model fields
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

    // Fields for Organization model
    const orgFields = ['name', 'timezone', 'industry', 'companySize', 'website'];
    const orgUpdateData: Record<string, any> = {};

    for (const field of orgFields) {
      if (body[field] !== undefined) {
        orgUpdateData[field] = body[field];
      }
    }

    // Update Organization if there are org fields
    if (Object.keys(orgUpdateData).length > 0) {
      await prisma.organization.update({
        where: { id: user.organizationId },
        data: orgUpdateData,
      });
    }

    // Fields for OrganizationSettings model
    const settingsFields = [
      'recordingConsentEnabled',
      'consentAnnouncementText',
      'requireExplicitConsent',
      'defaultBotName',
      'joinAnnouncementEnabled',
      'autoJoinMeetings',
      'autoGenerateSummaries',
      'extractActionItems',
    ];

    const settingsUpdateData: Record<string, any> = {};
    for (const field of settingsFields) {
      if (body[field] !== undefined) {
        settingsUpdateData[field] = body[field];
      }
    }

    // Upsert OrganizationSettings if there are settings fields
    let settings;
    if (Object.keys(settingsUpdateData).length > 0) {
      settings = await prisma.organizationSettings.upsert({
        where: { organizationId: user.organizationId },
        create: {
          organizationId: user.organizationId,
          ...settingsUpdateData,
        },
        update: settingsUpdateData,
      });
    } else {
      settings = await prisma.organizationSettings.findUnique({
        where: { organizationId: user.organizationId },
      });
    }

    // Fetch updated org for response
    const updatedOrg = await prisma.organization.findUnique({
      where: { id: user.organizationId },
    });

    return NextResponse.json({
      success: true,
      data: {
        organizationName: updatedOrg?.name || '',
        timezone: updatedOrg?.timezone || 'UTC',
        industry: updatedOrg?.industry || '',
        companySize: updatedOrg?.companySize || '',
        website: updatedOrg?.website || '',
        recordingConsentEnabled: settings?.recordingConsentEnabled ?? true,
        consentAnnouncementText: settings?.consentAnnouncementText,
        requireExplicitConsent: settings?.requireExplicitConsent ?? false,
        defaultBotName: settings?.defaultBotName,
        joinAnnouncementEnabled: settings?.joinAnnouncementEnabled ?? true,
        autoJoinMeetings: (settings as any)?.autoJoinMeetings ?? true,
        autoGenerateSummaries: (settings as any)?.autoGenerateSummaries ?? true,
        extractActionItems: (settings as any)?.extractActionItems ?? true,
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
