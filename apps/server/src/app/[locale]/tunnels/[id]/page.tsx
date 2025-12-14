'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Activity,
  Clock,
  HardDrive,
  Wifi,
  WifiOff,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle,
  Loader2,
} from 'lucide-react';

interface TunnelData {
  id: string;
  subdomain: string;
  publicUrl: string;
  localPort: number;
  localHost: string;
  protocol: string;
  isActive: boolean;
  hasPassword: boolean;
  ipWhitelist: string | null;
  expiresAt: string | null;
  inspect: boolean;
  totalRequests: number;
  totalBytes: number;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  requestCount: number;
}

export default function TunnelDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const tunnelId = params.id as string;

  const [tunnel, setTunnel] = useState<TunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchTunnel = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tunnels/${tunnelId}`);
      const data = await response.json();

      if (data.success) {
        setTunnel(data.data);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to load tunnel');
      }
    } catch (err) {
      setError('Failed to load tunnel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tunnelId) {
      fetchTunnel();
    }
  }, [tunnelId]);

  const copyUrl = async () => {
    if (tunnel?.publicUrl) {
      await navigator.clipboard.writeText(tunnel.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const deleteTunnel = async () => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/tunnels/${tunnelId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        router.push('/tunnels');
      } else {
        alert(data.error?.message || 'Failed to delete tunnel');
      }
    } catch (err) {
      alert('Failed to delete tunnel');
    } finally {
      setDeleting(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !tunnel) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t('errors.tunnelNotFound')}</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button asChild>
            <Link href="/tunnels">
              <ArrowLeft className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 rtl:rotate-180" />
              {t('common.back')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/tunnels">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{tunnel.subdomain}</h1>
              <Badge variant={tunnel.isActive ? 'default' : 'secondary'}>
                {tunnel.isActive ? (
                  <>
                    <Wifi className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
                    {t('common.active')}
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
                    {t('common.inactive')}
                  </>
                )}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              localhost:{tunnel.localPort}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchTunnel()}>
            <RefreshCw className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t('common.refresh')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('common.delete')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('tunnelDetail.actions.delete')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('tunnelDetail.confirmDelete')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={deleteTunnel} disabled={deleting}>
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2 rtl:ml-2 rtl:mr-0" />
                  ) : null}
                  {t('common.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Public URL Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('tunnelDetail.publicUrl')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm overflow-x-auto">
              {tunnel.publicUrl}
            </code>
            <Button variant="outline" onClick={copyUrl}>
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0 text-green-500" />
                  {t('common.copied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  {t('common.copy')}
                </>
              )}
            </Button>
            <Button variant="outline" asChild>
              <a href={tunnel.publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('tunnelDetail.actions.openUrl')}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('tunnelDetail.stats.totalRequests')}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tunnel.totalRequests.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('tunnelDetail.stats.bandwidth')}
            </CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(tunnel.totalBytes)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('tunnelDetail.created')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTimeAgo(tunnel.createdAt)}</div>
            <p className="text-xs text-muted-foreground">{formatDate(tunnel.createdAt)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('tunnelDetail.lastActive')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTimeAgo(tunnel.lastActiveAt)}</div>
            <p className="text-xs text-muted-foreground">{formatDate(tunnel.lastActiveAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Details Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Tunnel Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('tunnelDetail.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tunnelDetail.localUrl')}</span>
              <span className="font-mono">http://{tunnel.localHost}:{tunnel.localPort}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tunnelDetail.protocol')}</span>
              <Badge variant="outline">{tunnel.protocol}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tunnel.password')}</span>
              <Badge variant={tunnel.hasPassword ? 'default' : 'secondary'}>
                {tunnel.hasPassword ? t('common.active') : t('common.inactive')}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tunnel.inspect')}</span>
              <Badge variant={tunnel.inspect ? 'default' : 'secondary'}>
                {tunnel.inspect ? t('common.active') : t('common.inactive')}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tunnelDetail.expires')}</span>
              <span>
                {tunnel.expiresAt ? formatDate(tunnel.expiresAt) : t('tunnelDetail.never')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tunnel.inspect && (
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href={`/tunnels/${tunnel.id}/inspector`}>
                  <Search className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                  {t('tunnelDetail.actions.inspect')}
                </Link>
              </Button>
            )}
            <Button className="w-full justify-start" variant="outline" onClick={copyUrl}>
              <Copy className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
              {t('tunnelDetail.actions.copyUrl')}
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <a href={tunnel.publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                {t('tunnelDetail.actions.openUrl')}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
