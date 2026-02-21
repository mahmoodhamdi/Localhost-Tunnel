'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, RotateCcw, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface SystemSettings {
  defaultPort: number;
  autoReconnect: boolean;
  keepHistory: number;
  maxRequests: number;
  requirePassword: boolean;
  defaultExpiration: string;
  rateLimit: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  defaultPort: 3000,
  autoReconnect: true,
  keepHistory: 7,
  maxRequests: 1000,
  requirePassword: false,
  defaultExpiration: 'never',
  rateLimit: 0,
};

export default function AdminSettingsPage() {
  const t = useTranslations('admin');

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.data) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.data });
      }
    } catch {
      // Use defaults if settings API is not available
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('settings.saved'));
      } else {
        toast.error(data.error?.message || 'Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/settings', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSettings(DEFAULT_SETTINGS);
        toast.success(t('settings.resetSuccess'));
      } else {
        toast.error(data.error?.message || 'Failed to reset settings');
      }
    } catch {
      toast.error('Failed to reset settings');
    } finally {
      setResetting(false);
    }
  };

  const updateField = <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-6 max-w-2xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure system-wide defaults and behavior
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={resetting || saving}
          >
            {resetting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
            )}
            {t('settings.reset')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || resetting}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
            )}
            {t('settings.save')}
          </Button>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" aria-hidden="true" />
              General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Default Port */}
            <div className="space-y-2">
              <Label htmlFor="defaultPort">{t('settings.defaultPort')}</Label>
              <Input
                id="defaultPort"
                type="number"
                min={1}
                max={65535}
                value={settings.defaultPort}
                onChange={(e) =>
                  updateField('defaultPort', parseInt(e.target.value, 10) || 3000)
                }
                className="max-w-xs"
              />
            </div>

            {/* Keep History */}
            <div className="space-y-2">
              <Label htmlFor="keepHistory">{t('settings.keepHistory')}</Label>
              <Input
                id="keepHistory"
                type="number"
                min={1}
                max={365}
                value={settings.keepHistory}
                onChange={(e) =>
                  updateField('keepHistory', parseInt(e.target.value, 10) || 7)
                }
                className="max-w-xs"
              />
            </div>

            {/* Max Requests */}
            <div className="space-y-2">
              <Label htmlFor="maxRequests">{t('settings.maxRequests')}</Label>
              <Input
                id="maxRequests"
                type="number"
                min={0}
                value={settings.maxRequests}
                onChange={(e) =>
                  updateField('maxRequests', parseInt(e.target.value, 10) || 0)
                }
                className="max-w-xs"
              />
            </div>

            {/* Auto Reconnect */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoReconnect">{t('settings.autoReconnect')}</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically reconnect tunnels on disconnect
                </p>
              </div>
              <Switch
                id="autoReconnect"
                checked={settings.autoReconnect}
                onCheckedChange={(checked) => updateField('autoReconnect', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Require Password */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="requirePassword">{t('settings.requirePassword')}</Label>
                <p className="text-xs text-muted-foreground">
                  Require password for all new tunnels by default
                </p>
              </div>
              <Switch
                id="requirePassword"
                checked={settings.requirePassword}
                onCheckedChange={(checked) => updateField('requirePassword', checked)}
              />
            </div>

            {/* Default Expiration */}
            <div className="space-y-2">
              <Label htmlFor="defaultExpiration">{t('settings.defaultExpiration')}</Label>
              <select
                id="defaultExpiration"
                value={settings.defaultExpiration}
                onChange={(e) => updateField('defaultExpiration', e.target.value)}
                className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="never">Never</option>
                <option value="1h">1 Hour</option>
                <option value="6h">6 Hours</option>
                <option value="24h">24 Hours</option>
                <option value="7d">7 Days</option>
              </select>
            </div>

            {/* Rate Limit */}
            <div className="space-y-2">
              <Label htmlFor="rateLimit">{t('settings.rateLimit')}</Label>
              <Input
                id="rateLimit"
                type="number"
                min={0}
                value={settings.rateLimit}
                onChange={(e) =>
                  updateField('rateLimit', parseInt(e.target.value, 10) || 0)
                }
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Maximum requests per minute per tunnel. Set to 0 for unlimited.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save/Reset at bottom for mobile convenience */}
      <div className="flex items-center gap-3 mt-8 pt-6 border-t">
        <Button onClick={handleSave} disabled={saving || resetting}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
          )}
          {t('settings.save')}
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={resetting || saving}
        >
          {resetting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
          )}
          {t('settings.reset')}
        </Button>
      </div>
    </div>
  );
}
