/**
 * Avatar Upload API
 * POST - Upload a new avatar image
 * DELETE - Remove avatar
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'avatars');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${session.user.id}-${Date.now()}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Generate URL
    const avatarUrl = `/uploads/avatars/${filename}`;

    // Delete old avatar if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { avatarUrl: true },
    });

    if (currentUser?.avatarUrl?.startsWith('/uploads/avatars/')) {
      const oldFilename = currentUser.avatarUrl.split('/').pop();
      if (oldFilename) {
        const oldPath = join(UPLOAD_DIR, oldFilename);
        if (existsSync(oldPath)) {
          await unlink(oldPath).catch(() => {});
        }
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl },
      select: {
        id: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { avatarUrl: user.avatarUrl },
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
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

    // Get current avatar
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { avatarUrl: true },
    });

    // Delete file if it's a local upload
    if (currentUser?.avatarUrl?.startsWith('/uploads/avatars/')) {
      const filename = currentUser.avatarUrl.split('/').pop();
      if (filename) {
        const filepath = join(UPLOAD_DIR, filename);
        if (existsSync(filepath)) {
          await unlink(filepath).catch(() => {});
        }
      }
    }

    // Clear avatar URL
    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return NextResponse.json(
      { error: 'Failed to delete avatar' },
      { status: 500 }
    );
  }
}
