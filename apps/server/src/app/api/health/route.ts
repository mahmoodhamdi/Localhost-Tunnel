import { NextResponse } from 'next/server';
import { getSystemHealth } from '@/lib/health/healthCheck';

// GET /api/health - System health status
export async function GET() {
  try {
    const health = await getSystemHealth();

    const statusCode = health.status === 'HEALTHY' ? 200 : health.status === 'DEGRADED' ? 200 : 503;

    return NextResponse.json(
      {
        success: true,
        data: health,
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error('Failed to get system health:', error);
    return NextResponse.json(
      {
        success: false,
        data: {
          status: 'UNHEALTHY',
          error: 'Failed to check system health',
          timestamp: new Date(),
        },
      },
      { status: 503 }
    );
  }
}
