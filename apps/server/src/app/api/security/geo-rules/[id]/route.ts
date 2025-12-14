import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/security/auditLogger';

// GET /api/security/geo-rules/[id] - Get geo rule
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

    const rule = await prisma.geoRule.findUnique({
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
    console.error('Failed to get geo rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get geo rule' } },
      { status: 500 }
    );
  }
}

// PUT /api/security/geo-rules/[id] - Update geo rule
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

    const existingRule = await prisma.geoRule.findUnique({
      where: { id: params.id },
    });

    if (!existingRule || existingRule.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, tunnelId, mode, countries, enabled } = body;

    // Validate mode if provided
    if (mode !== undefined && !['ALLOW', 'BLOCK'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Mode must be ALLOW or BLOCK' } },
        { status: 400 }
      );
    }

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

    const rule = await prisma.geoRule.update({
      where: { id: params.id },
      data: {
        name: name?.trim() || undefined,
        tunnelId: tunnelId !== undefined ? tunnelId : undefined,
        mode: mode ?? undefined,
        countries: countries !== undefined ? countries.trim().toUpperCase() : undefined,
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
        resource: 'GEO_RULE',
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
    console.error('Failed to update geo rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update geo rule' } },
      { status: 500 }
    );
  }
}

// DELETE /api/security/geo-rules/[id] - Delete geo rule
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

    const existingRule = await prisma.geoRule.findUnique({
      where: { id: params.id },
    });

    if (!existingRule || existingRule.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    await prisma.geoRule.delete({
      where: { id: params.id },
    });

    await logAuditEvent(
      session.user.id,
      {
        action: 'DELETE',
        resource: 'GEO_RULE',
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
    console.error('Failed to delete geo rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete geo rule' } },
      { status: 500 }
    );
  }
}
