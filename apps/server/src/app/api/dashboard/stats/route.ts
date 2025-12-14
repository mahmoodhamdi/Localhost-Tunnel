import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    // Get tunnel statistics using database aggregations
    const [tunnelStats, activeTunnelCount] = await Promise.all([
      // Get aggregated stats in a single query
      prisma.tunnel.aggregate({
        _count: { id: true },
        _sum: { totalRequests: true, totalBytes: true },
      }),
      // Count active tunnels
      prisma.tunnel.count({ where: { isActive: true } }),
    ]);

    const totalTunnels = tunnelStats._count.id;
    const activeTunnels = activeTunnelCount;
    const totalRequests = tunnelStats._sum.totalRequests || 0;
    const totalBytes = Number(tunnelStats._sum.totalBytes || 0);

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
