'use client';

import { Bell, BellOff, Smartphone, Trash2, TestTube, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationSettings() {
  const t = useTranslations('notifications');
  const {
    isSupported,
    permission,
    isEnabled,
    isLoading,
    devices,
    enableNotifications,
    disableNotifications,
    updatePreferences,
    sendTestNotification,
    refreshDevices,
  } = useNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('notSupported')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('title')}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshDevices}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-enabled">{t('enableNotifications')}</Label>
            <p className="text-sm text-muted-foreground">
              {permission === 'denied'
                ? t('permissionDenied')
                : isEnabled
                  ? t('notificationsEnabled')
                  : t('notificationsDisabled')}
            </p>
          </div>
          <Switch
            id="notifications-enabled"
            checked={isEnabled}
            disabled={isLoading || permission === 'denied'}
            onCheckedChange={(checked) => {
              if (checked) {
                enableNotifications();
              } else {
                disableNotifications();
              }
            }}
          />
        </div>

        {/* Test Notification Button */}
        {isEnabled && (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('testNotification')}</Label>
              <p className="text-sm text-muted-foreground">{t('testNotificationDesc')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={sendTestNotification}
              disabled={isLoading}
            >
              <TestTube className="h-4 w-4 mr-2" />
              {t('sendTest')}
            </Button>
          </div>
        )}

        {/* Registered Devices */}
        {devices.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('registeredDevices')}</Label>
              <Badge variant="secondary">{devices.length}</Badge>
            </div>

            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{device.platform}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={async () => {
                        await fetch(`/api/notifications?id=${device.id}`, {
                          method: 'DELETE',
                        });
                        refreshDevices();
                      }}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {t('lastUsed')}: {new Date(device.lastUsed).toLocaleString()}
                  </div>

                  {/* Notification Preferences */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`tunnel-${device.id}`} className="text-sm">
                        {t('tunnelNotifications')}
                      </Label>
                      <Switch
                        id={`tunnel-${device.id}`}
                        checked={device.tunnelNotifications}
                        disabled={isLoading}
                        onCheckedChange={(checked) =>
                          updatePreferences(device.id, { tunnelNotifications: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor={`request-${device.id}`} className="text-sm">
                        {t('requestNotifications')}
                      </Label>
                      <Switch
                        id={`request-${device.id}`}
                        checked={device.requestNotifications}
                        disabled={isLoading}
                        onCheckedChange={(checked) =>
                          updatePreferences(device.id, { requestNotifications: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor={`error-${device.id}`} className="text-sm">
                        {t('errorNotifications')}
                      </Label>
                      <Switch
                        id={`error-${device.id}`}
                        checked={device.errorNotifications}
                        disabled={isLoading}
                        onCheckedChange={(checked) =>
                          updatePreferences(device.id, { errorNotifications: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
