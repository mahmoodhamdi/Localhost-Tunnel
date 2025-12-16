'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Plus, Search, Wifi, WifiOff, Trash2, RefreshCw, Loader2, Activity, ExternalLink } from 'lucide-react';
import { useOptimisticList } from '@/hooks/useOptimistic';

interface Tunnel {
  id: string;
  subdomain: string;
  publicUrl?: string;
  localPort: number;
  localHost: string;
  protocol: string;
  isActive: boolean;
  hasPassword: boolean;
  totalRequests: number;
  totalBytes: number;
  createdAt: string;
  lastActiveAt: string;
}

export default function TunnelsPage() {
  const t = useTranslations();

  const {
    items: tunnels,
    setItems: setTunnels,
    isPending,
    pendingId,
    optimisticDelete,
  } = useOptimisticList<Tunnel>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTunnels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tunnels');
      const data = await response.json();

      if (data.success) {
        setTunnels(data.data);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to load tunnels');
      }
    } catch {
      setError('Failed to load tunnels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTunnels();
  }, []);

  const deleteTunnel = async (id: string) => {
    await optimisticDelete(
      id,
      async () => {
        const response = await fetch(`/api/tunnels/${id}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error?.message || t('tunnels.deleteFailed'));
        }
      },
      {
        errorMessage: t('tunnels.deleteFailed'),
      }
    );
  };

  const filteredTunnels = tunnels.filter(
    (tunnel) =>
      tunnel.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tunnel.localPort.toString().includes(searchQuery)
  );

  const formatDate = (dateString: string): string => {
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

  const stats = {
    total: tunnels.length,
    active: tunnels.filter((t) => t.isActive).length,
    totalRequests: tunnels.reduce((sum, t) => sum + t.totalRequests, 0),
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

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('tunnels.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('tunnels.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTunnels}>
            <RefreshCw className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t('common.refresh')}
          </Button>
          <Button asChild>
            <Link href="/tunnels/new">
              <Plus className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
              {t('tunnel.create.title')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('tunnels.stats.total')}</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('tunnels.stats.active')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('tunnels.stats.requests')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            placeholder={t('tunnels.searchPlaceholder')}
            className="pl-10 rtl:pl-4 rtl:pr-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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

      {/* Tunnels List */}
      {filteredTunnels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-xl mb-2">
              {searchQuery ? t('common.noData') : t('tunnels.noTunnels')}
            </CardTitle>
            <CardDescription className="text-center mb-6">
              {searchQuery
                ? t('tunnels.noTunnelsMatching', { query: searchQuery })
                : t('tunnels.noTunnelsDesc')}
            </CardDescription>
            {!searchQuery && (
              <Button asChild>
                <Link href="/tunnels/new">
                  <Plus className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                  {t('tunnels.createFirst')}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTunnels.map((tunnel) => (
            <Card key={tunnel.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0" aria-hidden="true">
                    {tunnel.isActive ? (
                      <Wifi className="h-6 w-6 text-green-500" />
                    ) : (
                      <WifiOff className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tunnel.subdomain}</span>
                      {tunnel.hasPassword && (
                        <Badge variant="outline" className="text-xs">
                          Protected
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tunnel.localHost}:{tunnel.localPort}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {tunnel.totalRequests.toLocaleString()} requests • Last active {formatDate(tunnel.lastActiveAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={tunnel.isActive ? 'default' : 'secondary'}>
                    {tunnel.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                  <Button variant="ghost" size="icon" asChild>
                    <a
                      href={`http://${tunnel.subdomain}.${process.env.NEXT_PUBLIC_TUNNEL_DOMAIN || 'localhost:3000'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('tunnelDetail.actions.openUrl')}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/tunnels/${tunnel.id}`}>{t('common.view')}</Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label={t('tunnelDetail.actions.delete')}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
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
                        <AlertDialogAction
                          onClick={() => deleteTunnel(tunnel.id)}
                          disabled={isPending && pendingId === tunnel.id}
                        >
                          {isPending && pendingId === tunnel.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2 rtl:ml-2 rtl:mr-0" />
                          ) : null}
                          {t('common.confirm')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
