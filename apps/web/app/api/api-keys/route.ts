/**
 * API Keys Management API
 * Handles CRUD operations for user API keys
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

const KEY_PREFIX = 'sk_live_';
const KEY_LENGTH = 32;
const BCRYPT_ROUNDS = 10;
const MAX_KEYS_PER_USER = 10;

const AVAILABLE_SCOPES = {
  'meetings:read': 'View meetings and meeting details',
  'meetings:write': 'Create, update, and delete meetings',
  'transcripts:read': 'View transcripts and summaries',
  'users:read': 'Read user information',
};

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user - try by ID first, then by email as fallback
    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const keys = await prisma.userApiKey.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: keys,
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API keys' },
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

    // Get user - try by ID first, then by email as fallback
    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, scopes, expiresInDays } = body;

    if (!name || !scopes || scopes.length === 0) {
      return NextResponse.json(
        { error: 'Name and at least one scope are required' },
        { status: 400 }
      );
    }

    // Validate scopes
    const invalidScopes = scopes.filter((s: string) => !(s in AVAILABLE_SCOPES));
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Invalid scopes: ${invalidScopes.join(', ')}` },
        { status: 400 }
      );
    }

    // Limit keys per user
    const existingCount = await prisma.userApiKey.count({
      where: { userId: user.id, revokedAt: null },
    });

    if (existingCount >= MAX_KEYS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_KEYS_PER_USER} API keys per user` },
        { status: 400 }
      );
    }

    // Generate secure random key
    const keyBytes = randomBytes(KEY_LENGTH);
    const keyBase64 = keyBytes.toString('base64url');
    const fullKey = `${KEY_PREFIX}${keyBase64}`;

    // Hash for storage
    const keyHash = await bcrypt.hash(fullKey, BCRYPT_ROUNDS);

    // Calculate expiration
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Store in database
    const apiKey = await prisma.userApiKey.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        name,
        keyPrefix: fullKey.substring(0, 15),
        keyHash,
        scopes,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...apiKey,
        key: fullKey, // Full key - shown ONCE
      },
      message: 'API key created. Save this key now - it cannot be retrieved later.',
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
