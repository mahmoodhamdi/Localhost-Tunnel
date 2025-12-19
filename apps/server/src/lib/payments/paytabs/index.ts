/**
 * PayTabs Payment Service (MENA Region)
 * Handles all PayTabs-related operations
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { paytabsConfig, getPaytabsBaseUrl, isPaytabsConfigured } from './config';
import {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  SubscriptionInfo,
  SubscriptionTier,
} from '../types';
import { TIER_PRICING } from '../constants';

interface PaytabsPaymentResponse {
  tran_ref: string;
  redirect_url: string;
  trace?: string;
}

interface PaytabsCallbackData {
  tran_ref: string;
  tran_type: string;
  cart_id: string;
  cart_amount: number;
  cart_currency: string;
  customer_details: {
    name: string;
    email: string;
    phone: string;
  };
  payment_result: {
    response_status: string;
    response_code: string;
    response_message: string;
    transaction_time: string;
  };
  payment_info: {
    payment_method: string;
    card_type: string;
    card_scheme: string;
  };
}

class PaytabsService implements PaymentProvider {
  private static instance: PaytabsService;
  public readonly name = 'paytabs' as const;

  private constructor() {}

  static getInstance(): PaytabsService {
    if (!PaytabsService.instance) {
      PaytabsService.instance = new PaytabsService();
    }
    return PaytabsService.instance;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: paytabsConfig.serverKey,
    };
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    if (!isPaytabsConfigured()) {
      throw new Error('PayTabs is not configured');
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get pricing
    const pricing = TIER_PRICING[params.tier as keyof typeof TIER_PRICING];
    if (!pricing) {
      throw new Error(`No pricing configured for tier: ${params.tier}`);
    }

    // Create unique cart ID
    const cartId = `${params.userId}-${params.tier}-${Date.now()}`;

    // Create payment page
    const baseUrl = getPaytabsBaseUrl();
    const response = await fetch(`${baseUrl}/payment/request`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        profile_id: paytabsConfig.profileId,
        tran_type: 'sale',
        tran_class: 'ecom',
        cart_id: cartId,
        cart_description: `${params.tier} Subscription`,
        cart_currency: 'USD',
        cart_amount: pricing.monthly / 100, // Convert cents to dollars
        callback: `${params.successUrl.split('/billing')[0]}/api/webhooks/paytabs`,
        return: params.successUrl,
        customer_details: {
          name: user.name || 'Customer',
          email: params.userEmail,
          phone: 'NA',
          street1: 'NA',
          city: 'NA',
          state: 'NA',
          country: 'SA', // Default to Saudi Arabia
          zip: '00000',
        },
        hide_shipping: true,
        framed: false,
        user_defined: {
          udf1: params.userId,
          udf2: params.tier,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PayTabs API error: ${error}`);
    }

    const data: PaytabsPaymentResponse = await response.json();

    if (!data.redirect_url) {
      throw new Error('PayTabs did not return a redirect URL');
    }

    // Store pending payment
    await prisma.webhookEvent.create({
      data: {
        provider: 'paytabs',
        eventType: 'payment.created',
        externalId: data.tran_ref,
        payload: JSON.stringify({
          tranRef: data.tran_ref,
          cartId,
          userId: params.userId,
          tier: params.tier,
          amount: pricing.monthly,
          currency: 'USD',
        }),
        status: 'pending',
      },
    });

    return {
      url: data.redirect_url,
      sessionId: data.tran_ref,
      provider: 'paytabs',
    };
  }

  /**
   * Get subscription info
   */
  async getSubscription(externalId: string): Promise<SubscriptionInfo | null> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        provider: 'paytabs',
        externalId,
      },
    });

    if (!subscription) return null;

    return {
      id: subscription.id,
      userId: subscription.userId,
      tier: subscription.tier as SubscriptionTier,
      status: subscription.status as SubscriptionInfo['status'],
      provider: 'paytabs',
      currentPeriodStart: subscription.currentPeriodStart || new Date(),
      currentPeriodEnd: subscription.currentPeriodEnd || new Date(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd,
    };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(externalId: string, immediately: boolean = false): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        provider: 'paytabs',
        externalId,
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
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
  }

  /**
   * Verify webhook/callback signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    const payloadStr = typeof payload === 'string' ? payload : payload.toString();
    const calculatedSignature = crypto
      .createHmac('sha256', paytabsConfig.serverKey)
      .update(payloadStr)
      .digest('hex');

    return calculatedSignature === signature;
  }

  /**
   * Query transaction status
   */
  async queryTransaction(tranRef: string): Promise<PaytabsCallbackData | null> {
    const baseUrl = getPaytabsBaseUrl();
    const response = await fetch(`${baseUrl}/payment/query`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        profile_id: paytabsConfig.profileId,
        tran_ref: tranRef,
      }),
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  /**
   * Process callback from PayTabs
   */
  async processCallback(data: PaytabsCallbackData): Promise<void> {
    const { tran_ref, payment_result, cart_amount, cart_currency } = data;

    // Find the pending payment
    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: {
        provider: 'paytabs',
        externalId: tran_ref,
      },
    });

    if (!webhookEvent) {
      console.warn(`No pending payment found for PayTabs transaction ${tran_ref}`);
      return;
    }

    const paymentData = JSON.parse(webhookEvent.payload);

    if (payment_result.response_status === 'A') {
      // Payment authorized/successful
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await prisma.subscription.upsert({
        where: { userId: paymentData.userId },
        create: {
          userId: paymentData.userId,
          provider: 'paytabs',
          externalId: tran_ref,
          tier: paymentData.tier,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
        update: {
          provider: 'paytabs',
          externalId: tran_ref,
          tier: paymentData.tier,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });

      // Create payment record
      await prisma.payment.create({
        data: {
          userId: paymentData.userId,
          amount: Math.round(cart_amount * 100), // Convert to cents
          currency: cart_currency,
          status: 'completed',
          provider: 'paytabs',
          externalId: tran_ref,
          paymentMethod: data.payment_info?.payment_method || 'card',
          description: `${paymentData.tier} subscription payment`,
        },
      });

      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'processed',
          processedAt: new Date(),
        },
      });

      console.log(`PayTabs payment ${tran_ref} successful for user ${paymentData.userId}`);
    } else {
      // Payment failed
      await prisma.payment.create({
        data: {
          userId: paymentData.userId,
          amount: Math.round(cart_amount * 100),
          currency: cart_currency,
          status: 'failed',
          provider: 'paytabs',
          externalId: tran_ref,
          paymentMethod: 'card',
          description: `Payment failed: ${payment_result.response_message}`,
        },
      });

      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'failed',
          error: payment_result.response_message,
        },
      });

      console.log(`PayTabs payment ${tran_ref} failed: ${payment_result.response_message}`);
    }
  }
}

export const paytabsService = PaytabsService.getInstance();
