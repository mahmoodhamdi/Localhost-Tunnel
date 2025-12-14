import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/auth';

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
      include: {
        _count: {
          select: { requests: true },
        },
      },
    });

    if (!tunnel) {
      return NextResponse.json(
        { success: false, error: { code: 'TUNNEL_NOT_FOUND', message: 'Tunnel not found' } },
        { status: 404 }
      );
    }

    const domain = process.env.TUNNEL_DOMAIN || 'localhost:3000';
    const publicUrl = `http://${tunnel.subdomain}.${domain}`;

    return NextResponse.json({
      success: true,
      data: {
        id: tunnel.id,
        subdomain: tunnel.subdomain,
        publicUrl,
        localPort: tunnel.localPort,
        localHost: tunnel.localHost,
        protocol: tunnel.protocol,
        isActive: tunnel.isActive,
        hasPassword: !!tunnel.password,
        ipWhitelist: tunnel.ipWhitelist,
        expiresAt: tunnel.expiresAt,
        inspect: tunnel.inspect,
        totalRequests: tunnel.totalRequests,
        totalBytes: Number(tunnel.totalBytes),
        createdAt: tunnel.createdAt,
        updatedAt: tunnel.updatedAt,
        lastActiveAt: tunnel.lastActiveAt,
        requestCount: tunnel._count.requests,
      },
    });
  } catch (error) {
    console.error('Failed to get tunnel:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get tunnel' } },
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
    const { id: tunnelId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Verify tunnel exists and user has admin/owner access
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
        { success: false, error: { code: 'TUNNEL_NOT_FOUND', message: 'Tunnel not found' } },
        { status: 404 }
      );
    }

    await prisma.tunnel.update({
      where: { id: tunnelId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      data: { id: tunnelId, message: 'Tunnel deleted' },
    });
  } catch (error) {
    console.error('Failed to delete tunnel:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete tunnel' } },
      { status: 500 }
    );
  }
}
