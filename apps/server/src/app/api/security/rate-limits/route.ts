import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/security/auditLogger';

// GET /api/security/rate-limits - List user's rate limit rules
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const rules = await prisma.rateLimitRule.findMany({
      where: { userId: session.user.id },
      include: {
        tunnel: {
          select: { id: true, subdomain: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('Failed to list rate limit rules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list rate limit rules' } },
      { status: 500 }
    );
  }
}

// POST /api/security/rate-limits - Create rate limit rule
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      tunnelId,
      requestsPerMinute = 60,
      requestsPerHour = 1000,
      burstLimit = 100,
      blockDuration = 60,
      customMessage,
      enabled = true,
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule name is required' } },
        { status: 400 }
      );
    }

    // Validate tunnel ownership if tunnelId is provided
    if (tunnelId) {
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

    const rule = await prisma.rateLimitRule.create({
      data: {
        name: name.trim(),
        userId: session.user.id,
        tunnelId: tunnelId || null,
        requestsPerMinute,
        requestsPerHour,
        burstLimit,
        blockDuration,
        customMessage: customMessage?.trim() || null,
        enabled,
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
        action: 'CREATE',
        resource: 'RATE_LIMIT_RULE',
        resourceId: rule.id,
        details: { name: rule.name, tunnelId: rule.tunnelId },
      },
      request
    );

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Failed to create rate limit rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create rate limit rule' } },
      { status: 500 }
    );
  }
}
