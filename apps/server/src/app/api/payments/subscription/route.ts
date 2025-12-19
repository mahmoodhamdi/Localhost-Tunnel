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

  // Cancel based on provider
  if (subscription.provider === 'stripe' && subscription.externalId) {
    await stripeService.cancelSubscription(subscription.externalId, immediately);
  }

  // Update local subscription
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

  // Resume based on provider
  if (subscription.provider === 'stripe' && subscription.externalId) {
    await stripeService.resumeSubscription(subscription.externalId);
  }

  // Update local subscription
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });

  return success({
    message: 'Subscription resumed successfully',
  });
});
