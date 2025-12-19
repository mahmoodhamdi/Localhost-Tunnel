'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  name: string;
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  price: {
    monthly: number;
    yearly: number;
  };
  description: string;
  features: string[];
  highlighted?: boolean;
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Free',
    tier: 'free',
    price: { monthly: 0, yearly: 0 },
    description: 'Get started with basic tunneling',
    features: [
      '1 active tunnel',
      'Random subdomain',
      '1 hour timeout',
      '1,000 requests/day',
      '1GB bandwidth',
    ],
  },
  {
    name: 'Starter',
    tier: 'starter',
    price: { monthly: 9, yearly: 90 },
    description: 'For developers who need more',
    features: [
      '3 active tunnels',
      'Custom subdomains',
      'No timeout',
      '10,000 requests/day',
      '10GB bandwidth',
      'TCP tunnels',
      '2 team members',
    ],
    highlighted: true,
  },
  {
    name: 'Pro',
    tier: 'pro',
    price: { monthly: 29, yearly: 290 },
    description: 'For teams and power users',
    features: [
      '10 active tunnels',
      'Custom subdomains',
      'Custom domains',
      'No timeout',
      '100,000 requests/day',
      '100GB bandwidth',
      'TCP tunnels',
      '10 team members',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    tier: 'enterprise',
    price: { monthly: 99, yearly: 990 },
    description: 'For large organizations',
    features: [
      'Unlimited tunnels',
      'Custom subdomains',
      'Custom domains',
      'No timeout',
      'Unlimited requests',
      'Unlimited bandwidth',
      'TCP tunnels',
      'Unlimited team members',
      'Priority support',
      'SLA guarantee',
      'Dedicated support',
    ],
  },
];

interface PricingTableProps {
  currentTier: string;
}

export function PricingTable({ currentTier }: PricingTableProps) {
  const router = useRouter();
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
    if (tier === currentTier) return 'Current Plan';
    if (tier === 'free') return 'Free';
    if (currentTier !== 'free' && tier !== 'free') {
      const currentIndex = PRICING_TIERS.findIndex(t => t.tier === currentTier);
      const targetIndex = PRICING_TIERS.findIndex(t => t.tier === tier);
      return targetIndex > currentIndex ? 'Upgrade' : 'Downgrade';
    }
    return 'Subscribe';
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
            Monthly
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
            Yearly
            <Badge variant="secondary" className="ml-2">
              Save 17%
            </Badge>
          </button>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {PRICING_TIERS.map((tier) => (
          <Card
            key={tier.tier}
            className={cn(
              'relative flex flex-col',
              tier.highlighted && 'border-primary shadow-lg'
            )}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge>Most Popular</Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {tier.name}
                {currentTier === tier.tier && (
                  <Badge variant="outline">Current</Badge>
                )}
              </CardTitle>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="mb-4">
                <span className="text-4xl font-bold">
                  ${billingPeriod === 'monthly' ? tier.price.monthly : Math.round(tier.price.yearly / 12)}
                </span>
                <span className="text-muted-foreground">/month</span>
                {billingPeriod === 'yearly' && tier.price.yearly > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Billed ${tier.price.yearly}/year
                  </p>
                )}
              </div>

              <ul className="space-y-2">
                {tier.features.map((feature) => (
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
                variant={tier.highlighted ? 'default' : 'outline'}
                disabled={tier.tier === currentTier || loadingTier !== null}
                onClick={() => handleSubscribe(tier.tier)}
              >
                {loadingTier === tier.tier && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {getButtonText(tier.tier)}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
