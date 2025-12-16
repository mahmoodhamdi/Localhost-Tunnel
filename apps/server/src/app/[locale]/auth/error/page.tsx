'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';

function AuthErrorContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'Configuration':
        return 'There is a problem with the server configuration.';
      case 'AccessDenied':
        return 'Access denied. You do not have permission to sign in.';
      case 'Verification':
        return 'The verification link has expired or has already been used.';
      case 'OAuthSignin':
      case 'OAuthCallback':
      case 'OAuthCreateAccount':
      case 'OAuthAccountNotLinked':
        return 'There was a problem with the OAuth provider. Please try again.';
      case 'CredentialsSignin':
        return t('auth.errors.invalidCredentials');
      default:
        return t('auth.errors.generic');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <CardTitle className="text-2xl">Authentication Error</CardTitle>
        <CardDescription>
          {getErrorMessage(error)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button asChild className="w-full">
          <Link href="/auth/login">
            {t('auth.login')}
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">
            {t('nav.home')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function LoadingFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        <CardTitle className="text-2xl">Loading...</CardTitle>
      </CardHeader>
    </Card>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <Suspense fallback={<LoadingFallback />}>
        <AuthErrorContent />
      </Suspense>
    </div>
  );
}
