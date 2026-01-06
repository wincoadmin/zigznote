/**
 * User Sessions/Login History API
 * GET - Get recent login history
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

    // Get login history
    const loginHistory = await prisma.loginHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        location: true,
        success: true,
        reason: true,
        createdAt: true,
      },
    });

    // Parse user agent to get browser/device info
    const sessions = loginHistory.map((entry) => {
      const ua = entry.userAgent || '';
      let browser = 'Unknown';
      let device = 'Unknown';

      if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Safari')) browser = 'Safari';
      else if (ua.includes('Edge')) browser = 'Edge';

      if (ua.includes('Windows')) device = 'Windows';
      else if (ua.includes('Mac')) device = 'macOS';
      else if (ua.includes('Linux')) device = 'Linux';
      else if (ua.includes('iPhone')) device = 'iPhone';
      else if (ua.includes('Android')) device = 'Android';

      return {
        id: entry.id,
        browser,
        device,
        ipAddress: entry.ipAddress,
        location: entry.location,
        success: entry.success,
        reason: entry.reason,
        createdAt: entry.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch login history' },
      { status: 500 }
    );
  }
}
