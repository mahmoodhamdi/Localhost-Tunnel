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

    const { searchParams } = new URL(request.url);
    const method = searchParams.get('method');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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
        { success: false, error: { code: 'TUNNEL_NOT_FOUND', message: 'Tunnel not found' } },
        { status: 404 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = { tunnelId };
    if (method) where.method = method;
    if (status) {
      const statusNum = parseInt(status, 10);
      if (status.endsWith('xx')) {
        // Handle status groups like 2xx, 4xx
        const group = parseInt(status[0], 10);
        where.statusCode = { gte: group * 100, lt: (group + 1) * 100 };
      } else if (!isNaN(statusNum)) {
        where.statusCode = statusNum;
      }
    }

    // Get requests
    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.request.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        requests: requests.map((r) => ({
          id: r.id,
          tunnelId: r.tunnelId,
          method: r.method,
          path: r.path,
          headers: JSON.parse(r.headers),
          body: r.body,
          query: r.query,
          statusCode: r.statusCode,
          responseHeaders: r.responseHeaders ? JSON.parse(r.responseHeaders) : null,
          responseBody: r.responseBody,
          responseTime: r.responseTime,
          ip: r.ip,
          userAgent: r.userAgent,
          createdAt: r.createdAt,
        })),
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Failed to get requests:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get requests' } },
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

    // Delete all requests for this tunnel
    const result = await prisma.request.deleteMany({
      where: { tunnelId },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: result.count },
    });
  } catch (error) {
    console.error('Failed to clear requests:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to clear requests' } },
      { status: 500 }
    );
  }
}
