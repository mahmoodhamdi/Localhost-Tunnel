import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getHealthCheck, runHealthCheck } from '@/lib/health/healthCheck';

// POST /api/health/checks/[id]/run - Manually run health check
export async function POST(
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

    // Verify ownership
    const check = await getHealthCheck(session.user.id, id);

    if (!check) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Health check not found' } },
        { status: 404 }
      );
    }

    if (!check.enabled) {
      return NextResponse.json(
        { success: false, error: { code: 'CHECK_DISABLED', message: 'Health check is disabled' } },
        { status: 400 }
      );
    }

    const result = await runHealthCheck(id);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to run health check:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to run health check' } },
      { status: 500 }
    );
  }
}
