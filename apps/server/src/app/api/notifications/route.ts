/**
 * Notifications API Routes
 * Manages FCM tokens and notification preferences
 */

import { withAuth } from '@/lib/api/withAuth';
import { success, ApiException } from '@/lib/api/withApiHandler';
import { prisma } from '@/lib/db/prisma';
import { validateToken } from '@/lib/firebase';

// POST /api/notifications - Register FCM token
export const POST = withAuth(async (request, { user, logger }) => {
  const body = await request.json();
  const { token, platform = 'WEB', deviceId } = body;

  if (!token || typeof token !== 'string') {
    throw ApiException.badRequest('FCM token is required');
  }

  // Validate the token with Firebase (optional, depending on setup)
  const isValid = await validateToken(token);
  if (!isValid) {
    logger.warn('Invalid FCM token received', { userId: user.id });
    // Still allow registration as Firebase might not be configured
  }

  // Upsert the token
  const fcmToken = await prisma.fcmToken.upsert({
    where: { token },
    create: {
      token,
      platform,
      deviceId,
      userId: user.id,
    },
    update: {
      platform,
      deviceId,
      userId: user.id,
      isActive: true,
      lastUsed: new Date(),
    },
  });

  logger.info('FCM token registered', { tokenId: fcmToken.id });

  return success({
    id: fcmToken.id,
    platform: fcmToken.platform,
    preferences: {
      tunnelNotifications: fcmToken.tunnelNotifications,
      requestNotifications: fcmToken.requestNotifications,
      errorNotifications: fcmToken.errorNotifications,
    },
  }, 'Token registered successfully');
});

// GET /api/notifications - Get user's notification settings
export const GET = withAuth(async (_request, { user }) => {
  const tokens = await prisma.fcmToken.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    select: {
      id: true,
      platform: true,
      deviceId: true,
      tunnelNotifications: true,
      requestNotifications: true,
      errorNotifications: true,
      lastUsed: true,
      createdAt: true,
    },
    orderBy: {
      lastUsed: 'desc',
    },
  });

  return success({
    tokens,
    totalDevices: tokens.length,
  });
});

// DELETE /api/notifications - Unregister FCM token
export const DELETE = withAuth(async (request, { user, logger }) => {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const tokenId = searchParams.get('id');

  if (!token && !tokenId) {
    throw ApiException.badRequest('Token or token ID is required');
  }

  // Delete by token string or ID
  const deleted = await prisma.fcmToken.deleteMany({
    where: {
      userId: user.id,
      OR: [
        ...(token ? [{ token }] : []),
        ...(tokenId ? [{ id: tokenId }] : []),
      ],
    },
  });

  if (deleted.count === 0) {
    throw ApiException.notFound('Token not found');
  }

  logger.info('FCM token unregistered', { count: deleted.count });

  return success(null, 'Token unregistered successfully');
});

// PATCH /api/notifications - Update notification preferences
export const PATCH = withAuth(async (request, { user, logger }) => {
  const body = await request.json();
  const { tokenId, preferences } = body;

  if (!tokenId) {
    throw ApiException.badRequest('Token ID is required');
  }

  // Verify token belongs to user
  const existingToken = await prisma.fcmToken.findFirst({
    where: {
      id: tokenId,
      userId: user.id,
    },
  });

  if (!existingToken) {
    throw ApiException.notFound('Token not found');
  }

  // Update preferences
  const updated = await prisma.fcmToken.update({
    where: { id: tokenId },
    data: {
      tunnelNotifications: preferences.tunnelNotifications ?? existingToken.tunnelNotifications,
      requestNotifications: preferences.requestNotifications ?? existingToken.requestNotifications,
      errorNotifications: preferences.errorNotifications ?? existingToken.errorNotifications,
    },
  });

  logger.info('Notification preferences updated', { tokenId });

  return success({
    id: updated.id,
    preferences: {
      tunnelNotifications: updated.tunnelNotifications,
      requestNotifications: updated.requestNotifications,
      errorNotifications: updated.errorNotifications,
    },
  }, 'Preferences updated successfully');
});
