'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MoreHorizontal,
  Trash2,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Globe,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminTunnel {
  id: string;
  subdomain: string;
  localPort: number;
  protocol: string;
  isActive: boolean;
  totalRequests: number;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      Inactive
    </span>
  );
}

export default function AdminTunnelsPage() {
  const t = useTranslations('admin');

  const [tunnels, setTunnels] = useState<AdminTunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const fetchTunnels = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), pageSize: '20' });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/tunnels?${params}`);
      const data = await res.json();

      if (data.success) {
        setTunnels(data.data.tunnels || data.data);
        if (data.data.meta) setMeta(data.data.meta);
      }
    } catch {
      toast.error('Failed to load tunnels');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchTunnels();
  }, [fetchTunnels]);

  const handleForceClose = async (tunnelId: string) => {
    setClosingId(tunnelId);
    try {
      const res = await fetch(`/api/admin/tunnels/${tunnelId}/close`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTunnels((prev) =>
          prev.map((tunnel) =>
            tunnel.id === tunnelId ? { ...tunnel, isActive: false } : tunnel
          )
        );
        toast.success('Tunnel closed successfully');
      } else {
        toast.error(data.error?.message || 'Failed to close tunnel');
      }
    } catch {
      toast.error('Failed to close tunnel');
    } finally {
      setClosingId(null);
    }
  };

  const handleDelete = async (tunnelId: string) => {
    setDeletingId(tunnelId);
    try {
      const res = await fetch(`/api/admin/tunnels/${tunnelId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setTunnels((prev) => prev.filter((t) => t.id !== tunnelId));
        toast.success('Tunnel deleted successfully');
      } else {
        toast.error(data.error?.message || 'Failed to delete tunnel');
      }
    } catch {
      toast.error('Failed to delete tunnel');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">{t('tunnels.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {meta.total} total tunnels
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val as typeof statusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tunnels.all')}</SelectItem>
            <SelectItem value="active">{t('tunnels.active')}</SelectItem>
            <SelectItem value="inactive">{t('tunnels.inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : tunnels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Globe className="h-10 w-10 mb-3" aria-hidden="true" />
              <p className="text-sm">{t('tunnels.noTunnels')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tunnels.subdomain')}</TableHead>
                  <TableHead>{t('tunnels.port')}</TableHead>
                  <TableHead>{t('tunnels.protocol')}</TableHead>
                  <TableHead>{t('tunnels.status')}</TableHead>
                  <TableHead>{t('tunnels.owner')}</TableHead>
                  <TableHead>{t('tunnels.requests')}</TableHead>
                  <TableHead>{t('tunnels.created')}</TableHead>
                  <TableHead className="text-right">{t('tunnels.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tunnels.map((tunnel) => (
                  <TableRow key={tunnel.id}>
                    <TableCell className="font-mono font-medium">
                      {tunnel.subdomain}
                    </TableCell>
                    <TableCell>{tunnel.localPort}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs uppercase">
                        {tunnel.protocol}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge isActive={tunnel.isActive} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {tunnel.user?.email || 'Unknown'}
                    </TableCell>
                    <TableCell>{tunnel.totalRequests.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(tunnel.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Tunnel actions"
                            disabled={deletingId === tunnel.id || closingId === tunnel.id}
                          >
                            {deletingId === tunnel.id || closingId === tunnel.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {tunnel.isActive && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-orange-600 focus:text-orange-600"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  {t('tunnels.forceClose')}
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('tunnels.forceClose')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will forcefully close the tunnel connection. The owner will be disconnected.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleForceClose(tunnel.id)}>
                                    Force Close
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('tunnels.delete')}
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('tunnels.delete')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this tunnel? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(tunnel.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} ({meta.total} tunnels)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
