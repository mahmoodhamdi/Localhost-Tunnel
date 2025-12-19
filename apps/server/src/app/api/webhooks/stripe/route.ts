/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe - Handle Stripe webhook events
 *
 * Note: This route must NOT use withApiHandler as it needs
 * raw body access for signature verification.
 */

import { NextResponse } from 'next/server';
import { stripeService } from '@/lib/payments/stripe';
import { handleStripeWebhook } from '@/lib/payments/stripe/webhooks';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('Stripe webhook: Missing signature');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  // Get raw body for signature verification
  const rawBody = await request.text();

  try {
    // Verify and construct event
    const event = stripeService.constructWebhookEvent(rawBody, signature);

    console.log(`Stripe webhook received: ${event.type} (${event.id})`);

    // Process the webhook
    await handleStripeWebhook(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Stripe webhook error: ${message}`);

    // Return 400 for signature verification failures
    // Return 500 for processing errors (Stripe will retry)
    const isVerificationError = message.includes('signature');
    const statusCode = isVerificationError ? 400 : 500;

    return NextResponse.json(
      { error: message },
      { status: statusCode }
    );
  }
}
