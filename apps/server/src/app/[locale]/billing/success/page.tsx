import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function BillingSuccessPage({ searchParams }: SuccessPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/login');
  }

  const t = await getTranslations('billing');
  const params = await searchParams;
  const sessionId = params.session_id;

  return (
    <div className="container mx-auto flex items-center justify-center py-16">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <CardTitle className="text-2xl">{t('success.title')}</CardTitle>
          <CardDescription>{t('success.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('success.message')}
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/en/dashboard">{t('success.dashboard')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/en/billing">{t('success.billing')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
