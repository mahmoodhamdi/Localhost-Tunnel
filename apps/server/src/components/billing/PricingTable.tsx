'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingTier {
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  price: {
    monthly: number;
    yearly: number;
  };
  highlighted?: boolean;
}

const PRICING_TIERS: PricingTier[] = [
  {
    tier: 'free',
    price: { monthly: 0, yearly: 0 },
  },
  {
    tier: 'starter',
    price: { monthly: 9, yearly: 90 },
    highlighted: true,
  },
  {
    tier: 'pro',
    price: { monthly: 29, yearly: 290 },
  },
  {
    tier: 'enterprise',
    price: { monthly: 99, yearly: 990 },
  },
];

interface PricingTableProps {
  currentTier: string;
}

export function PricingTable({ currentTier }: PricingTableProps) {
  const t = useTranslations('billing');
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleSubscribe = async (tier: string) => {
    if (tier === 'free' || tier === currentTier) return;

    setLoadingTier(tier);

    try {
      const response = await fetch('/api/payments/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, period: billingPeriod }),
      });

      const data = await response.json();

      if (data.success && data.data.url) {
        window.location.href = data.data.url;
      } else {
        console.error('Failed to create checkout session:', data.error);
        alert('Failed to start checkout. Please try again.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

  const getButtonText = (tier: string) => {
    if (tier === currentTier) return t('currentTier');
    if (tier === 'free') return t('features.tunnels', { count: 1 }).startsWith('1') ? t('subscribe') : t('subscribe');
    if (currentTier !== 'free' && tier !== 'free') {
      const currentIndex = PRICING_TIERS.findIndex(t => t.tier === currentTier);
      const targetIndex = PRICING_TIERS.findIndex(t => t.tier === tier);
      return targetIndex > currentIndex ? t('upgrade') : t('downgrade');
    }
    return t('subscribe');
  };

  // Tier name translation keys map to billing.pricing.{tier}Name
  const getTierName = (tier: string) => {
    switch (tier) {
      case 'free': return t('pricing.freeName');
      case 'starter': return t('pricing.starterName');
      case 'pro': return t('pricing.proName');
      case 'enterprise': return t('pricing.enterpriseName');
      default: return tier;
    }
  };

  const getTierDescription = (tier: string) => {
    switch (tier) {
      case 'free': return t('pricing.freeDesc');
      case 'starter': return t('pricing.starterDesc');
      case 'pro': return t('pricing.proDesc');
      case 'enterprise': return t('pricing.enterpriseDesc');
      default: return '';
    }
  };

  const getTierFeatures = (tier: string): string[] => {
    switch (tier) {
      case 'free':
        return [
          t('features.tunnels', { count: 1 }),
          t('pricing.randomSubdomain'),
          t('features.timeout', { hours: 1 }),
          t('features.requests', { count: '1,000' }),
          t('features.bandwidth', { amount: '1GB' }),
        ];
      case 'starter':
        return [
          t('features.tunnels', { count: 3 }),
          t('features.customSubdomain'),
          t('features.noTimeout'),
          t('features.requests', { count: '10,000' }),
          t('features.bandwidth', { amount: '10GB' }),
          t('features.tcpTunnels'),
          t('features.teamMembers', { count: 2 }),
        ];
      case 'pro':
        return [
          t('features.tunnels', { count: 10 }),
          t('features.customSubdomain'),
          t('features.customDomain'),
          t('features.noTimeout'),
          t('features.requests', { count: '100,000' }),
          t('features.bandwidth', { amount: '100GB' }),
          t('features.tcpTunnels'),
          t('features.teamMembers', { count: 10 }),
          t('features.prioritySupport'),
        ];
      case 'enterprise':
        return [
          t('features.tunnelsUnlimited'),
          t('features.customSubdomain'),
          t('features.customDomain'),
          t('features.noTimeout'),
          t('features.requestsUnlimited'),
          t('features.bandwidthUnlimited'),
          t('features.tcpTunnels'),
          t('features.teamMembersUnlimited'),
          t('features.prioritySupport'),
          t('features.sla'),
          t('features.dedicatedSupport'),
        ];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Billing period toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-lg bg-muted p-1">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              billingPeriod === 'monthly'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('monthly')}
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              billingPeriod === 'yearly'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('yearly')}
            <Badge variant="secondary" className="ml-2">
              {t('pricing.savePercent')}
            </Badge>
          </button>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {PRICING_TIERS.map((tierData) => (
          <Card
            key={tierData.tier}
            className={cn(
              'relative flex flex-col',
              tierData.highlighted && 'border-primary shadow-lg'
            )}
          >
            {tierData.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge>{t('mostPopular')}</Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {getTierName(tierData.tier)}
                {currentTier === tierData.tier && (
                  <Badge variant="outline">{t('currentTier')}</Badge>
                )}
              </CardTitle>
              <CardDescription>{getTierDescription(tierData.tier)}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="mb-4">
                <span className="text-4xl font-bold">
                  ${billingPeriod === 'monthly' ? tierData.price.monthly : Math.round(tierData.price.yearly / 12)}
                </span>
                <span className="text-muted-foreground">{t('perMonth')}</span>
                {billingPeriod === 'yearly' && tierData.price.yearly > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('pricing.billedAmount', { amount: tierData.price.yearly })}
                  </p>
                )}
              </div>

              <ul className="space-y-2">
                {getTierFeatures(tierData.tier).map((feature) => (
                  <li key={feature} className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                variant={tierData.highlighted ? 'default' : 'outline'}
                disabled={tierData.tier === currentTier || loadingTier !== null}
                onClick={() => handleSubscribe(tierData.tier)}
              >
                {loadingTier === tierData.tier && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {getButtonText(tierData.tier)}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
