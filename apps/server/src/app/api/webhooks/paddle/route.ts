/**
 * Paddle Webhook Handler
 * POST /api/webhooks/paddle - Handle Paddle webhook events
 */

import { NextResponse } from 'next/server';
import { paddleService } from '@/lib/payments/paddle';
import { isPaddleConfigured } from '@/lib/payments/paddle/config';

export async function POST(request: Request) {
  if (!isPaddleConfigured()) {
    return NextResponse.json(
      { error: 'Paddle is not configured' },
      { status: 503 }
    );
  }

  const signature = request.headers.get('paddle-signature') || '';
  const rawBody = await request.text();

  // Verify signature
  if (signature) {
    const isValid = paddleService.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.error('Paddle webhook: Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }
  }

  try {
    const event = JSON.parse(rawBody);
    console.log(`Paddle webhook received: ${event.event_type} (${event.event_id})`);

    // Process the webhook
    await paddleService.handleWebhook(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Paddle webhook error: ${message}`);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
