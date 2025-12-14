import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: Request) {
  try {
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

    // Base where clause
    const whereClause: Record<string, unknown> = {
      createdAt: { gte: startDate },
    };

    if (tunnelId && tunnelId !== 'all') {
      whereClause.tunnelId = tunnelId;
    }

    // Get all requests in range
    const requests = await prisma.request.findMany({
      where: whereClause,
      select: {
        id: true,
        method: true,
        path: true,
        statusCode: true,
        responseTime: true,
        ip: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate metrics
    const totalRequests = requests.length;
    const uniqueIps = new Set(requests.map((r) => r.ip).filter(Boolean)).size;

    const responseTimes = requests.map((r) => r.responseTime).filter((t): t is number => t !== null);
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    const successfulRequests = requests.filter((r) => r.statusCode && r.statusCode >= 200 && r.statusCode < 400).length;
    const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 0;
    const errorRate = totalRequests > 0 ? Math.round(((totalRequests - successfulRequests) / totalRequests) * 100) : 0;

    // Get bandwidth from tunnels
    const tunnelWhereClause = tunnelId && tunnelId !== 'all' ? { id: tunnelId } : {};
    const tunnels = await prisma.tunnel.findMany({
      where: tunnelWhereClause,
      select: { totalBytes: true },
    });
    const bandwidth = tunnels.reduce((sum, t) => sum + Number(t.totalBytes), 0);

    // Requests by method
    const methodCounts: Record<string, number> = {};
    requests.forEach((r) => {
      methodCounts[r.method] = (methodCounts[r.method] || 0) + 1;
    });

    // Requests by status code
    const statusCounts: Record<string, number> = {};
    requests.forEach((r) => {
      if (r.statusCode) {
        const statusGroup = `${Math.floor(r.statusCode / 100)}xx`;
        statusCounts[statusGroup] = (statusCounts[statusGroup] || 0) + 1;
      }
    });

    // Requests over time (group by hour for 24h, by day for 7d/30d)
    const requestsOverTime: Array<{ timestamp: string; count: number }> = [];
    const bucketSize = range === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const buckets = new Map<number, number>();

    requests.forEach((r) => {
      const bucket = Math.floor(r.createdAt.getTime() / bucketSize) * bucketSize;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });

    // Fill in missing buckets
    let currentBucket = Math.floor(startDate.getTime() / bucketSize) * bucketSize;
    const endBucket = Math.floor(now.getTime() / bucketSize) * bucketSize;

    while (currentBucket <= endBucket) {
      requestsOverTime.push({
        timestamp: new Date(currentBucket).toISOString(),
        count: buckets.get(currentBucket) || 0,
      });
      currentBucket += bucketSize;
    }

    // Top paths
    const pathCounts: Record<string, number> = {};
    requests.forEach((r) => {
      pathCounts[r.path] = (pathCounts[r.path] || 0) + 1;
    });
    const topPaths = Object.entries(pathCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    // Get available tunnels for filter
    const availableTunnels = await prisma.tunnel.findMany({
      select: { id: true, subdomain: true },
      orderBy: { createdAt: 'desc' },
    });

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
          requestsByMethod: Object.entries(methodCounts).map(([method, count]) => ({ method, count })),
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
