import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withAuth, type AuthContext } from '@/lib/api/withAuth';
import { success } from '@/lib/api';

// Type definitions for Prisma results
type RecentRequest = {
  id: string;
  method: string;
  path: string;
  statusCode: number | null;
  createdAt: Date;
  tunnel: { subdomain: string };
};

type RequestOverTime = {
  createdAt: Date;
  _count: { id: number };
};

export const GET = withAuth(async (request: Request, { user, logger }: AuthContext) => {
  try {
    // Filter by user's tunnels (owned or team member)
    const tunnelFilter = {
      OR: [
        { userId: user.id },
        { team: { members: { some: { userId: user.id } } } },
      ],
    };

    // Get tunnel statistics using database aggregations
    const [tunnelStats, activeTunnelCount] = await Promise.all([
      // Get aggregated stats for user's tunnels
      prisma.tunnel.aggregate({
        where: tunnelFilter,
        _count: { id: true },
        _sum: { totalRequests: true, totalBytes: true },
      }),
      // Count active tunnels for user
      prisma.tunnel.count({ where: { ...tunnelFilter, isActive: true } }),
    ]);

    const totalTunnels = tunnelStats._count.id;
    const activeTunnels = activeTunnelCount;
    const totalRequests = tunnelStats._sum.totalRequests || 0;
    const totalBytes = Number(tunnelStats._sum.totalBytes || 0);

    // Get user's tunnel IDs for request filtering
    const userTunnelIds = await prisma.tunnel.findMany({
      where: tunnelFilter,
      select: { id: true },
    });
    const tunnelIds = userTunnelIds.map((t: { id: string }) => t.id);

    // Get recent requests for activity feed (only from user's tunnels)
    const recentRequests: RecentRequest[] = await prisma.request.findMany({
      where: { tunnelId: { in: tunnelIds } },
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
        tunnelId: { in: tunnelIds },
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Format recent activity
    const recentActivity = recentRequests.map((req: RecentRequest) => ({
      id: req.id,
      subdomain: req.tunnel.subdomain,
      method: req.method,
      path: req.path,
      statusCode: req.statusCode,
      createdAt: req.createdAt,
    }));

    logger.info('Dashboard stats fetched', { userId: user.id });

    return success({
      stats: {
        activeTunnels,
        totalTunnels,
        totalRequests,
        totalBytes,
        uptime,
      },
      recentActivity,
      requestsOverTime: (requestsOverTime as RequestOverTime[]).map((r: RequestOverTime) => ({
        date: r.createdAt,
        count: r._count.id,
      })),
    });
  } catch (error) {
    logger.error('Failed to get dashboard stats', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get dashboard stats' } },
      { status: 500 }
    );
  }
});
