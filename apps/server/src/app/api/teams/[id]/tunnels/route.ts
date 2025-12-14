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

// GET /api/teams/[id]/tunnels - List team tunnels
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

    const tunnels = await prisma.tunnel.findMany({
      where: { teamId: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        _count: {
          select: { requests: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: tunnels.map((tunnel) => ({
        id: tunnel.id,
        subdomain: tunnel.subdomain,
        localPort: tunnel.localPort,
        localHost: tunnel.localHost,
        protocol: tunnel.protocol,
        isActive: tunnel.isActive,
        inspect: tunnel.inspect,
        totalRequests: tunnel.totalRequests,
        createdBy: tunnel.user,
        requestCount: tunnel._count.requests,
        createdAt: tunnel.createdAt,
        lastActiveAt: tunnel.lastActiveAt,
      })),
    });
  } catch (error) {
    console.error('Failed to list team tunnels:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list team tunnels' } },
      { status: 500 }
    );
  }
}

// POST /api/teams/[id]/tunnels - Transfer tunnel to team
export async function POST(
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
    const { tunnelId } = body;

    if (!tunnelId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Tunnel ID is required' } },
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

    // Get the tunnel
    const tunnel = await prisma.tunnel.findUnique({
      where: { id: tunnelId },
    });

    if (!tunnel) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tunnel not found' } },
        { status: 404 }
      );
    }

    // User must own the tunnel or be owner/admin of the current team
    const canTransfer = tunnel.userId === session.user.id ||
      (tunnel.teamId && ['OWNER', 'ADMIN'].includes(role));

    if (!canTransfer) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to transfer this tunnel' } },
        { status: 403 }
      );
    }

    // Transfer tunnel to team
    const updatedTunnel = await prisma.tunnel.update({
      where: { id: tunnelId },
      data: { teamId: params.id },
      include: {
        team: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedTunnel.id,
        subdomain: updatedTunnel.subdomain,
        team: updatedTunnel.team,
        message: 'Tunnel transferred to team successfully',
      },
    });
  } catch (error) {
    console.error('Failed to transfer tunnel:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to transfer tunnel' } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id]/tunnels - Remove tunnel from team
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
    const tunnelId = searchParams.get('tunnelId');

    if (!tunnelId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Tunnel ID is required' } },
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

    // Only owner and admin can remove tunnels from team
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to remove tunnels from team' } },
        { status: 403 }
      );
    }

    const tunnel = await prisma.tunnel.findUnique({
      where: { id: tunnelId },
    });

    if (!tunnel || tunnel.teamId !== params.id) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tunnel not found in this team' } },
        { status: 404 }
      );
    }

    // Remove tunnel from team (set teamId to null)
    await prisma.tunnel.update({
      where: { id: tunnelId },
      data: { teamId: null },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Tunnel removed from team successfully' },
    });
  } catch (error) {
    console.error('Failed to remove tunnel from team:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove tunnel from team' } },
      { status: 500 }
    );
  }
}
