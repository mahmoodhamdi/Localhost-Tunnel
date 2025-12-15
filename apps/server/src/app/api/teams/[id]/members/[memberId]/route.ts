import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';

// Helper to check team access and role
async function checkTeamAccess(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { userId },
      },
    },
  });

  if (!team) {
    return { team: null, role: null };
  }

  const role = team.ownerId === userId
    ? 'OWNER'
    : team.members[0]?.role || null;

  return { team, role };
}

// PATCH /api/teams/[id]/members/[memberId] - Update member role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth();
    const { id: teamId, memberId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { team, role } = await checkTeamAccess(teamId, session.user.id);

    if (!team || !role) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found or access denied' } },
        { status: 404 }
      );
    }

    // Only owner can change roles
    if (role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only team owner can change member roles' } },
        { status: 403 }
      );
    }

    // Find the member
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!member || member.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Cannot change owner role
    if (member.role === 'OWNER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot change owner role' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role: newRole } = body;

    // Validate role
    if (!newRole || !['ADMIN', 'MEMBER'].includes(newRole)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid role. Must be ADMIN or MEMBER' } },
        { status: 400 }
      );
    }

    // Update member role
    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role: newRole },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedMember.id,
        role: updatedMember.role,
        user: updatedMember.user,
        updatedAt: updatedMember.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to update member role:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update member role' } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id]/members/[memberId] - Remove member from team
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth();
    const { id: teamId, memberId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { team, role } = await checkTeamAccess(teamId, session.user.id);

    if (!team || !role) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found or access denied' } },
        { status: 404 }
      );
    }

    // Find the member
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!member || member.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Cannot remove owner
    if (member.role === 'OWNER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot remove team owner' } },
        { status: 403 }
      );
    }

    // Check permissions:
    // - Owner can remove anyone (except themselves as owner)
    // - Admin can remove members (not other admins)
    // - Members can only remove themselves
    const isSelf = member.userId === session.user.id;
    const canRemove =
      role === 'OWNER' ||
      (role === 'ADMIN' && member.role === 'MEMBER') ||
      isSelf;

    if (!canRemove) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to remove this member' } },
        { status: 403 }
      );
    }

    // Remove member
    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Member removed successfully',
        removedMember: {
          id: member.id,
          user: member.user,
        },
      },
    });
  } catch (error) {
    console.error('Failed to remove member:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove member' } },
      { status: 500 }
    );
  }
}
