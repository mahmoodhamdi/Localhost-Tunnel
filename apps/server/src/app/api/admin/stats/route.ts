/**
 * Admin System Statistics API
 * GET /api/admin/stats
 *
 * Returns aggregated system-wide metrics:
 *   - User counts (total / active last 30 days)
 *   - Tunnel counts (total / active)
 *   - Request counts (today / this week / this month)
 *   - Total bytes transferred
 *   - Last 5 audit log entries
 *   - Basic system health (DB connectivity)
 *
 * Requires ADMIN role.
 */

import { prisma } from '@/lib/db/prisma';
import { withAdminAuth } from '@/lib/api/withAuth';
import { success } from '@/lib/api';
import type { AuthContext } from '@/lib/api/withAuth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns midnight (00:00:00.000) of the current calendar day (UTC). */
function startOfDayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns midnight of N calendar days ago (UTC). */
function daysAgoUtc(days: number): Date {
  const d = startOfDayUtc();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export const GET = withAdminAuth(async (_request: Request, { logger }: AuthContext) => {
  logger.info('Fetching admin system statistics');

  const now = new Date();
  const startOfToday = startOfDayUtc();
  const startOfWeek = daysAgoUtc(7);
  const startOfMonth = daysAgoUtc(30);

  // Run all independent queries in parallel for efficiency
  const [
    totalUsers,
    activeUsers,
    totalTunnels,
    activeTunnels,
    requestsToday,
    requestsThisWeek,
    requestsThisMonth,
    tunnelAggregates,
    recentAuditLogs,
    dbPingResult,
  ] = await Promise.allSettled([
    // Total registered users
    prisma.user.count(),

    // Users who created at least one tunnel in the last 30 days
    // (proxy for "active users" without a dedicated lastActiveAt on User)
    prisma.user.count({
      where: {
        tunnels: {
          some: {
            lastActiveAt: { gte: startOfMonth },
          },
        },
      },
    }),

    // Total tunnels ever created
    prisma.tunnel.count(),

    // Currently active tunnels
    prisma.tunnel.count({ where: { isActive: true } }),

    // HTTP requests logged today
    prisma.request.count({
      where: { createdAt: { gte: startOfToday } },
    }),

    // HTTP requests logged this week (last 7 days)
    prisma.request.count({
      where: { createdAt: { gte: startOfWeek } },
    }),

    // HTTP requests logged this month (last 30 days)
    prisma.request.count({
      where: { createdAt: { gte: startOfMonth } },
    }),

    // Sum of totalBytes and totalRequests across all tunnels
    prisma.tunnel.aggregate({
      _sum: { totalBytes: true, totalRequests: true },
    }),

    // Last 5 audit log entries with user details
    prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        status: true,
        ipAddress: true,
        details: true,
        createdAt: true,
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    }),

    // DB connectivity check — a lightweight query
    prisma.$queryRaw<[{ ok: number }]>`SELECT 1 AS ok`,
  ]);

  // ---------------------------------------------------------------------------
  // Safely unwrap PromiseSettledResult values
  // ---------------------------------------------------------------------------
  function unwrap<T>(result: PromiseSettledResult<T>, fallback: T): T {
    return result.status === 'fulfilled' ? result.value : fallback;
  }

  const dbOnline = dbPingResult.status === 'fulfilled';

  const aggregates = unwrap(tunnelAggregates, { _sum: { totalBytes: null, totalRequests: null } });
  const totalBytes = Number(aggregates._sum.totalBytes ?? 0);
  const totalRequestsAllTime = aggregates._sum.totalRequests ?? 0;

  // Build system health object
  const systemHealth = {
    status: dbOnline ? 'healthy' : 'degraded',
    database: {
      connected: dbOnline,
      checkedAt: now.toISOString(),
    },
  };

  logger.info('Admin stats fetched', { dbOnline });

  return success({
    users: {
      total: unwrap(totalUsers, 0),
      activeLastThirtyDays: unwrap(activeUsers, 0),
    },
    tunnels: {
      total: unwrap(totalTunnels, 0),
      active: unwrap(activeTunnels, 0),
    },
    requests: {
      total: totalRequestsAllTime,
      today: unwrap(requestsToday, 0),
      thisWeek: unwrap(requestsThisWeek, 0),
      thisMonth: unwrap(requestsThisMonth, 0),
    },
    totalBytes,
    recentAuditLogs: unwrap(recentAuditLogs, []),
    systemHealth,
  });
});
