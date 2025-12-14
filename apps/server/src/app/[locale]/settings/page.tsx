'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTheme } from 'next-themes';
import { Check, Loader2, RotateCcw } from 'lucide-react';

interface Settings {
  defaultPort: string;
  defaultSubdomain: string;
  autoReconnect: boolean;
  keepHistory: string;
  maxRequests: string;
  requirePassword: boolean;
  defaultExpiration: string;
  rateLimit: string;
}

const DEFAULT_SETTINGS: Settings = {
  defaultPort: '3000',
  defaultSubdomain: '',
  autoReconnect: true,
  keepHistory: '7',
  maxRequests: '1000',
  requirePassword: false,
  defaultExpiration: 'never',
  rateLimit: '100',
};

export default function SettingsPage() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      const data = await response.json();

      if (data.success) {
        setSettings({
          defaultPort: data.data.defaultPort.toString(),
          defaultSubdomain: data.data.defaultSubdomain,
          autoReconnect: data.data.autoReconnect,
          keepHistory: data.data.keepHistory.toString(),
          maxRequests: data.data.maxRequests.toString(),
          requirePassword: data.data.requirePassword,
          defaultExpiration: data.data.defaultExpiration,
          rateLimit: data.data.rateLimit.toString(),
        });
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to load settings');
      }
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultPort: parseInt(settings.defaultPort, 10),
          defaultSubdomain: settings.defaultSubdomain,
          autoReconnect: settings.autoReconnect,
          keepHistory: parseInt(settings.keepHistory, 10),
          maxRequests: parseInt(settings.maxRequests, 10),
          requirePassword: settings.requirePassword,
          defaultExpiration: settings.defaultExpiration,
          rateLimit: parseInt(settings.rateLimit, 10),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error?.message || 'Failed to save settings');
      }
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/settings', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSettings({
          defaultPort: data.data.defaultPort.toString(),
          defaultSubdomain: data.data.defaultSubdomain,
          autoReconnect: data.data.autoReconnect,
          keepHistory: data.data.keepHistory.toString(),
          maxRequests: data.data.maxRequests.toString(),
          requirePassword: data.data.requirePassword,
          defaultExpiration: data.data.defaultExpiration,
          rateLimit: data.data.rateLimit.toString(),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error?.message || 'Failed to reset settings');
      }
    } catch (err) {
      setError('Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-8 max-w-2xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-destructive mb-6">
          <CardContent className="py-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.general.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="defaultPort">{t('settings.general.defaultPort')}</Label>
              <Input
                id="defaultPort"
                type="number"
                min="1"
                max="65535"
                value={settings.defaultPort}
                onChange={(e) => setSettings({ ...settings, defaultPort: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                {t('settings.general.defaultPortHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultSubdomain">{t('settings.general.defaultSubdomain')}</Label>
              <Input
                id="defaultSubdomain"
                value={settings.defaultSubdomain}
                onChange={(e) => setSettings({ ...settings, defaultSubdomain: e.target.value })}
                placeholder="my-app"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.general.autoReconnect')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.general.autoReconnectHint')}
                </p>
              </div>
              <Switch
                checked={settings.autoReconnect}
                onCheckedChange={(checked) => setSettings({ ...settings, autoReconnect: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keepHistory">{t('settings.general.keepHistory')}</Label>
              <Input
                id="keepHistory"
                type="number"
                min="1"
                max="365"
                value={settings.keepHistory}
                onChange={(e) => setSettings({ ...settings, keepHistory: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                {t('settings.general.keepHistoryHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRequests">{t('settings.general.maxRequests')}</Label>
              <Input
                id="maxRequests"
                type="number"
                min="100"
                max="100000"
                value={settings.maxRequests}
                onChange={(e) => setSettings({ ...settings, maxRequests: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                {t('settings.general.maxRequestsHint')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.security.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.security.requirePassword')}</Label>
              </div>
              <Switch
                checked={settings.requirePassword}
                onCheckedChange={(checked) => setSettings({ ...settings, requirePassword: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('settings.security.defaultExpiration')}</Label>
              <Select
                value={settings.defaultExpiration}
                onValueChange={(value) => setSettings({ ...settings, defaultExpiration: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">{t('tunnel.expirations.never')}</SelectItem>
                  <SelectItem value="3600">{t('tunnel.expirations.1h')}</SelectItem>
                  <SelectItem value="21600">{t('tunnel.expirations.6h')}</SelectItem>
                  <SelectItem value="86400">{t('tunnel.expirations.24h')}</SelectItem>
                  <SelectItem value="604800">{t('tunnel.expirations.7d')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateLimit">{t('settings.security.rateLimit')}</Label>
              <Input
                id="rateLimit"
                type="number"
                min="0"
                max="10000"
                value={settings.rateLimit}
                onChange={(e) => setSettings({ ...settings, rateLimit: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                {t('settings.security.rateLimitHint')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.appearance')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{t('settings.theme')}</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('settings.themes.light')}</SelectItem>
                  <SelectItem value="dark">{t('settings.themes.dark')}</SelectItem>
                  <SelectItem value="system">{t('settings.themes.system')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={saving}>
                <RotateCcw className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                {t('settings.reset')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.reset')}</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all settings to their default values. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>{t('common.confirm')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />
                {t('common.loading')}
              </>
            ) : saved ? (
              <>
                <Check className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 text-green-500" />
                {t('settings.saved')}
              </>
            ) : (
              t('settings.save')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
