import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    // Get tunnel statistics
    const tunnels = await prisma.tunnel.findMany();

    const activeTunnels = tunnels.filter((t) => t.isActive).length;
    const totalTunnels = tunnels.length;
    const totalRequests = tunnels.reduce((sum, t) => sum + t.totalRequests, 0);
    const totalBytes = tunnels.reduce((sum, t) => sum + Number(t.totalBytes), 0);

    // Get recent requests for activity feed
    const recentRequests = await prisma.request.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        tunnel: {
          select: { subdomain: true },
        },
      },
    });

    // Calculate uptime (simplified - based on active tunnels)
    const uptime = totalTunnels > 0 ? Math.round((activeTunnels / totalTunnels) * 100) : 100;

    // Get requests per day for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const requestsOverTime = await prisma.request.groupBy({
      by: ['createdAt'],
      _count: { id: true },
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Format recent activity
    const recentActivity = recentRequests.map((req) => ({
      id: req.id,
      subdomain: req.tunnel.subdomain,
      method: req.method,
      path: req.path,
      statusCode: req.statusCode,
      createdAt: req.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          activeTunnels,
          totalTunnels,
          totalRequests,
          totalBytes,
          uptime,
        },
        recentActivity,
        requestsOverTime: requestsOverTime.map((r) => ({
          date: r.createdAt,
          count: r._count.id,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to get dashboard stats:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get dashboard stats' } },
      { status: 500 }
    );
  }
}
