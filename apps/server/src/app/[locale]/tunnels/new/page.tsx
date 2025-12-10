'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
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
import { Loader2 } from 'lucide-react';

export default function NewTunnelPage() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    port: '3000',
    host: 'localhost',
    subdomain: '',
    protocol: 'HTTP',
    password: '',
    ipWhitelist: '',
    expiration: 'never',
    inspect: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/tunnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localPort: parseInt(formData.port),
          localHost: formData.host,
          subdomain: formData.subdomain || undefined,
          protocol: formData.protocol,
          password: formData.password || undefined,
          ipWhitelist: formData.ipWhitelist || undefined,
          expiresIn: formData.expiration !== 'never' ? parseInt(formData.expiration) : undefined,
          inspect: formData.inspect,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/tunnels/${data.data.id}`);
      } else {
        const error = await response.json();
        alert(error.error?.message || 'Failed to create tunnel');
      }
    } catch (error) {
      console.error('Failed to create tunnel:', error);
      alert('Failed to create tunnel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('tunnel.create.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('tunnel.create.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{t('tunnel.create.title')}</CardTitle>
            <CardDescription>{t('tunnel.create.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Port */}
            <div className="space-y-2">
              <Label htmlFor="port">{t('tunnel.port')}</Label>
              <Input
                id="port"
                type="number"
                placeholder={t('tunnel.portPlaceholder')}
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                data-testid="port-input"
                required
              />
              <p className="text-sm text-muted-foreground">{t('tunnel.portHint')}</p>
            </div>

            {/* Host */}
            <div className="space-y-2">
              <Label htmlFor="host">{t('tunnel.host')}</Label>
              <Input
                id="host"
                placeholder={t('tunnel.hostPlaceholder')}
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">{t('tunnel.hostHint')}</p>
            </div>

            {/* Subdomain */}
            <div className="space-y-2">
              <Label htmlFor="subdomain">{t('tunnel.subdomain')}</Label>
              <Input
                id="subdomain"
                placeholder={t('tunnel.subdomainPlaceholder')}
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                data-testid="subdomain-input"
              />
              <p className="text-sm text-muted-foreground">{t('tunnel.subdomainHint')}</p>
            </div>

            {/* Protocol */}
            <div className="space-y-2">
              <Label>{t('tunnel.protocol')}</Label>
              <Select
                value={formData.protocol}
                onValueChange={(value) => setFormData({ ...formData, protocol: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTTP">{t('tunnel.protocols.http')}</SelectItem>
                  <SelectItem value="TCP">{t('tunnel.protocols.tcp')}</SelectItem>
                  <SelectItem value="WS">{t('tunnel.protocols.ws')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('tunnel.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('tunnel.passwordPlaceholder')}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">{t('tunnel.passwordHint')}</p>
            </div>

            {/* IP Whitelist */}
            <div className="space-y-2">
              <Label htmlFor="ipWhitelist">{t('tunnel.ipWhitelist')}</Label>
              <Input
                id="ipWhitelist"
                placeholder={t('tunnel.ipWhitelistPlaceholder')}
                value={formData.ipWhitelist}
                onChange={(e) => setFormData({ ...formData, ipWhitelist: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">{t('tunnel.ipWhitelistHint')}</p>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label>{t('tunnel.expiration')}</Label>
              <Select
                value={formData.expiration}
                onValueChange={(value) => setFormData({ ...formData, expiration: value })}
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

            {/* Inspect */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('tunnel.inspect')}</Label>
                <p className="text-sm text-muted-foreground">{t('tunnel.inspectHint')}</p>
              </div>
              <Switch
                checked={formData.inspect}
                onCheckedChange={(checked) => setFormData({ ...formData, inspect: checked })}
              />
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />
                  {t('tunnel.creating')}
                </>
              ) : (
                t('tunnel.createButton')
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
