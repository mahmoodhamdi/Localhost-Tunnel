/**
 * Admin User Detail API
 * GET    /api/admin/users/[id] - Fetch full user details
 * PATCH  /api/admin/users/[id] - Update role, name, or active status
 * DELETE /api/admin/users/[id] - Hard-delete user and all related data
 *
 * Requires ADMIN role.
 */

import { prisma } from '@/lib/db/prisma';
import { withAdminAuth } from '@/lib/api/withAuth';
import { success, ApiException, getParam, parseBody } from '@/lib/api';
import type { AuthContext } from '@/lib/api/withAuth';

// ---------------------------------------------------------------------------
// GET – single user with full details
// ---------------------------------------------------------------------------
export const GET = withAdminAuth(async (request: Request, { params, logger }: AuthContext) => {
  const id = getParam(params, 'id');

  logger.info('Fetching admin user detail', { targetUserId: id });

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      // Account providers (OAuth)
      accounts: {
        select: { provider: true, type: true },
      },
      // Subscription info
      subscription: {
        select: {
          tier: true,
          status: true,
          provider: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
      // Aggregate counts
      _count: {
        select: {
          tunnels: true,
          apiKeys: true,
          auditLogs: true,
          payments: true,
        },
      },
    },
  });

  if (!user) {
    throw ApiException.notFound('User not found');
  }

  // Fetch active tunnel count separately so we can filter isActive
  const activeTunnelCount = await prisma.tunnel.count({
    where: { userId: id, isActive: true },
  });

  return success({
    ...user,
    activeTunnelCount,
  });
});

// ---------------------------------------------------------------------------
// PATCH – update role, name, or active status
// ---------------------------------------------------------------------------

interface PatchUserBody {
  role?: string;
  name?: string;
}

const VALID_ROLES = ['USER', 'ADMIN'] as const;

export const PATCH = withAdminAuth(async (request: Request, { params, user: adminUser, logger }: AuthContext) => {
  const id = getParam(params, 'id');

  const body = await parseBody<PatchUserBody>(request);
  const { role, name } = body;

  // Validate at least one field is being updated
  if (role === undefined && name === undefined) {
    throw ApiException.badRequest(
      'At least one field must be provided: role, name',
      'MISSING_UPDATE_FIELDS'
    );
  }

  // Validate role value when provided
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      throw ApiException.badRequest(
        `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
        'INVALID_ROLE'
      );
    }
    // Prevent admin from demoting their own account
    if (id === adminUser.id && role !== 'ADMIN') {
      throw ApiException.badRequest(
        'You cannot remove your own admin role',
        'CANNOT_DEMOTE_SELF'
      );
    }
  }

  // Validate name when provided
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw ApiException.badRequest('Name must be a non-empty string', 'INVALID_NAME');
    }
    if (name.trim().length > 255) {
      throw ApiException.badRequest('Name must not exceed 255 characters', 'NAME_TOO_LONG');
    }
  }

  // Verify target user exists
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!existingUser) {
    throw ApiException.notFound('User not found');
  }

  logger.info('Updating user via admin', {
    targetUserId: id,
    changes: { role, name: name !== undefined },
  });

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined ? { role } : {}),
      ...(name !== undefined ? { name: name.trim() } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return success(updated);
});

// ---------------------------------------------------------------------------
// DELETE – hard-delete user and all cascade-related data
// ---------------------------------------------------------------------------
export const DELETE = withAdminAuth(async (request: Request, { params, user: adminUser, logger }: AuthContext) => {
  const id = getParam(params, 'id');

  // Prevent admin from deleting their own account
  if (id === adminUser.id) {
    throw ApiException.badRequest(
      'You cannot delete your own admin account',
      'CANNOT_DELETE_SELF'
    );
  }

  // Verify the user exists before attempting delete
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });

  if (!existingUser) {
    throw ApiException.notFound('User not found');
  }

  logger.info('Deleting user via admin', {
    targetUserId: id,
    targetEmail: existingUser.email,
  });

  // Prisma cascade deletes defined in schema handle all related records:
  // tunnels, accounts, sessions, apiKeys, auditLogs, fcmTokens,
  // subscription, payments, paymentMethods, invoices, teamMemberships,
  // sentInvitations, rateLimitRules, geoRules, healthChecks, ownedTeams.
  await prisma.user.delete({ where: { id } });

  return success({
    id,
    message: 'User and all related data have been permanently deleted',
  });
});
