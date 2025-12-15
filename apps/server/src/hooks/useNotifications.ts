'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  requestNotificationPermission,
  isPushNotificationSupported,
  getNotificationPermissionStatus,
  onForegroundMessage,
} from '@/lib/firebase/client';
import { useToast } from '@/hooks/use-toast';

interface NotificationPreferences {
  tunnelNotifications: boolean;
  requestNotifications: boolean;
  errorNotifications: boolean;
}

interface NotificationDevice {
  id: string;
  platform: string;
  deviceId?: string;
  tunnelNotifications: boolean;
  requestNotifications: boolean;
  errorNotifications: boolean;
  lastUsed: string;
  createdAt: string;
}

export function useNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [devices, setDevices] = useState<NotificationDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const { toast } = useToast();

  // Check support on mount
  useEffect(() => {
    setIsSupported(isPushNotificationSupported());
    setPermission(getNotificationPermissionStatus());
  }, []);

  // Fetch current notification settings
  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.data?.tokens || []);
        setIsEnabled(data.data?.tokens?.length > 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Setup foreground message listener
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupListener = async () => {
      unsubscribe = await onForegroundMessage((payload) => {
        // Show toast for foreground notifications
        toast({
          title: payload.title || 'Notification',
          description: payload.body,
        });
      });
    };

    if (isEnabled && permission === 'granted') {
      setupListener();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isEnabled, permission, toast]);

  // Enable notifications
  const enableNotifications = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications are not supported in this browser',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);

    try {
      const token = await requestNotificationPermission();

      if (!token) {
        toast({
          title: 'Permission Denied',
          description: 'Please allow notifications in your browser settings',
          variant: 'destructive',
        });
        setPermission(getNotificationPermissionStatus());
        return false;
      }

      // Register token with server
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          platform: 'WEB',
          deviceId: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register notification token');
      }

      const data = await response.json();
      setCurrentDeviceId(data.data?.id);
      setIsEnabled(true);
      setPermission('granted');

      toast({
        title: 'Notifications Enabled',
        description: 'You will now receive push notifications',
      });

      await fetchDevices();
      return true;
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to enable notifications',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, toast, fetchDevices]);

  // Disable notifications for current device
  const disableNotifications = useCallback(async () => {
    if (!currentDeviceId) {
      toast({
        title: 'Error',
        description: 'No active notification device found',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/notifications?id=${currentDeviceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disable notifications');
      }

      setIsEnabled(false);
      setCurrentDeviceId(null);

      toast({
        title: 'Notifications Disabled',
        description: 'You will no longer receive push notifications on this device',
      });

      await fetchDevices();
      return true;
    } catch (error) {
      console.error('Error disabling notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to disable notifications',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentDeviceId, toast, fetchDevices]);

  // Update notification preferences
  const updatePreferences = useCallback(
    async (tokenId: string, preferences: Partial<NotificationPreferences>) => {
      setIsLoading(true);

      try {
        const response = await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenId,
            preferences,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update preferences');
        }

        toast({
          title: 'Preferences Updated',
          description: 'Your notification preferences have been saved',
        });

        await fetchDevices();
        return true;
      } catch (error) {
        console.error('Error updating preferences:', error);
        toast({
          title: 'Error',
          description: 'Failed to update preferences',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast, fetchDevices]
  );

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: currentDeviceId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send test notification');
      }

      toast({
        title: 'Test Sent',
        description: 'Check for a test notification on your device',
      });

      return true;
    } catch (error) {
      console.error('Error sending test:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send test notification',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentDeviceId, toast]);

  return {
    isSupported,
    permission,
    isEnabled,
    isLoading,
    devices,
    currentDeviceId,
    enableNotifications,
    disableNotifications,
    updatePreferences,
    sendTestNotification,
    refreshDevices: fetchDevices,
  };
}
