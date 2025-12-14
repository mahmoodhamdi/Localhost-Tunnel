import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getHealthCheck, getCheckHistory, getUptimeStats } from '@/lib/health/healthCheck';

// GET /api/health/checks/[id]/results - Get check history
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

    // Verify ownership
    const check = await getHealthCheck(session.user.id, id);

    if (!check) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Health check not found' } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const period = (searchParams.get('period') || 'day') as 'day' | 'week' | 'month';

    const [history, stats] = await Promise.all([
      getCheckHistory(id, { limit, offset }),
      getUptimeStats(id, period),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        results: history.results,
        stats,
      },
      pagination: {
        total: history.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Failed to get health check results:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get health check results' } },
      { status: 500 }
    );
  }
}
