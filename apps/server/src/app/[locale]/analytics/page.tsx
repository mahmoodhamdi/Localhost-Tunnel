'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Activity, Users, HardDrive, Clock, TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

interface AnalyticsMetrics {
  totalRequests: number;
  uniqueIps: number;
  bandwidth: number;
  avgResponseTime: number;
  successRate: number;
  errorRate: number;
}

interface ChartData {
  requestsOverTime: Array<{ timestamp: string; count: number }>;
  requestsByMethod: Array<{ method: string; count: number }>;
  requestsByStatus: Array<{ status: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

interface TunnelOption {
  id: string;
  subdomain: string;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const STATUS_COLORS: Record<string, string> = {
  '2xx': '#22c55e',
  '3xx': '#3b82f6',
  '4xx': '#f59e0b',
  '5xx': '#ef4444',
};

export default function AnalyticsPage() {
  const t = useTranslations();

  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [tunnels, setTunnels] = useState<TunnelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTunnel, setSelectedTunnel] = useState('all');
  const [dateRange, setDateRange] = useState('7d');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedTunnel !== 'all') params.set('tunnelId', selectedTunnel);
      params.set('range', dateRange);

      const response = await fetch(`/api/analytics?${params}`);
      const data = await response.json();

      if (data.success) {
        setMetrics(data.data.metrics);
        setCharts(data.data.charts);
        setTunnels(data.data.tunnels);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to load analytics');
      }
    } catch (err) {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedTunnel, dateRange]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    if (dateRange === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const metricsCards = [
    {
      title: t('analytics.metrics.totalRequests'),
      value: metrics?.totalRequests.toLocaleString() || '0',
      icon: Activity,
      change: null,
    },
    {
      title: t('analytics.metrics.uniqueIps'),
      value: metrics?.uniqueIps.toLocaleString() || '0',
      icon: Users,
      change: null,
    },
    {
      title: t('analytics.metrics.bandwidth'),
      value: formatBytes(metrics?.bandwidth || 0),
      icon: HardDrive,
      change: null,
    },
    {
      title: t('analytics.metrics.avgResponseTime'),
      value: `${metrics?.avgResponseTime || 0}ms`,
      icon: Clock,
      change: null,
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
          <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex gap-4">
          <Select value={selectedTunnel} onValueChange={setSelectedTunnel}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('analytics.selectTunnel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('analytics.allTunnels')}</SelectItem>
              {tunnels.map((tunnel) => (
                <SelectItem key={tunnel.id} value={tunnel.id}>
                  {tunnel.subdomain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('analytics.dateRange')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">{t('analytics.last24h')}</SelectItem>
              <SelectItem value="7d">{t('analytics.last7d')}</SelectItem>
              <SelectItem value="30d">{t('analytics.last30d')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
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

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {metricsCards.map((metric, index) => (
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

      {/* Success/Error Rate */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.metrics.successRate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{metrics?.successRate || 0}%</div>
            <div className="w-full h-2 bg-muted rounded-full mt-2">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${metrics?.successRate || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.metrics.errorRate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{metrics?.errorRate || 0}%</div>
            <div className="w-full h-2 bg-muted rounded-full mt-2">
              <div
                className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: `${metrics?.errorRate || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        {/* Requests Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.requestsOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.requestsOverTime && charts.requestsOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={charts.requestsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTimestamp}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {t('common.noData')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Codes */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.statusCodes')}</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.requestsByStatus && charts.requestsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={charts.requestsByStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ status, count }) => `${status}: ${count}`}
                  >
                    {charts.requestsByStatus.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {t('common.noData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Request Methods */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.methods')}</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.requestsByMethod && charts.requestsByMethod.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={charts.requestsByMethod} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="method" type="category" className="text-xs" width={60} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {t('common.noData')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Paths */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.topPaths')}</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.topPaths && charts.topPaths.length > 0 ? (
              <div className="space-y-4">
                {charts.topPaths.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <code className="text-sm truncate flex-1">{item.path}</code>
                    </div>
                    <span className="text-sm font-medium ml-4">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {t('common.noData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
