import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getHealthCheck, updateHealthCheck, deleteHealthCheck } from '@/lib/health/healthCheck';

// GET /api/health/checks/[id] - Get health check details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const check = await getHealthCheck(session.user.id, id);

    if (!check) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Health check not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: check,
    });
  } catch (error) {
    console.error('Failed to get health check:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get health check' } },
      { status: 500 }
    );
  }
}

// PUT /api/health/checks/[id] - Update health check
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, target, enabled, interval, timeout, retries, alertOnFailure, alertAfterRetries } = body;

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

    const result = await updateHealthCheck(session.user.id, id, {
      name,
      target,
      enabled,
      interval,
      timeout,
      retries,
      alertOnFailure,
      alertAfterRetries,
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Health check not found' } },
        { status: 404 }
      );
    }

    const updated = await getHealthCheck(session.user.id, id);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Failed to update health check:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update health check' } },
      { status: 500 }
    );
  }
}

// DELETE /api/health/checks/[id] - Delete health check
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const result = await deleteHealthCheck(session.user.id, id);

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Health check not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Health check deleted',
    });
  } catch (error) {
    console.error('Failed to delete health check:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete health check' } },
      { status: 500 }
    );
  }
}
