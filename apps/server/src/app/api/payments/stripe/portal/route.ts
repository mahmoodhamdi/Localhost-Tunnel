/**
 * Stripe Customer Portal API Route
 * POST /api/payments/stripe/portal - Create a customer portal session
 */

import { withAuth } from '@/lib/api/withAuth';
import { success, ApiException } from '@/lib/api/withApiHandler';
import { stripeService } from '@/lib/payments/stripe';
import { prisma } from '@/lib/db/prisma';

export const POST = withAuth(async (request, { user }) => {
  // Get user's subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  if (!subscription?.externalCustomerId) {
    throw ApiException.badRequest('No active subscription found. Please subscribe first.');
  }

  if (subscription.provider !== 'stripe') {
    throw ApiException.badRequest('Customer portal is only available for Stripe subscriptions.');
  }

  // Get base URL for return redirect
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  // Create portal session
  const result = await stripeService.createPortalSession(
    subscription.externalCustomerId,
    `${baseUrl}/en/billing`
  );

  return success({ url: result.url });
});
