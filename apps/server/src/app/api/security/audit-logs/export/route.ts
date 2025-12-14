import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { exportAuditLogs } from '@/lib/security/auditLogger';

// GET /api/security/audit-logs/export - Export audit logs
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
    const format = (searchParams.get('format') || 'json') as 'json' | 'csv';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Format must be json or csv' } },
        { status: 400 }
      );
    }

    const content = await exportAuditLogs(session.user.id, format, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Failed to export audit logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export audit logs' } },
      { status: 500 }
    );
  }
}
