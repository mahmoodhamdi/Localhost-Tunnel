'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  details: string | null;
  createdAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ACTION_TYPES = [
  'LOGIN',
  'LOGOUT',
  'REGISTER',
  'CREATE',
  'UPDATE',
  'DELETE',
  'INVITE',
  'JOIN',
  'LEAVE',
  'REVOKE',
  'TRANSFER',
];

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
    case 'INVITE':
    case 'JOIN':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'LOGOUT':
    case 'LEAVE':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'REVOKE':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminAuditPage() {
  const t = useTranslations('admin');

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  });

  const fetchAudit = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), pageSize: '25' });
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(`/api/admin/audit?${params}`);
      const data = await res.json();

      if (data.success) {
        setEntries(data.data.entries || data.data);
        if (data.data.meta) setMeta(data.data.meta);
      }
    } catch {
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">{t('audit.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {meta.total} total entries
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select
          value={actionFilter}
          onValueChange={(val) => {
            setActionFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by action">
            <SelectValue placeholder={t('audit.filterAction')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('audit.allActions')}</SelectItem>
            {ACTION_TYPES.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-40"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label="From date"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            className="w-40"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label="To date"
          />
        </div>

        {(actionFilter !== 'all' || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActionFilter('all');
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="h-10 w-10 mb-3" aria-hidden="true" />
              <p className="text-sm">{t('audit.noLogs')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('audit.timestamp')}</TableHead>
                  <TableHead>{t('audit.user')}</TableHead>
                  <TableHead>{t('audit.action')}</TableHead>
                  <TableHead>{t('audit.resource')}</TableHead>
                  <TableHead>{t('audit.ipAddress')}</TableHead>
                  <TableHead>{t('audit.details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.userEmail || (
                        <span className="text-muted-foreground italic">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getActionBadgeClass(entry.action)}`}
                      >
                        {entry.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground">{entry.resource}</span>
                      {entry.resourceId && (
                        <span className="font-mono text-xs ml-1 text-muted-foreground opacity-60">
                          {entry.resourceId.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {entry.ipAddress || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {entry.details ? (
                        <span title={entry.details}>{entry.details}</span>
                      ) : (
                        '-'
                      )}
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
            Page {meta.page} of {meta.totalPages} ({meta.total} entries)
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
