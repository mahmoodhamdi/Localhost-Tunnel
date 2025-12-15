/**
 * Tunnel Notification Service
 * Sends push notifications for tunnel-related events
 */

import { prisma } from '@/lib/db/prisma';
import { sendNotificationToMultiple, type TunnelNotification } from '@/lib/firebase';
import { logger } from '@/lib/logger';

interface TunnelEventData {
  tunnelId: string;
  subdomain: string;
  userId?: string;
  publicUrl?: string;
}

// Send notification to user when tunnel connects
export async function notifyTunnelConnected(data: TunnelEventData): Promise<void> {
  if (!data.userId) return;

  const tokens = await getActiveTokens(data.userId, 'tunnel');
  if (tokens.length === 0) return;

  const notification: TunnelNotification = {
    type: 'tunnel_connected',
    tunnelId: data.tunnelId,
    subdomain: data.subdomain,
    message: `Tunnel "${data.subdomain}" is now online`,
    url: data.publicUrl,
  };

  await sendTunnelNotificationToTokens(tokens, notification);
}

// Send notification when tunnel disconnects
export async function notifyTunnelDisconnected(data: TunnelEventData): Promise<void> {
  if (!data.userId) return;

  const tokens = await getActiveTokens(data.userId, 'tunnel');
  if (tokens.length === 0) return;

  const notification: TunnelNotification = {
    type: 'tunnel_disconnected',
    tunnelId: data.tunnelId,
    subdomain: data.subdomain,
    message: `Tunnel "${data.subdomain}" has disconnected`,
  };

  await sendTunnelNotificationToTokens(tokens, notification);
}

// Send notification for tunnel errors
export async function notifyTunnelError(
  data: TunnelEventData,
  errorMessage: string
): Promise<void> {
  if (!data.userId) return;

  const tokens = await getActiveTokens(data.userId, 'error');
  if (tokens.length === 0) return;

  const notification: TunnelNotification = {
    type: 'tunnel_error',
    tunnelId: data.tunnelId,
    subdomain: data.subdomain,
    message: `Error on "${data.subdomain}": ${errorMessage}`,
    url: `/tunnels/${data.tunnelId}`,
  };

  await sendTunnelNotificationToTokens(tokens, notification);
}

// Send notification for incoming requests (only if enabled)
export async function notifyTunnelRequest(
  data: TunnelEventData,
  method: string,
  path: string,
  statusCode: number
): Promise<void> {
  if (!data.userId) return;

  const tokens = await getActiveTokens(data.userId, 'request');
  if (tokens.length === 0) return;

  const notification: TunnelNotification = {
    type: 'tunnel_request',
    tunnelId: data.tunnelId,
    subdomain: data.subdomain,
    message: `${method} ${path} - ${statusCode}`,
    url: `/tunnels/${data.tunnelId}`,
  };

  await sendTunnelNotificationToTokens(tokens, notification);
}

// Get active FCM tokens for a user based on notification type
async function getActiveTokens(
  userId: string,
  notificationType: 'tunnel' | 'error' | 'request'
): Promise<string[]> {
  const whereCondition = {
    userId,
    isActive: true,
    ...(notificationType === 'tunnel' && { tunnelNotifications: true }),
    ...(notificationType === 'error' && { errorNotifications: true }),
    ...(notificationType === 'request' && { requestNotifications: true }),
  };

  const tokens = await prisma.fcmToken.findMany({
    where: whereCondition,
    select: { token: true },
  });

  return tokens.map((t) => t.token);
}

// Helper to send notification to multiple tokens
async function sendTunnelNotificationToTokens(
  tokens: string[],
  notification: TunnelNotification
): Promise<void> {
  if (tokens.length === 0) return;

  try {
    const result = await sendNotificationToMultiple(tokens, {
      title: getTitleForType(notification.type),
      body: notification.message,
      click_action: notification.url,
      data: {
        type: notification.type,
        tunnelId: notification.tunnelId,
        subdomain: notification.subdomain,
      },
    });

    logger.debug('Tunnel notification sent', {
      type: notification.type,
      subdomain: notification.subdomain,
      success: result.successCount,
      failure: result.failureCount,
    });
  } catch (error) {
    logger.warn('Failed to send tunnel notification', {
      type: notification.type,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function getTitleForType(type: TunnelNotification['type']): string {
  switch (type) {
    case 'tunnel_connected':
      return 'Tunnel Connected';
    case 'tunnel_disconnected':
      return 'Tunnel Disconnected';
    case 'tunnel_error':
      return 'Tunnel Error';
    case 'tunnel_request':
      return 'New Request';
  }
}
