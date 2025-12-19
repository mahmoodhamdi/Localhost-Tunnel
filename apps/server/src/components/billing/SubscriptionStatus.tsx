'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Loader2, CreditCard, Calendar, AlertTriangle } from 'lucide-react';
import { Subscription } from '@prisma/client';

interface SubscriptionStatusProps {
  subscription: Subscription | null;
}

export function SubscriptionStatus({ subscription }: SubscriptionStatusProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const tier = subscription?.tier || 'free';
  const status = subscription?.status || 'active';
  const isFree = tier === 'free';

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payments/stripe/portal', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success && data.data.url) {
        window.location.href = data.data.url;
      } else {
        console.error('Failed to create portal session:', data.error);
        alert('Failed to open billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const response = await fetch('/api/payments/subscription', {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        router.refresh();
      } else {
        console.error('Failed to cancel subscription:', data.error);
        alert('Failed to cancel subscription. Please try again.');
      }
    } catch (error) {
      console.error('Cancel error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payments/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      const data = await response.json();

      if (data.success) {
        router.refresh();
      } else {
        console.error('Failed to resume subscription:', data.error);
        alert('Failed to resume subscription. Please try again.');
      }
    } catch (error) {
      console.error('Resume error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500">Trial</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Canceled</Badge>;
      case 'paused':
        return <Badge variant="outline">Paused</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Current Subscription
              {getStatusBadge()}
            </CardTitle>
            <CardDescription>
              {isFree
                ? 'You are on the free plan'
                : `You are subscribed to the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Subscription details */}
        {!isFree && subscription && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Provider:</span>
              <span className="font-medium">
                {subscription.provider?.charAt(0).toUpperCase()}
                {subscription.provider?.slice(1) || 'N/A'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {subscription.cancelAtPeriodEnd ? 'Ends on:' : 'Renews on:'}
              </span>
              <span className="font-medium">
                {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
          </div>
        )}

        {/* Warning for canceled subscriptions */}
        {subscription?.cancelAtPeriodEnd && (
          <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-4 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Subscription ending soon</p>
              <p className="text-sm">
                Your subscription will end on{' '}
                {formatDate(subscription.currentPeriodEnd)}. You will be
                downgraded to the free plan after this date.
              </p>
            </div>
          </div>
        )}

        {/* Warning for past due */}
        {status === 'past_due' && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Payment failed</p>
              <p className="text-sm">
                Your last payment failed. Please update your payment method to
                continue your subscription.
              </p>
            </div>
          </div>
        )}

        {/* Trial info */}
        {status === 'trialing' && subscription?.trialEnd && (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-4 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
            <Calendar className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Trial Period</p>
              <p className="text-sm">
                Your trial ends on {formatDate(subscription.trialEnd)}. You will
                be charged after the trial period.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!isFree && subscription?.provider === 'stripe' && (
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Manage Billing
            </Button>
          )}

          {subscription?.cancelAtPeriodEnd && (
            <Button
              variant="default"
              onClick={handleResumeSubscription}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resume Subscription
            </Button>
          )}

          {!isFree && !subscription?.cancelAtPeriodEnd && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={cancelLoading}>
                  Cancel Subscription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your subscription will remain active until{' '}
                    {formatDate(subscription?.currentPeriodEnd)}. After that,
                    you will be downgraded to the free plan and lose access to
                    premium features.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelSubscription}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Yes, Cancel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
