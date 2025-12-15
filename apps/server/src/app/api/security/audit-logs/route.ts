import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAuditLogs, AuditAction, AuditResource } from '@/lib/security/auditLogger';

// GET /api/security/audit-logs - List user's audit logs
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
    const action = searchParams.get('action') || undefined;
    const resource = searchParams.get('resource') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getAuditLogs(session.user.id, {
      action: action as AuditAction | undefined,
      resource: resource as AuditResource | undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Failed to list audit logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list audit logs' } },
      { status: 500 }
    );
  }
}
