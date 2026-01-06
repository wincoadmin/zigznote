/**
 * Webhooks API
 * GET - List all webhooks for user's organization
 * POST - Create a new webhook
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import crypto from 'crypto';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Get webhooks
    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId: user.organizationId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        status: true,
        failureCount: true,
        lastTriggeredAt: true,
        createdAt: true,
      },
    });

    const formattedWebhooks = webhooks.map((w) => ({
      id: w.id,
      name: w.name,
      url: w.url,
      events: w.events,
      status: w.failureCount >= 5 ? 'failed' : w.status === 'active' ? 'active' : 'inactive',
      failureCount: w.failureCount,
      lastTriggeredAt: w.lastTriggeredAt?.toISOString() || null,
      createdAt: w.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: formattedWebhooks,
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, url, events } = body;

    // Validate input
    if (!name || name.length < 1) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!url || !url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Valid HTTPS URL is required' },
        { status: 400 }
      );
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'At least one event is required' },
        { status: 400 }
      );
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Generate signing secret
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    // Create webhook
    const webhook = await prisma.webhook.create({
      data: {
        organizationId: user.organizationId,
        name,
        url,
        events,
        secret,
        status: 'active',
        failureCount: 0,
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        secret: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        signingSecret: webhook.secret, // Only returned on creation
        status: 'active',
        failureCount: 0,
        lastTriggeredAt: null,
        createdAt: webhook.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}
