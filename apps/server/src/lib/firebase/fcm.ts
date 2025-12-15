import type { Message, MulticastMessage } from 'firebase-admin/messaging';
import { getMessaging, isFirebaseConfigured } from './admin';
import { logger } from '../logger';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  click_action?: string;
  data?: Record<string, string>;
}

export interface TunnelNotification {
  type: 'tunnel_connected' | 'tunnel_disconnected' | 'tunnel_request' | 'tunnel_error';
  tunnelId: string;
  subdomain: string;
  message: string;
  url?: string;
}

// Send notification to a single device
export async function sendNotification(
  token: string,
  notification: NotificationPayload
): Promise<string | null> {
  if (!isFirebaseConfigured()) {
    logger.debug('FCM not configured, skipping notification');
    return null;
  }

  const messaging = getMessaging();
  if (!messaging) {
    return null;
  }

  try {
    const message: Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      webpush: {
        notification: {
          icon: notification.icon || '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          requireInteraction: true,
        },
        fcmOptions: {
          link: notification.click_action,
        },
      },
      data: notification.data,
    };

    const response = await messaging.send(message);
    logger.info(`FCM notification sent: ${response}`);
    return response;
  } catch (error) {
    logger.error('Error sending FCM notification:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Send notification to multiple devices
export async function sendNotificationToMultiple(
  tokens: string[],
  notification: NotificationPayload
): Promise<{ successCount: number; failureCount: number }> {
  if (!isFirebaseConfigured() || tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const messaging = getMessaging();
  if (!messaging) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const message: MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      webpush: {
        notification: {
          icon: notification.icon || '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          requireInteraction: true,
        },
        fcmOptions: {
          link: notification.click_action,
        },
      },
      data: notification.data,
    };

    const response = await messaging.sendEachForMulticast(message);
    logger.info(`FCM multicast sent: ${response.successCount} success, ${response.failureCount} failed`);

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    logger.error('Error sending FCM multicast:', error instanceof Error ? error.message : 'Unknown error');
    return { successCount: 0, failureCount: tokens.length };
  }
}

// Send tunnel-specific notification
export async function sendTunnelNotification(
  token: string,
  tunnelNotification: TunnelNotification
): Promise<string | null> {
  const notificationConfig: Record<TunnelNotification['type'], { title: string; icon: string }> = {
    tunnel_connected: {
      title: 'Tunnel Connected',
      icon: '/icons/tunnel-connected.png',
    },
    tunnel_disconnected: {
      title: 'Tunnel Disconnected',
      icon: '/icons/tunnel-disconnected.png',
    },
    tunnel_request: {
      title: 'New Request',
      icon: '/icons/tunnel-request.png',
    },
    tunnel_error: {
      title: 'Tunnel Error',
      icon: '/icons/tunnel-error.png',
    },
  };

  const config = notificationConfig[tunnelNotification.type];

  return sendNotification(token, {
    title: config.title,
    body: tunnelNotification.message,
    icon: config.icon,
    click_action: tunnelNotification.url,
    data: {
      type: tunnelNotification.type,
      tunnelId: tunnelNotification.tunnelId,
      subdomain: tunnelNotification.subdomain,
    },
  });
}

// Validate FCM token
export async function validateToken(token: string): Promise<boolean> {
  if (!isFirebaseConfigured()) {
    return false;
  }

  const messaging = getMessaging();
  if (!messaging) {
    return false;
  }

  try {
    // Send a dry run message to validate the token
    await messaging.send(
      {
        token,
        notification: {
          title: 'test',
          body: 'test',
        },
      },
      true // dryRun
    );
    return true;
  } catch {
    return false;
  }
}
