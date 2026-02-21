/**
 * Admin Audit Logs API
 * GET /api/admin/audit
 *
 * Returns a paginated list of all audit log entries across all users,
 * with user info attached to each entry.
 *
 * Query parameters:
 *   page     - Page number (default 1)
 *   limit    - Items per page (default 20, max 100)
 *   action   - Filter by audit action (e.g. LOGIN, CREATE_TUNNEL)
 *   userId   - Filter by user ID
 *   from     - ISO date string — entries on or after this date
 *   to       - ISO date string — entries before or on this date
 *
 * Requires ADMIN role.
 */

import { prisma } from '@/lib/db/prisma';
import { withAdminAuth } from '@/lib/api/withAuth';
import { success, ApiException } from '@/lib/api';
import type { AuthContext } from '@/lib/api/withAuth';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const DEFAULT_PAGE = 1;

export const GET = withAdminAuth(async (request: Request, { logger }: AuthContext) => {
  const { searchParams } = new URL(request.url);

  // ---------------------------------------------------------------------------
  // Parse pagination
  // ---------------------------------------------------------------------------
  const page = Math.max(1, parseInt(searchParams.get('page') ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
  const skip = (page - 1) * limit;

  // ---------------------------------------------------------------------------
  // Parse filters
  // ---------------------------------------------------------------------------
  const action = searchParams.get('action')?.trim().toUpperCase() || undefined;
  const userId = searchParams.get('userId')?.trim() || undefined;
  const fromParam = searchParams.get('from')?.trim() || undefined;
  const toParam = searchParams.get('to')?.trim() || undefined;

  // Validate date filters
  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (fromParam) {
    fromDate = new Date(fromParam);
    if (isNaN(fromDate.getTime())) {
      throw ApiException.badRequest(
        'Invalid "from" date. Must be a valid ISO 8601 date string.',
        'INVALID_FROM_DATE'
      );
    }
  }

  if (toParam) {
    toDate = new Date(toParam);
    if (isNaN(toDate.getTime())) {
      throw ApiException.badRequest(
        'Invalid "to" date. Must be a valid ISO 8601 date string.',
        'INVALID_TO_DATE'
      );
    }
    // Set to end of the provided day (23:59:59.999) when only a date is given
    if (toDate.getUTCHours() === 0 && toDate.getUTCMinutes() === 0 && toDate.getUTCSeconds() === 0) {
      toDate.setUTCHours(23, 59, 59, 999);
    }
  }

  if (fromDate && toDate && fromDate > toDate) {
    throw ApiException.badRequest(
      '"from" date must not be later than "to" date.',
      'INVALID_DATE_RANGE'
    );
  }

  // If userId filter is set, verify the user exists to provide a clear error
  if (userId) {
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      throw ApiException.notFound(`No user found with id: ${userId}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Build where clause
  // ---------------------------------------------------------------------------
  const where = {
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  logger.info('Fetching admin audit logs', { page, limit, action, userId, fromParam, toParam });

  // ---------------------------------------------------------------------------
  // Execute queries
  // ---------------------------------------------------------------------------
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        status: true,
        ipAddress: true,
        userAgent: true,
        country: true,
        city: true,
        details: true,
        createdAt: true,
        // Include user name and email alongside userId
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return success({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});
