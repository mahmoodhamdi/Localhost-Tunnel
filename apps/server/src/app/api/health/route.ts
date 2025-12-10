import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

const startTime = Date.now();

export async function GET() {
  try {
    // Check database connection
    const tunnelCount = await prisma.tunnel.count({
      where: { isActive: true },
    });

    const uptime = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      version: '1.0.0',
      uptime,
      tunnels: {
        active: tunnelCount,
        total: await prisma.tunnel.count(),
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        version: '1.0.0',
        error: 'Database connection failed',
      },
      { status: 503 }
    );
  }
}
