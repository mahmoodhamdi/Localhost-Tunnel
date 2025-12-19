import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import { PricingTable, SubscriptionStatus, PaymentHistory } from '@/components/billing';

export default async function BillingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/login');
  }

  const t = await getTranslations('billing');

  // Get user's subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  // Get payment history
  const payments = await prisma.payment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {/* Current Subscription */}
      <SubscriptionStatus subscription={subscription} />

      {/* Pricing Table */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('plans')}
        </h2>
        <PricingTable currentTier={subscription?.tier || 'free'} />
      </div>

      {/* Payment History */}
      <PaymentHistory payments={payments} />
    </div>
  );
}
