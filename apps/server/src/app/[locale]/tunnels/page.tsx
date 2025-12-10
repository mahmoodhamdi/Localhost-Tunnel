import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Wifi, WifiOff } from 'lucide-react';

export default function TunnelsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = useTranslations();

  // TODO: Fetch tunnels from API
  const tunnels: Array<{
    id: string;
    subdomain: string;
    localPort: number;
    isActive: boolean;
    totalRequests: number;
    createdAt: string;
  }> = [];

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('tunnels.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('tunnels.subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/tunnels/new">
            <Plus className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
            {t('tunnel.create.title')}
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            placeholder={t('tunnels.searchPlaceholder')}
            className="pl-10 rtl:pl-4 rtl:pr-10"
          />
        </div>
      </div>

      {/* Tunnels List */}
      {tunnels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-xl mb-2">{t('tunnels.noTunnels')}</CardTitle>
            <CardDescription className="text-center mb-6">
              {t('tunnels.noTunnelsDesc')}
            </CardDescription>
            <Button asChild>
              <Link href="/tunnels/new">
                <Plus className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                {t('tunnels.createFirst')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tunnels.map((tunnel) => (
            <Card key={tunnel.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {tunnel.isActive ? (
                      <Wifi className="h-6 w-6 text-green-500" />
                    ) : (
                      <WifiOff className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{tunnel.subdomain}</div>
                    <div className="text-sm text-muted-foreground">
                      localhost:{tunnel.localPort}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={tunnel.isActive ? 'success' : 'secondary'}>
                    {tunnel.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/tunnels/${tunnel.id}`}>
                      {t('common.view')}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
