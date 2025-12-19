/**
 * Stripe Checkout API Route
 * POST /api/payments/stripe/checkout - Create a checkout session
 */

import { withAuth } from '@/lib/api/withAuth';
import { success, ApiException, parseBody } from '@/lib/api/withApiHandler';
import { stripeService } from '@/lib/payments/stripe';
import { SubscriptionTier } from '@/lib/payments/types';

interface CheckoutRequest {
  tier: SubscriptionTier;
  period?: 'monthly' | 'yearly';
}

export const POST = withAuth(async (request, { user }) => {
  const { tier, period = 'monthly' } = await parseBody<CheckoutRequest>(request, ['tier']);

  // Validate tier
  const validTiers: SubscriptionTier[] = ['starter', 'pro', 'enterprise'];
  if (!validTiers.includes(tier)) {
    throw ApiException.badRequest(`Invalid tier: ${tier}. Valid tiers are: ${validTiers.join(', ')}`);
  }

  // Get base URL for redirects
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  // Create checkout session
  const result = await stripeService.createCheckoutSession({
    userId: user.id,
    userEmail: user.email,
    tier,
    successUrl: `${baseUrl}/en/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/en/billing?canceled=true`,
    metadata: { period },
  });

  return success({
    url: result.url,
    sessionId: result.sessionId,
  });
});
