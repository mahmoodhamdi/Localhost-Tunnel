'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
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
import { useTheme } from 'next-themes';
import { Check, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState({
    defaultPort: '3000',
    defaultSubdomain: '',
    autoReconnect: true,
    keepHistory: '7',
    maxRequests: '1000',
    requirePassword: false,
    defaultExpiration: 'never',
    rateLimit: '100',
  });

  const handleSave = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="container py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
      </div>

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

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button variant="outline">{t('settings.reset')}</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />
                {t('common.loading')}
              </>
            ) : saved ? (
              <>
                <Check className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
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
