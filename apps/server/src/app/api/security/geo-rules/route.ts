import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/security/auditLogger';

// GET /api/security/geo-rules - List user's geo rules
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const rules = await prisma.geoRule.findMany({
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
    console.error('Failed to list geo rules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list geo rules' } },
      { status: 500 }
    );
  }
}

// POST /api/security/geo-rules - Create geo rule
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
    const { name, tunnelId, mode = 'ALLOW', countries, enabled = true } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule name is required' } },
        { status: 400 }
      );
    }

    if (!countries || countries.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one country is required' } },
        { status: 400 }
      );
    }

    if (!['ALLOW', 'BLOCK'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Mode must be ALLOW or BLOCK' } },
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

    const rule = await prisma.geoRule.create({
      data: {
        name: name.trim(),
        userId: session.user.id,
        tunnelId: tunnelId || null,
        mode,
        countries: countries.trim().toUpperCase(),
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
        resource: 'GEO_RULE',
        resourceId: rule.id,
        details: { name: rule.name, mode: rule.mode, countries: rule.countries },
      },
      request
    );

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Failed to create geo rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create geo rule' } },
      { status: 500 }
    );
  }
}
