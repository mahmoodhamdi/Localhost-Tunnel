'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Globe,
  Activity,
  HardDrive,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminStats {
  totalUsers: number;
  activeTunnels: number;
  todayRequests: number;
  totalBandwidth: number;
}

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function getActionBadgeClass(action: string): string {
  switch (action.toUpperCase()) {
    case 'LOGIN':
    case 'REGISTER':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'CREATE':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'DELETE':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'UPDATE':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
}

export default function AdminOverviewPage() {
  const t = useTranslations('admin');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, auditRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/audit?limit=5'),
      ]);

      const statsData = await statsRes.json();
      const auditData = await auditRes.json();

      if (statsData.success) {
        setStats(statsData.data);
      }
      if (auditData.success) {
        setAuditLog(auditData.data.entries || auditData.data || []);
      }
      setError(null);
    } catch {
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const statsCards = [
    {
      title: t('overview.totalUsers'),
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: 'text-blue-500',
      format: (v: number) => v.toLocaleString(),
    },
    {
      title: t('overview.activeTunnels'),
      value: stats?.activeTunnels ?? 0,
      icon: Globe,
      color: 'text-green-500',
      format: (v: number) => v.toLocaleString(),
    },
    {
      title: t('overview.todayRequests'),
      value: stats?.todayRequests ?? 0,
      icon: Activity,
      color: 'text-orange-500',
      format: (v: number) => v.toLocaleString(),
    },
    {
      title: t('overview.totalBandwidth'),
      value: stats?.totalBandwidth ?? 0,
      icon: HardDrive,
      color: 'text-purple-500',
      format: (v: number) => formatBytes(v),
    },
  ];

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">{t('overview.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('title')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive mb-6">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-4 rounded" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))
          : statsCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${card.color}`} aria-hidden="true" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${card.color}`}>
                      {card.format(card.value)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Recent Audit Log */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle className="text-base">{t('overview.recentAudit')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : auditLog.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
              {t('audit.noLogs')}
            </div>
          ) : (
            <div className="divide-y">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getActionBadgeClass(entry.action)}`}
                    >
                      {entry.action}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {entry.userEmail || 'System'}
                    </span>
                    <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                      {entry.resource}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {entry.ipAddress && (
                      <span className="font-mono">{entry.ipAddress}</span>
                    )}
                    <span>{formatDate(entry.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
