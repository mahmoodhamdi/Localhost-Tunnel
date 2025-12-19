/**
 * Paymob Payment Service (Egypt)
 * Handles all Paymob-related operations
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { paymobConfig, isPaymobConfigured } from './config';
import {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  SubscriptionInfo,
  SubscriptionTier,
} from '../types';
import { TIER_PRICING } from '../constants';

interface PaymobAuthResponse {
  token: string;
}

interface PaymobOrderResponse {
  id: number;
}

interface PaymobPaymentKeyResponse {
  token: string;
}

class PaymobService implements PaymentProvider {
  private static instance: PaymobService;
  public readonly name = 'paymob' as const;

  private constructor() {}

  static getInstance(): PaymobService {
    if (!PaymobService.instance) {
      PaymobService.instance = new PaymobService();
    }
    return PaymobService.instance;
  }

  private async getAuthToken(): Promise<string> {
    const response = await fetch(`${paymobConfig.baseUrl}/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: paymobConfig.apiKey }),
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate with Paymob');
    }

    const data: PaymobAuthResponse = await response.json();
    return data.token;
  }

  private async createOrder(
    authToken: string,
    amount: number,
    currency: string,
    merchantOrderId: string
  ): Promise<number> {
    const response = await fetch(`${paymobConfig.baseUrl}/ecommerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        auth_token: authToken,
        delivery_needed: false,
        amount_cents: amount,
        currency,
        merchant_order_id: merchantOrderId,
        items: [],
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create Paymob order');
    }

    const data: PaymobOrderResponse = await response.json();
    return data.id;
  }

  private async getPaymentKey(
    authToken: string,
    orderId: number,
    amount: number,
    currency: string,
    integrationId: number,
    billingData: {
      email: string;
      first_name: string;
      last_name: string;
      phone_number: string;
    }
  ): Promise<string> {
    const response = await fetch(`${paymobConfig.baseUrl}/acceptance/payment_keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        auth_token: authToken,
        amount_cents: amount,
        expiration: 3600, // 1 hour
        order_id: orderId,
        billing_data: {
          apartment: 'NA',
          email: billingData.email,
          floor: 'NA',
          first_name: billingData.first_name,
          street: 'NA',
          building: 'NA',
          phone_number: billingData.phone_number,
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'NA',
          country: 'EG',
          last_name: billingData.last_name,
          state: 'NA',
        },
        currency,
        integration_id: integrationId,
        lock_order_when_paid: true,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get Paymob payment key');
    }

    const data: PaymobPaymentKeyResponse = await response.json();
    return data.token;
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    if (!isPaymobConfigured()) {
      throw new Error('Paymob is not configured');
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

    // Convert to EGP (using fixed rate for simplicity, should use live rates in production)
    const usdToEgpRate = 30.9; // Approximate rate
    const amountInEgp = Math.round(pricing.monthly * usdToEgpRate);

    // Create unique order ID
    const merchantOrderId = `${params.userId}-${params.tier}-${Date.now()}`;

    // Get auth token
    const authToken = await this.getAuthToken();

    // Create order
    const orderId = await this.createOrder(
      authToken,
      amountInEgp,
      'EGP',
      merchantOrderId
    );

    // Get payment key
    const paymentKey = await this.getPaymentKey(
      authToken,
      orderId,
      amountInEgp,
      'EGP',
      paymobConfig.integrationIds.card,
      {
        email: params.userEmail,
        first_name: user.name?.split(' ')[0] || 'Customer',
        last_name: user.name?.split(' ').slice(1).join(' ') || 'User',
        phone_number: 'NA',
      }
    );

    // Build iframe URL
    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${paymobConfig.iframe.card}?payment_token=${paymentKey}`;

    // Store pending order in metadata
    await prisma.webhookEvent.create({
      data: {
        provider: 'paymob',
        eventType: 'order.created',
        externalId: String(orderId),
        payload: JSON.stringify({
          orderId,
          merchantOrderId,
          userId: params.userId,
          tier: params.tier,
          amount: amountInEgp,
          currency: 'EGP',
        }),
        status: 'pending',
      },
    });

    return {
      url: iframeUrl,
      sessionId: String(orderId),
      provider: 'paymob',
    };
  }

  /**
   * Get subscription info (Paymob doesn't have built-in subscriptions)
   * We manage subscriptions locally
   */
  async getSubscription(externalId: string): Promise<SubscriptionInfo | null> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        provider: 'paymob',
        externalId,
      },
    });

    if (!subscription) return null;

    return {
      id: subscription.id,
      userId: subscription.userId,
      tier: subscription.tier as SubscriptionTier,
      status: subscription.status as SubscriptionInfo['status'],
      provider: 'paymob',
      currentPeriodStart: subscription.currentPeriodStart || new Date(),
      currentPeriodEnd: subscription.currentPeriodEnd || new Date(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd,
    };
  }

  /**
   * Cancel subscription
   * Since Paymob doesn't have built-in subscriptions, we just mark locally
   */
  async cancelSubscription(externalId: string, immediately: boolean = false): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        provider: 'paymob',
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
   * Verify webhook signature using HMAC
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const calculatedHmac = crypto
      .createHmac('sha512', paymobConfig.hmacSecret)
      .update(payload)
      .digest('hex');

    return calculatedHmac === signature;
  }

  /**
   * Process webhook callback
   */
  async processCallback(data: {
    obj: {
      id: number;
      success: boolean;
      is_auth: boolean;
      is_capture: boolean;
      is_voided: boolean;
      is_refunded: boolean;
      order: { id: number; merchant_order_id: string };
      amount_cents: number;
      currency: string;
    };
  }): Promise<void> {
    const { obj } = data;

    // Find the pending order
    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: {
        provider: 'paymob',
        externalId: String(obj.order.id),
      },
    });

    if (!webhookEvent) {
      console.warn(`No pending order found for Paymob order ${obj.order.id}`);
      return;
    }

    const orderData = JSON.parse(webhookEvent.payload);

    if (obj.success && obj.is_capture) {
      // Payment successful - create/update subscription
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month subscription

      await prisma.subscription.upsert({
        where: { userId: orderData.userId },
        create: {
          userId: orderData.userId,
          provider: 'paymob',
          externalId: String(obj.id),
          tier: orderData.tier,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
        update: {
          provider: 'paymob',
          externalId: String(obj.id),
          tier: orderData.tier,
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
          userId: orderData.userId,
          amount: obj.amount_cents,
          currency: obj.currency,
          status: 'completed',
          provider: 'paymob',
          externalId: String(obj.id),
          paymentMethod: 'card',
          description: `${orderData.tier} subscription payment`,
        },
      });

      // Update webhook event
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'processed',
          processedAt: new Date(),
        },
      });

      console.log(`Paymob payment ${obj.id} successful for user ${orderData.userId}`);
    } else {
      // Payment failed
      await prisma.payment.create({
        data: {
          userId: orderData.userId,
          amount: obj.amount_cents,
          currency: obj.currency,
          status: 'failed',
          provider: 'paymob',
          externalId: String(obj.id),
          paymentMethod: 'card',
          description: 'Payment failed',
        },
      });

      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'failed',
          error: 'Payment was not successful',
        },
      });

      console.log(`Paymob payment ${obj.id} failed for user ${orderData.userId}`);
    }
  }
}

export const paymobService = PaymobService.getInstance();
