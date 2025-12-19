import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/auth';

// Type definitions for Prisma query results
type TunnelInfo = { id: string; subdomain: string; totalBytes: bigint };
type MethodStat = { method: string; _count: { id: number } };
type PathStat = { path: string; _count: { id: number } };
type StatusCodeStat = { statusCode: number | null; _count: { id: number } };
type TimeRequest = { createdAt: Date };

// Pagination limits
const PAGINATION = {
  maxRequestsForBucketing: 10000, // Limit for time-based queries
  maxStatusCodes: 1000, // Limit for status code grouping
};

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
    const tunnelId = searchParams.get('tunnelId');
    const range = searchParams.get('range') || '7d';

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Base where clause - filter by user's tunnels
    const tunnelFilter = {
      OR: [
        { userId: session.user.id },
        { team: { members: { some: { userId: session.user.id } } } },
      ],
    };

    // Get user's tunnel IDs for request filtering
    const userTunnels: TunnelInfo[] = await prisma.tunnel.findMany({
      where: tunnelFilter,
      select: { id: true, subdomain: true, totalBytes: true },
    });

    const userTunnelIds = userTunnels.map((t: TunnelInfo) => t.id);

    // Build request where clause
    const requestWhereClause: Record<string, unknown> = {
      createdAt: { gte: startDate },
      tunnelId: { in: userTunnelIds },
    };

    if (tunnelId && tunnelId !== 'all') {
      requestWhereClause.tunnelId = tunnelId;
    }

    // Use database aggregations for efficient querying
    const [
      totalRequestsCount,
      uniqueIpsResult,
      avgResponseTimeResult,
      successCount,
      methodStats,
      topPathsResult,
    ] = await Promise.all([
      // Total requests count
      prisma.request.count({ where: requestWhereClause }),

      // Unique IPs count using groupBy
      prisma.request.groupBy({
        by: ['ip'],
        where: requestWhereClause,
      }),

      // Average response time
      prisma.request.aggregate({
        where: requestWhereClause,
        _avg: { responseTime: true },
      }),

      // Successful requests count (2xx and 3xx)
      prisma.request.count({
        where: {
          ...requestWhereClause,
          statusCode: { gte: 200, lt: 400 },
        },
      }),

      // Group by method
      prisma.request.groupBy({
        by: ['method'],
        where: requestWhereClause,
        _count: { id: true },
      }),

      // Top paths
      prisma.request.groupBy({
        by: ['path'],
        where: requestWhereClause,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    const totalRequests = totalRequestsCount;
    const uniqueIps = uniqueIpsResult.length;
    const avgResponseTime = Math.round(avgResponseTimeResult._avg.responseTime || 0);
    const successRate = totalRequests > 0 ? Math.round((successCount / totalRequests) * 100) : 0;
    const errorRate = totalRequests > 0 ? Math.round(((totalRequests - successCount) / totalRequests) * 100) : 0;

    // Calculate bandwidth from user's tunnels
    const bandwidth = tunnelId && tunnelId !== 'all'
      ? Number(userTunnels.find((t: TunnelInfo) => t.id === tunnelId)?.totalBytes || 0)
      : userTunnels.reduce((sum: number, t: TunnelInfo) => sum + Number(t.totalBytes), 0);

    // Format method counts
    const requestsByMethod = (methodStats as MethodStat[]).map((m: MethodStat) => ({
      method: m.method,
      count: m._count.id,
    }));

    // Status counts - use groupBy for efficiency instead of fetching all records
    const statusGrouped = await prisma.request.groupBy({
      by: ['statusCode'],
      where: requestWhereClause,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: PAGINATION.maxStatusCodes, // Limit unique status codes
    }) as unknown as StatusCodeStat[];

    // Aggregate into status groups (2xx, 3xx, 4xx, 5xx)
    const statusCounts: Record<string, number> = {};
    statusGrouped.forEach((r: StatusCodeStat) => {
      if (r.statusCode) {
        const statusGroup = `${Math.floor(r.statusCode / 100)}xx`;
        statusCounts[statusGroup] = (statusCounts[statusGroup] || 0) + r._count.id;
      }
    });

    // Requests over time - limit to recent records for bucketing
    // Note: We use a sampling approach for large datasets
    const requestsOverTimeRaw: TimeRequest[] = await prisma.request.findMany({
      where: requestWhereClause,
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: PAGINATION.maxRequestsForBucketing, // Limit to prevent memory issues
    });

    const bucketSize = range === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const buckets = new Map<number, number>();

    requestsOverTimeRaw.forEach((r: TimeRequest) => {
      const bucket = Math.floor(r.createdAt.getTime() / bucketSize) * bucketSize;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });

    // Fill in missing buckets
    const requestsOverTime: Array<{ timestamp: string; count: number }> = [];
    let currentBucket = Math.floor(startDate.getTime() / bucketSize) * bucketSize;
    const endBucket = Math.floor(now.getTime() / bucketSize) * bucketSize;

    while (currentBucket <= endBucket) {
      requestsOverTime.push({
        timestamp: new Date(currentBucket).toISOString(),
        count: buckets.get(currentBucket) || 0,
      });
      currentBucket += bucketSize;
    }

    // Format top paths
    const topPaths = (topPathsResult as PathStat[]).map((p: PathStat) => ({
      path: p.path,
      count: p._count.id,
    }));

    // Available tunnels for filter
    const availableTunnels = userTunnels.map((t: TunnelInfo) => ({
      id: t.id,
      subdomain: t.subdomain,
    }));

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          totalRequests,
          uniqueIps,
          bandwidth,
          avgResponseTime,
          successRate,
          errorRate,
        },
        charts: {
          requestsOverTime,
          requestsByMethod,
          requestsByStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
          topPaths,
        },
        tunnels: availableTunnels,
      },
    });
  } catch (error) {
    console.error('Failed to get analytics:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get analytics' } },
      { status: 500 }
    );
  }
}
