'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Loader2 } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  provider: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function InvoiceHistory() {
  const t = useTranslations('billing');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/billing/invoices?page=${page}&limit=10`);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.data.invoices);
        setPagination(data.data.pagination);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices(1);
  }, [fetchInvoices]);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">{t('invoices.statusPaid')}</Badge>;
      case 'open':
        return <Badge variant="outline">{t('invoices.statusOpen')}</Badge>;
      case 'draft':
        return <Badge variant="secondary">{t('invoices.statusDraft')}</Badge>;
      case 'void':
        return <Badge variant="secondary">{t('invoices.statusVoid')}</Badge>;
      case 'uncollectible':
        return <Badge variant="destructive">{t('invoices.statusUncollectible')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('invoices.title')}
        </CardTitle>
        <CardDescription>{t('invoices.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">{t('invoices.noInvoices')}</p>
            <p className="text-sm text-muted-foreground">{t('invoices.noInvoicesDesc')}</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoices.number')}</TableHead>
                  <TableHead>{t('invoices.date')}</TableHead>
                  <TableHead>{t('invoices.amount')}</TableHead>
                  <TableHead>{t('invoices.status')}</TableHead>
                  <TableHead>{t('invoices.download')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium font-mono text-sm">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                    <TableCell>
                      {formatAmount(invoice.total, invoice.currency)}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {invoice.pdfUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={invoice.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={t('invoices.downloadPdf')}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {invoice.hostedInvoiceUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={t('invoices.viewOnline')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  {t('invoices.showing', {
                    from: (pagination.page - 1) * pagination.limit + 1,
                    to: Math.min(pagination.page * pagination.limit, pagination.total),
                    total: pagination.total,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchInvoices(pagination.page - 1)}
                    disabled={pagination.page <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchInvoices(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
