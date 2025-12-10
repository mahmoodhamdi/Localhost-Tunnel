import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Activity, Users, HardDrive, Clock, TrendingUp, TrendingDown } from 'lucide-react';

export default function AnalyticsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = useTranslations();

  const metrics = [
    {
      title: t('analytics.metrics.totalRequests'),
      value: '0',
      icon: Activity,
      change: null,
    },
    {
      title: t('analytics.metrics.uniqueIps'),
      value: '0',
      icon: Users,
      change: null,
    },
    {
      title: t('analytics.metrics.bandwidth'),
      value: '0 B',
      icon: HardDrive,
      change: null,
    },
    {
      title: t('analytics.metrics.avgResponseTime'),
      value: '0ms',
      icon: Clock,
      change: null,
    },
  ];

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex gap-4">
          <Select defaultValue="all">
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('analytics.selectTunnel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('analytics.allTunnels')}</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="7d">
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('analytics.dateRange')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">{t('analytics.last24h')}</SelectItem>
              <SelectItem value="7d">{t('analytics.last7d')}</SelectItem>
              <SelectItem value="30d">{t('analytics.last30d')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              {metric.change && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {metric.change > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  {metric.change > 0 ? '+' : ''}{metric.change}% from last period
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.requestsOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {t('common.noData')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.statusCodes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {t('common.noData')}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.methods')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {t('common.noData')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.topPaths')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {t('common.noData')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
