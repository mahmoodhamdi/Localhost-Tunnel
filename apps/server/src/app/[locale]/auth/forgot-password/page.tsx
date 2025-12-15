'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle, Loader2, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t('auth.errors.emailRequired'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // Always show success message to prevent email enumeration
      setIsSuccess(true);
    } catch {
      setError(t('auth.errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    setIsSuccess(false);
    setEmail('');
  };

  if (isSuccess) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl">{t('auth.forgotPasswordPage.success')}</CardTitle>
            <CardDescription>{t('auth.forgotPasswordPage.successDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleResend}>
              <Mail className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" aria-hidden="true" />
              {t('auth.forgotPasswordPage.resend')}
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link href="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 rtl:rotate-180" aria-hidden="true" />
                {t('auth.forgotPasswordPage.backToLogin')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('auth.forgotPasswordPage.title')}</CardTitle>
          <CardDescription>{t('auth.forgotPasswordPage.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-lg" role="alert">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" aria-hidden="true" />
                  {t('auth.forgotPasswordPage.sending')}
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" aria-hidden="true" />
                  {t('auth.forgotPasswordPage.sendLink')}
                </>
              )}
            </Button>
          </form>

          <div className="mt-6">
            <Button variant="ghost" className="w-full" asChild>
              <Link href="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 rtl:rotate-180" aria-hidden="true" />
                {t('auth.forgotPasswordPage.backToLogin')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
