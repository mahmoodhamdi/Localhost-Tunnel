import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createHealthCheck, getHealthChecks } from '@/lib/health/healthCheck';

// GET /api/health/checks - List all health checks
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tunnelId = searchParams.get('tunnelId') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getHealthChecks(session.user.id, {
      tunnelId,
      status: status as 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED' | 'UNKNOWN' | undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result.checks,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Failed to list health checks:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list health checks' } },
      { status: 500 }
    );
  }
}

// POST /api/health/checks - Create health check
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
    const { name, type, target, tunnelId, interval, timeout, retries, alertOnFailure, alertAfterRetries } = body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 }
      );
    }

    if (!type || !['TUNNEL', 'HTTP', 'TCP', 'DATABASE'].includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Type must be TUNNEL, HTTP, TCP, or DATABASE' } },
        { status: 400 }
      );
    }

    if (!target || target.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Target is required' } },
        { status: 400 }
      );
    }

    // Validate optional fields
    if (interval !== undefined && (interval < 10 || interval > 3600)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Interval must be between 10 and 3600 seconds' } },
        { status: 400 }
      );
    }

    if (timeout !== undefined && (timeout < 1 || timeout > 300)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Timeout must be between 1 and 300 seconds' } },
        { status: 400 }
      );
    }

    const check = await createHealthCheck(session.user.id, {
      name,
      type,
      target,
      tunnelId,
      interval,
      timeout,
      retries,
      alertOnFailure,
      alertAfterRetries,
    });

    return NextResponse.json({
      success: true,
      data: check,
    });
  } catch (error) {
    console.error('Failed to create health check:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create health check' } },
      { status: 500 }
    );
  }
}
