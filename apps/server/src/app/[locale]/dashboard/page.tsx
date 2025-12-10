import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowRight, Activity, Wifi, HardDrive, Clock } from 'lucide-react';

export default function DashboardPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = useTranslations();

  const stats = [
    {
      title: t('dashboard.stats.activeTunnels'),
      value: '0',
      icon: Wifi,
      trend: null,
    },
    {
      title: t('dashboard.stats.totalRequests'),
      value: '0',
      icon: Activity,
      trend: null,
    },
    {
      title: t('dashboard.stats.bandwidth'),
      value: '0 B',
      icon: HardDrive,
      trend: null,
    },
    {
      title: t('dashboard.stats.uptime'),
      value: '100%',
      icon: Clock,
      trend: null,
    },
  ];

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/tunnels/new">
            <Plus className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
            {t('dashboard.createTunnel')}
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/tunnels/new">
                <Plus className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                {t('dashboard.createTunnel')}
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/tunnels">
                <ArrowRight className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 rtl:rotate-180" />
                {t('dashboard.viewTunnels')}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              {t('dashboard.noActivity')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Welcome Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl">{t('dashboard.welcome')}</CardTitle>
          <CardDescription className="text-base">
            {t('home.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">TLS Encryption</Badge>
            <Badge variant="secondary">Custom Subdomains</Badge>
            <Badge variant="secondary">Request Inspection</Badge>
            <Badge variant="secondary">WebSocket Support</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
