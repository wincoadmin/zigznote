/**
 * Webhook Test API
 * POST - Send a test event to the webhook
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import crypto from 'crypto';

export async function POST(
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

    // Get webhook
    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Create test payload
    const payload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test event from zigznote',
        webhookId: webhook.id,
        webhookName: webhook.name,
      },
    };

    const payloadString = JSON.stringify(payload);

    // Create signature
    const timestamp = Math.floor(Date.now() / 1000);
    const signaturePayload = `${timestamp}.${payloadString}`;
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(signaturePayload)
      .digest('hex');

    // Send webhook
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `t=${timestamp},v1=${signature}`,
          'X-Webhook-Id': webhook.id,
          'User-Agent': 'zigznote-webhook/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      // Update last triggered
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          failureCount: response.ok ? 0 : webhook.failureCount + 1,
        },
      });

      if (response.ok) {
        return NextResponse.json({
          success: true,
          message: 'Test webhook sent successfully',
          statusCode: response.status,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: `Webhook returned status ${response.status}`,
          statusCode: response.status,
        });
      }
    } catch (fetchError) {
      // Update failure count
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          failureCount: webhook.failureCount + 1,
        },
      });

      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      return NextResponse.json({
        success: false,
        error: `Failed to send webhook: ${errorMessage}`,
      });
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    );
  }
}
