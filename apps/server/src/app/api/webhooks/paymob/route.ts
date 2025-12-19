/**
 * Paymob Webhook Handler
 * POST /api/webhooks/paymob - Handle Paymob callback
 */

import { NextResponse } from 'next/server';
import { paymobService } from '@/lib/payments/paymob';
import { isPaymobConfigured } from '@/lib/payments/paymob/config';

export async function POST(request: Request) {
  if (!isPaymobConfigured()) {
    return NextResponse.json(
      { error: 'Paymob is not configured' },
      { status: 503 }
    );
  }

  try {
    const data = await request.json();
    const hmac = request.headers.get('hmac') || '';

    // Verify HMAC signature if provided
    if (hmac) {
      const isValid = paymobService.verifyWebhookSignature(
        JSON.stringify(data),
        hmac
      );

      if (!isValid) {
        console.error('Paymob webhook: Invalid HMAC signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 400 }
        );
      }
    }

    console.log(`Paymob webhook received: ${data.type || 'callback'}`);

    // Process the callback
    await paymobService.processCallback(data);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Paymob webhook error: ${message}`);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// GET endpoint for Paymob redirect callback
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const success = searchParams.get('success') === 'true';
  const orderId = searchParams.get('order');
  const transactionId = searchParams.get('id');

  // Redirect to billing page with result
  const redirectUrl = success
    ? `/billing/success?provider=paymob&order=${orderId}`
    : `/billing?error=payment_failed&provider=paymob`;

  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
