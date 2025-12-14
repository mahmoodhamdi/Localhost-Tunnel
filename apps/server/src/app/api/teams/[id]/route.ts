import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';

// Helper to check team access
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

// GET /api/teams/[id] - Get team details
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

    const { team, role } = await checkTeamAccess(params.id, session.user.id);

    if (!team || !role) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found or access denied' } },
        { status: 404 }
      );
    }

    const teamDetails = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: { tunnels: true, invitations: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: teamDetails!.id,
        name: teamDetails!.name,
        slug: teamDetails!.slug,
        description: teamDetails!.description,
        image: teamDetails!.image,
        owner: teamDetails!.owner,
        members: teamDetails!.members.map((m) => ({
          id: m.id,
          role: m.role,
          user: m.user,
          joinedAt: m.createdAt,
        })),
        tunnelCount: teamDetails!._count.tunnels,
        pendingInvitations: teamDetails!._count.invitations,
        userRole: role,
        createdAt: teamDetails!.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to get team:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get team' } },
      { status: 500 }
    );
  }
}

// PUT /api/teams/[id] - Update team
export async function PUT(
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

    const { team, role } = await checkTeamAccess(params.id, session.user.id);

    if (!team || !role) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found or access denied' } },
        { status: 404 }
      );
    }

    // Only owner and admin can update
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to update team' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, image } = body;

    const updatedTeam = await prisma.team.update({
      where: { id: params.id },
      data: {
        name: name?.trim() || undefined,
        description: description?.trim(),
        image: image || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        slug: updatedTeam.slug,
        description: updatedTeam.description,
        image: updatedTeam.image,
        updatedAt: updatedTeam.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to update team:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update team' } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id] - Delete team
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

    const team = await prisma.team.findUnique({
      where: { id: params.id },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } },
        { status: 404 }
      );
    }

    // Only owner can delete
    if (team.ownerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only team owner can delete the team' } },
        { status: 403 }
      );
    }

    // Delete team (cascades to members and invitations)
    await prisma.team.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Team deleted successfully' },
    });
  } catch (error) {
    console.error('Failed to delete team:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete team' } },
      { status: 500 }
    );
  }
}
