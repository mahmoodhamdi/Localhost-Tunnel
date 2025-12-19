/**
 * Paddle Payment Service (EU - Merchant of Record)
 * Handles all Paddle-related operations including VAT handling
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { paddleConfig, getPaddleBaseUrl, isPaddleConfigured } from './config';
import {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  SubscriptionInfo,
  SubscriptionTier,
  SubscriptionStatus,
} from '../types';

interface PaddleCheckoutResponse {
  data: {
    id: string;
    url: string;
  };
}

interface PaddleSubscription {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'paused' | 'trialing';
  custom_data?: { userId?: string; tier?: string };
  current_billing_period?: {
    starts_at: string;
    ends_at: string;
  };
  scheduled_change?: {
    action: 'cancel' | 'pause';
    effective_at: string;
  };
  trial_dates?: {
    ends_at: string;
  };
}

interface PaddleWebhookEvent {
  event_type: string;
  event_id: string;
  occurred_at: string;
  data: PaddleSubscription & {
    customer_id?: string;
    transaction_id?: string;
    items?: Array<{ price: { id: string } }>;
  };
}

class PaddleService implements PaymentProvider {
  private static instance: PaddleService;
  public readonly name = 'paddle' as const;

  private constructor() {}

  static getInstance(): PaddleService {
    if (!PaddleService.instance) {
      PaddleService.instance = new PaddleService();
    }
    return PaddleService.instance;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${paddleConfig.apiKey}`,
    };
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    if (!isPaddleConfigured()) {
      throw new Error('Paddle is not configured');
    }

    // Get price ID for tier
    const priceId = this.getPriceId(params.tier, 'monthly');
    if (!priceId) {
      throw new Error(`No price configured for tier: ${params.tier}`);
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create checkout session via Paddle API
    const baseUrl = getPaddleBaseUrl();
    const response = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        items: [
          {
            price_id: priceId,
            quantity: 1,
          },
        ],
        customer_email: params.userEmail,
        custom_data: {
          userId: params.userId,
          tier: params.tier,
        },
        checkout: {
          url: params.successUrl,
        },
        collection_mode: 'automatic',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Paddle API error: ${error}`);
    }

    const data: PaddleCheckoutResponse = await response.json();

    return {
      url: data.data.url,
      sessionId: data.data.id,
      provider: 'paddle',
    };
  }

  /**
   * Get subscription info from Paddle
   */
  async getSubscription(externalId: string): Promise<SubscriptionInfo | null> {
    if (!isPaddleConfigured()) {
      throw new Error('Paddle is not configured');
    }

    try {
      const baseUrl = getPaddleBaseUrl();
      const response = await fetch(`${baseUrl}/subscriptions/${externalId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Paddle API error: ${response.statusText}`);
      }

      const { data: subscription }: { data: PaddleSubscription } = await response.json();
      const userId = subscription.custom_data?.userId;

      if (!userId) return null;

      return {
        id: subscription.id,
        userId,
        tier: this.mapPriceToTier(subscription.custom_data?.tier),
        status: this.mapPaddleStatus(subscription.status),
        provider: 'paddle',
        currentPeriodStart: subscription.current_billing_period
          ? new Date(subscription.current_billing_period.starts_at)
          : new Date(),
        currentPeriodEnd: subscription.current_billing_period
          ? new Date(subscription.current_billing_period.ends_at)
          : new Date(),
        cancelAtPeriodEnd: subscription.scheduled_change?.action === 'cancel',
        trialEnd: subscription.trial_dates?.ends_at
          ? new Date(subscription.trial_dates.ends_at)
          : null,
      };
    } catch (error) {
      console.error('Failed to get Paddle subscription:', error);
      return null;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(externalId: string, immediately: boolean = false): Promise<void> {
    if (!isPaddleConfigured()) {
      throw new Error('Paddle is not configured');
    }

    const baseUrl = getPaddleBaseUrl();
    const endpoint = immediately
      ? `${baseUrl}/subscriptions/${externalId}/cancel`
      : `${baseUrl}/subscriptions/${externalId}`;

    const response = await fetch(endpoint, {
      method: immediately ? 'POST' : 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(
        immediately
          ? { effective_from: 'immediately' }
          : { scheduled_change: { action: 'cancel' } }
      ),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to cancel Paddle subscription: ${error}`);
    }
  }

  /**
   * Resume a subscription (remove scheduled cancellation)
   */
  async resumeSubscription(externalId: string): Promise<void> {
    if (!isPaddleConfigured()) {
      throw new Error('Paddle is not configured');
    }

    const baseUrl = getPaddleBaseUrl();
    const response = await fetch(`${baseUrl}/subscriptions/${externalId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({
        scheduled_change: null,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to resume Paddle subscription: ${error}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    try {
      // Paddle uses a signature in the format: ts=<timestamp>;h1=<hash>
      const parts = signature.split(';');
      const timestamp = parts.find(p => p.startsWith('ts='))?.split('=')[1];
      const hash = parts.find(p => p.startsWith('h1='))?.split('=')[1];

      if (!timestamp || !hash) return false;

      const signedPayload = `${timestamp}:${rawBody}`;
      const expectedHash = crypto
        .createHmac('sha256', paddleConfig.webhookSecret)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(expectedHash)
      );
    } catch {
      return false;
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(event: PaddleWebhookEvent): Promise<void> {
    // Store webhook event
    await prisma.webhookEvent.upsert({
      where: {
        provider_externalId: {
          provider: 'paddle',
          externalId: event.event_id,
        },
      },
      create: {
        provider: 'paddle',
        eventType: event.event_type,
        externalId: event.event_id,
        payload: JSON.stringify(event),
        status: 'pending',
      },
      update: {},
    });

    try {
      switch (event.event_type) {
        case 'subscription.created':
        case 'subscription.activated':
          await this.handleSubscriptionCreated(event.data);
          break;

        case 'subscription.updated':
          await this.handleSubscriptionUpdated(event.data);
          break;

        case 'subscription.canceled':
          await this.handleSubscriptionCanceled(event.data);
          break;

        case 'subscription.paused':
          await this.handleSubscriptionPaused(event.data);
          break;

        case 'transaction.completed':
          await this.handleTransactionCompleted(event.data);
          break;

        case 'transaction.payment_failed':
          await this.handlePaymentFailed(event.data);
          break;

        default:
          console.log(`Unhandled Paddle event type: ${event.event_type}`);
      }

      // Mark as processed
      await prisma.webhookEvent.update({
        where: {
          provider_externalId: {
            provider: 'paddle',
            externalId: event.event_id,
          },
        },
        data: {
          status: 'processed',
          processedAt: new Date(),
        },
      });
    } catch (error) {
      // Mark as failed
      await prisma.webhookEvent.update({
        where: {
          provider_externalId: {
            provider: 'paddle',
            externalId: event.event_id,
          },
        },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          retryCount: { increment: 1 },
        },
      });

      throw error;
    }
  }

  private async handleSubscriptionCreated(data: PaddleSubscription): Promise<void> {
    const userId = data.custom_data?.userId;
    if (!userId) {
      console.warn('Paddle subscription created without userId');
      return;
    }

    const tier = this.mapPriceToTier(data.custom_data?.tier);

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        provider: 'paddle',
        externalId: data.id,
        tier,
        status: this.mapPaddleStatus(data.status),
        currentPeriodStart: data.current_billing_period
          ? new Date(data.current_billing_period.starts_at)
          : new Date(),
        currentPeriodEnd: data.current_billing_period
          ? new Date(data.current_billing_period.ends_at)
          : new Date(),
        trialEnd: data.trial_dates?.ends_at
          ? new Date(data.trial_dates.ends_at)
          : null,
      },
      update: {
        externalId: data.id,
        tier,
        status: this.mapPaddleStatus(data.status),
        currentPeriodStart: data.current_billing_period
          ? new Date(data.current_billing_period.starts_at)
          : undefined,
        currentPeriodEnd: data.current_billing_period
          ? new Date(data.current_billing_period.ends_at)
          : undefined,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });

    console.log(`Paddle subscription ${data.id} created for user ${userId}`);
  }

  private async handleSubscriptionUpdated(data: PaddleSubscription): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: { externalId: data.id },
    });

    if (!subscription) {
      console.warn(`No subscription found for Paddle subscription ${data.id}`);
      return;
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: this.mapPaddleStatus(data.status),
        currentPeriodStart: data.current_billing_period
          ? new Date(data.current_billing_period.starts_at)
          : undefined,
        currentPeriodEnd: data.current_billing_period
          ? new Date(data.current_billing_period.ends_at)
          : undefined,
        cancelAtPeriodEnd: data.scheduled_change?.action === 'cancel',
      },
    });

    console.log(`Paddle subscription ${data.id} updated`);
  }

  private async handleSubscriptionCanceled(data: PaddleSubscription): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: { externalId: data.id },
    });

    if (!subscription) {
      console.warn(`No subscription found for Paddle subscription ${data.id}`);
      return;
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'canceled',
        tier: 'free',
        canceledAt: new Date(),
      },
    });

    console.log(`Paddle subscription ${data.id} canceled`);
  }

  private async handleSubscriptionPaused(data: PaddleSubscription): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: { externalId: data.id },
    });

    if (!subscription) return;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'paused' },
    });

    console.log(`Paddle subscription ${data.id} paused`);
  }

  private async handleTransactionCompleted(data: PaddleWebhookEvent['data']): Promise<void> {
    const customerId = data.customer_id;
    if (!customerId) return;

    // Find subscription by customer
    const subscription = await prisma.subscription.findFirst({
      where: { externalCustomerId: customerId },
    });

    if (!subscription) return;

    // Create payment record
    await prisma.payment.create({
      data: {
        userId: subscription.userId,
        amount: 0, // Paddle handles pricing, we'd need to parse from transaction
        currency: 'USD',
        status: 'completed',
        provider: 'paddle',
        externalId: data.transaction_id || data.id,
        paymentMethod: 'card',
        description: 'Subscription payment',
      },
    });

    console.log(`Paddle transaction completed for subscription ${subscription.id}`);
  }

  private async handlePaymentFailed(data: PaddleWebhookEvent['data']): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: { externalId: data.id },
    });

    if (!subscription) return;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'past_due' },
    });

    console.log(`Paddle payment failed for subscription ${data.id}`);
  }

  /**
   * Get price ID for tier and billing period
   */
  private getPriceId(tier: SubscriptionTier, period: 'monthly' | 'yearly'): string | null {
    if (tier === 'free') return null;

    const tierPrices = paddleConfig.prices[tier as keyof typeof paddleConfig.prices];
    if (!tierPrices) return null;

    return tierPrices[period] || null;
  }

  /**
   * Map price to tier
   */
  private mapPriceToTier(tier?: string): SubscriptionTier {
    if (!tier) return 'free';
    if (['starter', 'pro', 'enterprise'].includes(tier)) {
      return tier as SubscriptionTier;
    }
    return 'starter';
  }

  /**
   * Map Paddle status to our status
   */
  private mapPaddleStatus(status: PaddleSubscription['status']): SubscriptionStatus {
    const statusMap: Record<PaddleSubscription['status'], SubscriptionStatus> = {
      active: 'active',
      past_due: 'past_due',
      canceled: 'canceled',
      paused: 'paused',
      trialing: 'trialing',
    };

    return statusMap[status] || 'active';
  }
}

export const paddleService = PaddleService.getInstance();
