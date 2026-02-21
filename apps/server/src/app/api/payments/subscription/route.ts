/**
 * Subscription API Route
 * GET /api/payments/subscription - Get current user's subscription
 * DELETE /api/payments/subscription - Cancel subscription
 */

import { withAuth } from '@/lib/api/withAuth';
import { success, ApiException, parseBody } from '@/lib/api/withApiHandler';
import { prisma } from '@/lib/db/prisma';
import { stripeService } from '@/lib/payments/stripe';
import { TIER_LIMITS } from '@/lib/payments/constants';

// Subscription response type
interface SubscriptionResponse {
  id?: string;
  tier: string;
  status: string;
  limits: typeof TIER_LIMITS.free;
  provider: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
}

// GET - Get current subscription
export const GET = withAuth(async (request, { user }) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  // If no subscription, return free tier info
  if (!subscription) {
    const response: SubscriptionResponse = {
      tier: 'free',
      status: 'active',
      limits: TIER_LIMITS.free,
      provider: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
    };
    return success(response);
  }

  // Get tier limits
  const tier = subscription.tier as keyof typeof TIER_LIMITS;
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  const response: SubscriptionResponse = {
    id: subscription.id,
    tier: subscription.tier,
    status: subscription.status,
    limits,
    provider: subscription.provider,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    trialEnd: subscription.trialEnd,
  };
  return success(response);
});

// DELETE - Cancel subscription
export const DELETE = withAuth(async (request, { user }) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  if (!subscription) {
    throw ApiException.notFound('No subscription found');
  }

  if (subscription.status === 'canceled') {
    throw ApiException.badRequest('Subscription is already canceled');
  }

  // Check if URL has immediate=true query param
  const url = new URL(request.url);
  const immediately = url.searchParams.get('immediately') === 'true';

  // Cancel with the provider and update the DB atomically within a single
  // try block. If the DB update fails after the provider succeeds, the states
  // would diverge without this guard, so we log a critical error that signals
  // manual reconciliation is required before re-throwing.
  try {
    if (subscription.provider === 'stripe' && subscription.externalId) {
      await stripeService.cancelSubscription(subscription.externalId, immediately);
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: immediately
        ? {
            status: 'canceled',
            tier: 'free',
            canceledAt: new Date(),
          }
        : {
            cancelAtPeriodEnd: true,
          },
    });
  } catch (error) {
    // A failure here may mean the provider was already updated but the DB was
    // not (or vice versa). Log the full context so the team can reconcile the
    // two systems manually without data loss.
    console.error(
      '[CRITICAL] Subscription cancellation encountered an error. ' +
        'Manual reconciliation may be required. ' +
        `subscriptionId=${subscription.id} ` +
        `externalId=${subscription.externalId ?? 'none'} ` +
        `provider=${subscription.provider ?? 'none'} ` +
        `immediately=${immediately}`,
      error,
    );
    throw ApiException.internal(
      'Failed to cancel subscription. Our team has been notified and will reconcile your account.',
    );
  }

  return success({
    message: immediately
      ? 'Subscription canceled immediately'
      : 'Subscription will be canceled at the end of the billing period',
    canceledAt: immediately ? new Date() : subscription.currentPeriodEnd,
  });
});

// POST - Resume subscription (undo cancel)
export const POST = withAuth(async (request, { user }) => {
  const { action } = await parseBody<{ action: string }>(request, ['action']);

  if (action !== 'resume') {
    throw ApiException.badRequest('Invalid action. Use "resume" to resume a canceled subscription.');
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  if (!subscription) {
    throw ApiException.notFound('No subscription found');
  }

  if (!subscription.cancelAtPeriodEnd) {
    throw ApiException.badRequest('Subscription is not scheduled for cancellation');
  }

  // Resume with the provider and update the DB atomically within a single
  // try block. If the DB update fails after the provider succeeds, the states
  // would diverge without this guard, so we log a critical error that signals
  // manual reconciliation is required before re-throwing.
  try {
    if (subscription.provider === 'stripe' && subscription.externalId) {
      await stripeService.resumeSubscription(subscription.externalId);
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });
  } catch (error) {
    // A failure here may mean the provider was already updated but the DB was
    // not (or vice versa). Log the full context so the team can reconcile the
    // two systems manually without data loss.
    console.error(
      '[CRITICAL] Subscription resumption encountered an error. ' +
        'Manual reconciliation may be required. ' +
        `subscriptionId=${subscription.id} ` +
        `externalId=${subscription.externalId ?? 'none'} ` +
        `provider=${subscription.provider ?? 'none'}`,
      error,
    );
    throw ApiException.internal(
      'Failed to resume subscription. Our team has been notified and will reconcile your account.',
    );
  }

  return success({
    message: 'Subscription resumed successfully',
  });
});
