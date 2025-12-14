import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getTunnelHealth, runHealthCheck, createHealthCheck } from '@/lib/health/healthCheck';

// GET /api/tunnels/[id]/health - Get tunnel health status
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: tunnelId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Verify tunnel exists and belongs to user
    const tunnel = await prisma.tunnel.findFirst({
      where: {
        id: tunnelId,
        OR: [
          { userId: session.user.id },
          { team: { members: { some: { userId: session.user.id } } } },
        ],
      },
    });

    if (!tunnel) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tunnel not found' } },
        { status: 404 }
      );
    }

    const health = await getTunnelHealth(tunnelId);

    return NextResponse.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Failed to get tunnel health:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get tunnel health' } },
      { status: 500 }
    );
  }
}

// POST /api/tunnels/[id]/health - Create health check for tunnel
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: tunnelId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Verify tunnel exists and belongs to user
    const tunnel = await prisma.tunnel.findFirst({
      where: {
        id: tunnelId,
        OR: [
          { userId: session.user.id },
          { team: { members: { some: { userId: session.user.id, role: { in: ['OWNER', 'ADMIN'] } } } } },
        ],
      },
    });

    if (!tunnel) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tunnel not found' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, interval, timeout } = body;

    const domain = process.env.TUNNEL_DOMAIN || 'localhost:3000';
    const target = `http://${tunnel.subdomain}.${domain}`;

    const check = await createHealthCheck(session.user.id, {
      name: name || `${tunnel.subdomain} health check`,
      type: 'TUNNEL',
      target,
      tunnelId,
      interval: interval || 60,
      timeout: timeout || 30,
    });

    return NextResponse.json({
      success: true,
      data: check,
    });
  } catch (error) {
    console.error('Failed to create tunnel health check:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create tunnel health check' } },
      { status: 500 }
    );
  }
}
