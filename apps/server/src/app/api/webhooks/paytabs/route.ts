/**
 * PayTabs Webhook Handler
 * POST /api/webhooks/paytabs - Handle PayTabs callback
 */

import { NextResponse } from 'next/server';
import { paytabsService } from '@/lib/payments/paytabs';
import { isPaytabsConfigured } from '@/lib/payments/paytabs/config';

export async function POST(request: Request) {
  if (!isPaytabsConfigured()) {
    return NextResponse.json(
      { error: 'PayTabs is not configured' },
      { status: 503 }
    );
  }

  try {
    const data = await request.json();
    const signature = request.headers.get('signature') || '';

    // Verify signature if provided
    if (signature) {
      const isValid = paytabsService.verifyWebhookSignature(
        JSON.stringify(data),
        signature
      );

      if (!isValid) {
        console.error('PayTabs webhook: Invalid signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 400 }
        );
      }
    }

    console.log(`PayTabs webhook received: ${data.tran_ref || 'unknown'}`);

    // Process the callback
    await paytabsService.processCallback(data);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`PayTabs webhook error: ${message}`);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
