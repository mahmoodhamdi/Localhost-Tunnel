import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/security/auditLogger';

// GET /api/security/rate-limits/[id] - Get rate limit rule
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

    const rule = await prisma.rateLimitRule.findUnique({
      where: { id: params.id },
      include: {
        tunnel: {
          select: { id: true, subdomain: true },
        },
      },
    });

    if (!rule || rule.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Failed to get rate limit rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get rate limit rule' } },
      { status: 500 }
    );
  }
}

// PUT /api/security/rate-limits/[id] - Update rate limit rule
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

    const existingRule = await prisma.rateLimitRule.findUnique({
      where: { id: params.id },
    });

    if (!existingRule || existingRule.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      tunnelId,
      requestsPerMinute,
      requestsPerHour,
      burstLimit,
      blockDuration,
      customMessage,
      enabled,
    } = body;

    // Validate tunnel ownership if tunnelId is provided
    if (tunnelId !== undefined && tunnelId !== null) {
      const tunnel = await prisma.tunnel.findUnique({
        where: { id: tunnelId },
      });

      if (!tunnel || tunnel.userId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Tunnel not found or access denied' } },
          { status: 403 }
        );
      }
    }

    const rule = await prisma.rateLimitRule.update({
      where: { id: params.id },
      data: {
        name: name?.trim() || undefined,
        tunnelId: tunnelId !== undefined ? tunnelId : undefined,
        requestsPerMinute: requestsPerMinute ?? undefined,
        requestsPerHour: requestsPerHour ?? undefined,
        burstLimit: burstLimit ?? undefined,
        blockDuration: blockDuration ?? undefined,
        customMessage: customMessage !== undefined ? (customMessage?.trim() || null) : undefined,
        enabled: enabled ?? undefined,
      },
      include: {
        tunnel: {
          select: { id: true, subdomain: true },
        },
      },
    });

    await logAuditEvent(
      session.user.id,
      {
        action: 'UPDATE',
        resource: 'RATE_LIMIT_RULE',
        resourceId: rule.id,
        details: { name: rule.name },
      },
      request
    );

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Failed to update rate limit rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update rate limit rule' } },
      { status: 500 }
    );
  }
}

// DELETE /api/security/rate-limits/[id] - Delete rate limit rule
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

    const existingRule = await prisma.rateLimitRule.findUnique({
      where: { id: params.id },
    });

    if (!existingRule || existingRule.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    await prisma.rateLimitRule.delete({
      where: { id: params.id },
    });

    await logAuditEvent(
      session.user.id,
      {
        action: 'DELETE',
        resource: 'RATE_LIMIT_RULE',
        resourceId: params.id,
        details: { name: existingRule.name },
      },
      request
    );

    return NextResponse.json({
      success: true,
      data: { message: 'Rule deleted successfully' },
    });
  } catch (error) {
    console.error('Failed to delete rate limit rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete rate limit rule' } },
      { status: 500 }
    );
  }
}
