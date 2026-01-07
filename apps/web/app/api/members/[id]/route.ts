/**
 * Single Member API Route
 * Update member role or remove member
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only admins can update roles
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to update member roles' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Can't change own role
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "admin" or "member"' },
        { status: 400 }
      );
    }

    // Check member exists in same org
    const member = await prisma.user.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        deletedAt: null,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Update role
    const updatedMember = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedMember,
    });
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update member' },
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

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only admins can remove members
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to remove members' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Can't remove yourself
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from the organization' },
        { status: 400 }
      );
    }

    // Check member exists in same org
    const member = await prisma.user.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        deletedAt: null,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Soft delete the member
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Member removed from organization',
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}
