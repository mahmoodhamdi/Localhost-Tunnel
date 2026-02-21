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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { CreditCard, Loader2, Trash2, Wallet } from 'lucide-react';

interface PaymentMethod {
  id: string;
  provider: string;
  type: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  cardCountry: string | null;
  walletType: string | null;
  walletPhone: string | null;
  isDefault: boolean;
  createdAt: string;
}

export function PaymentMethods() {
  const t = useTranslations('billing');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing/payment-methods');
      const data = await res.json();
      if (data.success) {
        setMethods(data.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const handleRemove = async (id: string) => {
    try {
      setRemovingId(id);
      const res = await fetch(`/api/billing/payment-methods?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setMethods((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      // silently fail
    } finally {
      setRemovingId(null);
    }
  };

  const formatExpiry = (month: number | null, year: number | null) => {
    if (!month || !year) return '';
    return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
  };

  const getBrandLabel = (brand: string | null) => {
    if (!brand) return 'Card';
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  const getMethodIcon = (type: string) => {
    if (type === 'wallet') return <Wallet className="h-5 w-5 text-muted-foreground" />;
    return <CreditCard className="h-5 w-5 text-muted-foreground" />;
  };

  const getMethodLabel = (method: PaymentMethod) => {
    if (method.type === 'card' && method.cardLast4) {
      return `${getBrandLabel(method.cardBrand)} ${t('paymentMethods.endingIn')} ${method.cardLast4}`;
    }
    if (method.type === 'wallet' && method.walletType) {
      return method.walletType.replace(/_/g, ' ');
    }
    return method.type;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t('paymentMethods.title')}
        </CardTitle>
        <CardDescription>{t('paymentMethods.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : methods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">{t('paymentMethods.noMethods')}</p>
            <p className="text-sm text-muted-foreground">{t('paymentMethods.noMethodsDesc')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {methods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  {getMethodIcon(method.type)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{getMethodLabel(method)}</span>
                      {method.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          {t('paymentMethods.default')}
                        </Badge>
                      )}
                    </div>
                    {method.type === 'card' && method.cardExpMonth && method.cardExpYear && (
                      <p className="text-xs text-muted-foreground">
                        {t('paymentMethods.expires')} {formatExpiry(method.cardExpMonth, method.cardExpYear)}
                      </p>
                    )}
                    {method.type === 'wallet' && method.walletPhone && (
                      <p className="text-xs text-muted-foreground">{method.walletPhone}</p>
                    )}
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={removingId === method.id}
                      aria-label={t('paymentMethods.remove')}
                    >
                      {removingId === method.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('paymentMethods.removeTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('paymentMethods.removeConfirm')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('paymentMethods.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRemove(method.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t('paymentMethods.remove')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
