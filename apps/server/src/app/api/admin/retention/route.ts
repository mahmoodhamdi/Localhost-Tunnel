import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { runAllCleanup, getRetentionStats } from '@/lib/retention';

// GET /api/admin/retention - Get retention statistics
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Check admin role
    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const stats = await getRetentionStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Failed to get retention stats:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get retention stats' } },
      { status: 500 }
    );
  }
}

// POST /api/admin/retention - Run data retention cleanup
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Check admin role
    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    // Get optional custom retention config from request body
    let customConfig;
    try {
      const body = await request.json();
      customConfig = body.config;
    } catch {
      // No body or invalid JSON - use defaults
    }

    const results = await runAllCleanup(customConfig);

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const errors = results.filter((r) => r.error);

    return NextResponse.json({
      success: true,
      data: {
        totalDeleted,
        errorCount: errors.length,
        results,
      },
    });
  } catch (error) {
    console.error('Failed to run retention cleanup:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to run retention cleanup' } },
      { status: 500 }
    );
  }
}
