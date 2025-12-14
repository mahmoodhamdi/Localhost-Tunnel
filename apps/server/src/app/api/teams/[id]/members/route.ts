import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';

// Helper to get user's role in team
async function getUserTeamRole(teamId: string, userId: string): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { userId },
      },
    },
  });

  if (!team) return null;

  return team.ownerId === userId
    ? 'OWNER'
    : team.members[0]?.role || null;
}

// GET /api/teams/[id]/members - List team members
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const role = await getUserTeamRole(params.id, session.user.id);

    if (!role) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found or access denied' } },
        { status: 404 }
      );
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: [
        { role: 'asc' }, // OWNER first
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
        joinedAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error('Failed to list members:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list members' } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id]/members - Remove a member
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'User ID is required' } },
        { status: 400 }
      );
    }

    const role = await getUserTeamRole(params.id, session.user.id);

    if (!role) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found or access denied' } },
        { status: 404 }
      );
    }

    // Check if user is trying to remove themselves (leave team)
    const isSelfRemoval = userId === session.user.id;

    // Get target user's role
    const targetMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: params.id,
          userId,
        },
      },
    });

    if (!targetMember) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Owner cannot leave (must transfer ownership first)
    if (targetMember.role === 'OWNER' && isSelfRemoval) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Owner cannot leave. Transfer ownership first.' } },
        { status: 403 }
      );
    }

    // Only owner and admin can remove others
    if (!isSelfRemoval && role !== 'OWNER' && role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to remove members' } },
        { status: 403 }
      );
    }

    // Admin cannot remove owner or other admins
    if (role === 'ADMIN' && (targetMember.role === 'OWNER' || targetMember.role === 'ADMIN')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot remove owner or admin' } },
        { status: 403 }
      );
    }

    // Remove member
    await prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId: params.id,
          userId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: isSelfRemoval ? 'Left team successfully' : 'Member removed successfully' },
    });
  } catch (error) {
    console.error('Failed to remove member:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove member' } },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[id]/members - Update member role
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, role: newRole } = body;

    if (!userId || !newRole) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'User ID and role are required' } },
        { status: 400 }
      );
    }

    if (!['ADMIN', 'MEMBER'].includes(newRole)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid role' } },
        { status: 400 }
      );
    }

    const currentRole = await getUserTeamRole(params.id, session.user.id);

    if (currentRole !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only owner can change member roles' } },
        { status: 403 }
      );
    }

    const targetMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: params.id,
          userId,
        },
      },
    });

    if (!targetMember) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    if (targetMember.role === 'OWNER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot change owner role' } },
        { status: 403 }
      );
    }

    const updatedMember = await prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId: params.id,
          userId,
        },
      },
      data: { role: newRole },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedMember.id,
        role: updatedMember.role,
        user: updatedMember.user,
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
