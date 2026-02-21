/**
 * Admin Users List API
 * GET /api/admin/users
 *
 * Returns a paginated list of all users with tunnel counts.
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
  const search = searchParams.get('search')?.trim() || undefined;
  const role = searchParams.get('role')?.toUpperCase() || undefined;

  // Validate role filter if provided
  const validRoles = ['USER', 'ADMIN'];
  if (role && !validRoles.includes(role)) {
    throw ApiException.badRequest(
      `Invalid role filter. Must be one of: ${validRoles.join(', ')}`,
      'INVALID_ROLE_FILTER'
    );
  }

  // Build where clause
  const where = {
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search } },
            { name: { contains: search } },
          ],
        }
      : {}),
  };

  logger.info('Fetching admin user list', { page, limit, search, role });

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { tunnels: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return success({
    users,
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
