/**
 * Admin Tunnels List API
 * GET /api/admin/tunnels
 *
 * Returns a paginated list of all tunnels across all users, with owner info.
 * Supports filtering by status, subdomain search, and userId.
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

  // Parse and validate pagination params
  const page = Math.max(1, parseInt(searchParams.get('page') ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
  const skip = (page - 1) * limit;

  // Optional filters
  const status = searchParams.get('status')?.toLowerCase() || undefined;
  const search = searchParams.get('search')?.trim() || undefined;
  const userId = searchParams.get('userId')?.trim() || undefined;

  // Validate status filter
  const validStatuses = ['active', 'inactive'];
  if (status && !validStatuses.includes(status)) {
    throw ApiException.badRequest(
      `Invalid status filter. Must be one of: ${validStatuses.join(', ')}`,
      'INVALID_STATUS_FILTER'
    );
  }

  // Build where clause
  const where = {
    ...(status === 'active' ? { isActive: true } : {}),
    ...(status === 'inactive' ? { isActive: false } : {}),
    ...(userId ? { userId } : {}),
    ...(search ? { subdomain: { contains: search } } : {}),
  };

  logger.info('Fetching admin tunnel list', { page, limit, status, search, userId });

  const [tunnels, total] = await Promise.all([
    prisma.tunnel.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subdomain: true,
        localPort: true,
        localHost: true,
        isActive: true,
        protocol: true,
        totalRequests: true,
        totalBytes: true,
        expiresAt: true,
        inspect: true,
        createdAt: true,
        updatedAt: true,
        lastActiveAt: true,
        // Owning user details (null for team-only tunnels)
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        // Owning team details (null for user-only tunnels)
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
    prisma.tunnel.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Serialize BigInt totalBytes to number for JSON serialization
  const serializedTunnels = tunnels.map((tunnel) => ({
    ...tunnel,
    totalBytes: Number(tunnel.totalBytes),
  }));

  return success({
    tunnels: serializedTunnels,
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
