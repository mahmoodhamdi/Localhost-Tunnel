/**
 * Test Notification API Route
 * Sends a test push notification to verify FCM setup
 */

import { withAuth } from '@/lib/api/withAuth';
import { success, ApiException } from '@/lib/api/withApiHandler';
import { prisma } from '@/lib/db/prisma';
import { sendNotification, isFirebaseConfigured } from '@/lib/firebase';

// POST /api/notifications/test - Send test notification
export const POST = withAuth(async (request, { user, logger }) => {
  if (!isFirebaseConfigured()) {
    throw ApiException.badRequest('Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH environment variable.');
  }

  const body = await request.json().catch(() => ({}));
  const { tokenId } = body;

  // Find token(s) to send to
  const whereClause = tokenId
    ? { id: tokenId, userId: user.id, isActive: true }
    : { userId: user.id, isActive: true };

  const tokens = await prisma.fcmToken.findMany({
    where: whereClause,
    select: {
      id: true,
      token: true,
    },
  });

  if (tokens.length === 0) {
    throw ApiException.notFound('No active FCM tokens found. Please enable notifications first.');
  }

  // Send test notification to each token
  type FcmTokenResult = { id: string; token: string };
  const results = await Promise.all(
    tokens.map(async (fcmToken: FcmTokenResult) => {
      try {
        const messageId = await sendNotification(fcmToken.token, {
          title: 'Test Notification',
          body: 'This is a test notification from Localhost Tunnel. Push notifications are working!',
          click_action: '/',
          data: {
            type: 'test',
            timestamp: Date.now().toString(),
          },
        });

        if (messageId) {
          // Update last used timestamp
          await prisma.fcmToken.update({
            where: { id: fcmToken.id },
            data: { lastUsed: new Date() },
          });
        }

        return {
          tokenId: fcmToken.id,
          success: !!messageId,
          messageId,
        };
      } catch (error) {
        logger.warn('Failed to send test notification', {
          tokenId: fcmToken.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return {
          tokenId: fcmToken.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  logger.info('Test notifications sent', { successCount, failureCount });

  return success({
    results,
    summary: {
      total: results.length,
      success: successCount,
      failure: failureCount,
    },
  }, `Test notification sent to ${successCount} device(s)`);
});
