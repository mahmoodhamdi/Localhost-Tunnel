'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowRight, Activity, Wifi, HardDrive, Clock, Loader2, RefreshCw } from 'lucide-react';

interface DashboardStats {
  activeTunnels: number;
  totalTunnels: number;
  totalRequests: number;
  totalBytes: number;
  uptime: number;
}

interface RecentActivity {
  id: string;
  subdomain: string;
  method: string;
  path: string;
  statusCode: number | null;
  createdAt: string;
}

export default function DashboardPage() {
  const t = useTranslations();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.data.stats);
        setRecentActivity(data.data.recentActivity);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to load dashboard data');
      }
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getStatusColor = (statusCode: number | null): string => {
    if (!statusCode) return 'text-muted-foreground';
    if (statusCode >= 200 && statusCode < 300) return 'text-green-500';
    if (statusCode >= 400 && statusCode < 500) return 'text-yellow-500';
    if (statusCode >= 500) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const statsCards = [
    {
      title: t('dashboard.stats.activeTunnels'),
      value: stats?.activeTunnels.toString() || '0',
      icon: Wifi,
      color: 'text-green-500',
    },
    {
      title: t('dashboard.stats.totalRequests'),
      value: stats?.totalRequests.toLocaleString() || '0',
      icon: Activity,
    },
    {
      title: t('dashboard.stats.bandwidth'),
      value: formatBytes(stats?.totalBytes || 0),
      icon: HardDrive,
    },
    {
      title: t('dashboard.stats.uptime'),
      value: `${stats?.uptime || 100}%`,
      icon: Clock,
      color: stats && stats.uptime < 50 ? 'text-red-500' : 'text-green-500',
    },
  ];

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t('common.refresh')}
          </Button>
          <Button asChild>
            <Link href="/tunnels/new">
              <Plus className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
              {t('dashboard.createTunnel')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-destructive mb-6">
          <CardContent className="py-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statsCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color || 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color || ''}`}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
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
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/analytics">
                <Activity className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                {t('nav.analytics')}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {t('dashboard.noActivity')}
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {activity.method}
                      </Badge>
                      <span className="text-muted-foreground truncate max-w-[150px]">
                        {activity.subdomain}{activity.path}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getStatusColor(activity.statusCode)}`}>
                        {activity.statusCode || '-'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(activity.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <Badge variant="secondary">Password Protection</Badge>
            <Badge variant="secondary">IP Whitelisting</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
