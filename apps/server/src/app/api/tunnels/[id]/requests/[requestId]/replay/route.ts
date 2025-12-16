import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/auth';
import { tunnelManager } from '@/lib/tunnel/manager';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const session = await auth();
    const { id: tunnelId, requestId } = await params;

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
        { success: false, error: { code: 'TUNNEL_NOT_FOUND', message: 'Tunnel not found' } },
        { status: 404 }
      );
    }

    // Check if tunnel is active
    if (!tunnel.isActive) {
      return NextResponse.json(
        { success: false, error: { code: 'TUNNEL_INACTIVE', message: 'Tunnel is not active' } },
        { status: 400 }
      );
    }

    // Get the original request
    const originalRequest = await prisma.request.findFirst({
      where: {
        id: requestId,
        tunnelId,
      },
    });

    if (!originalRequest) {
      return NextResponse.json(
        { success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found' } },
        { status: 404 }
      );
    }

    // Check if tunnel connection exists
    const tunnelConnection = tunnelManager.getTunnelBySubdomain(tunnel.subdomain);
    if (!tunnelConnection) {
      return NextResponse.json(
        { success: false, error: { code: 'TUNNEL_DISCONNECTED', message: 'Tunnel is not connected' } },
        { status: 400 }
      );
    }

    // Parse headers from stored request
    let headers: Record<string, string> = {};
    try {
      headers = JSON.parse(originalRequest.headers);
    } catch {
      // Use empty headers if parsing fails
    }

    // Remove headers that should not be replayed
    const headersToRemove = [
      'host',
      'connection',
      'transfer-encoding',
      'content-length',
      'x-forwarded-for',
      'x-forwarded-proto',
      'x-forwarded-host',
      'x-real-ip',
    ];
    for (const header of headersToRemove) {
      delete headers[header.toLowerCase()];
      delete headers[header];
    }

    // Build the full path with query string if present
    let fullPath = originalRequest.path;
    if (originalRequest.query) {
      fullPath += `?${originalRequest.query}`;
    }

    // Forward the request through the tunnel
    const startTime = Date.now();
    const response = await tunnelManager.forwardRequest(tunnel.subdomain, {
      method: originalRequest.method,
      path: fullPath,
      headers,
      body: originalRequest.body || undefined,
    });
    const responseTime = Date.now() - startTime;

    // Store the replayed request
    const replayedRequest = await prisma.request.create({
      data: {
        tunnelId,
        method: originalRequest.method,
        path: originalRequest.path,
        headers: originalRequest.headers,
        body: originalRequest.body,
        query: originalRequest.query,
        statusCode: response.statusCode,
        responseHeaders: JSON.stringify(response.headers || {}),
        responseBody: response.body || null,
        responseTime,
        ip: originalRequest.ip,
        userAgent: `Replay from ${originalRequest.userAgent || 'unknown'}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: replayedRequest.id,
        originalRequestId: requestId,
        method: replayedRequest.method,
        path: replayedRequest.path,
        statusCode: response.statusCode,
        responseHeaders: response.headers,
        responseBody: response.body,
        responseTime,
        createdAt: replayedRequest.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to replay request:', error);

    // Handle specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Failed to replay request';

    if (errorMessage.includes('Tunnel not found') || errorMessage.includes('Tunnel closed')) {
      return NextResponse.json(
        { success: false, error: { code: 'TUNNEL_DISCONNECTED', message: 'Tunnel connection lost' } },
        { status: 400 }
      );
    }

    if (errorMessage.includes('Request timeout')) {
      return NextResponse.json(
        { success: false, error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out' } },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to replay request' } },
      { status: 500 }
    );
  }
}
