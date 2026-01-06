/**
 * Individual Webhook API
 * GET - Get webhook details
 * PUT - Update webhook
 * DELETE - Delete webhook
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        status: webhook.failureCount >= 5 ? 'failed' : webhook.status === 'active' ? 'active' : 'inactive',
        failureCount: webhook.failureCount,
        lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() || null,
        createdAt: webhook.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, url, events, isActive } = body;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Verify webhook exists and belongs to user's org
    const existing = await prisma.webhook.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (url !== undefined) {
      if (!url.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Valid HTTPS URL is required' },
          { status: 400 }
        );
      }
      updateData.url = url;
    }
    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json(
          { error: 'At least one event is required' },
          { status: 400 }
        );
      }
      updateData.events = events;
    }
    if (isActive !== undefined) {
      updateData.status = isActive ? 'active' : 'inactive';
      // Reset failure count when re-enabling
      if (isActive) {
        updateData.failureCount = 0;
      }
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        status: webhook.failureCount >= 5 ? 'failed' : webhook.status === 'active' ? 'active' : 'inactive',
        failureCount: webhook.failureCount,
        lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Verify webhook exists and belongs to user's org
    const existing = await prisma.webhook.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Delete webhook
    await prisma.webhook.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
