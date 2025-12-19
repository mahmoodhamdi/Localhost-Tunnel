/**
 * Stripe Webhook Handlers
 * Process Stripe webhook events
 */

import Stripe from 'stripe';
import { prisma } from '@/lib/db/prisma';
import { SubscriptionStatus, SubscriptionTier } from '../types';
import { stripeConfig } from './config';

/**
 * Handle Stripe webhook event
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  // Store webhook event in database
  await prisma.webhookEvent.upsert({
    where: {
      provider_externalId: {
        provider: 'stripe',
        externalId: event.id,
      },
    },
    create: {
      provider: 'stripe',
      eventType: event.type,
      externalId: event.id,
      payload: JSON.stringify(event),
      status: 'pending',
    },
    update: {
      // Don't update if already exists (idempotency)
    },
  });

  try {
    // Process event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      default:
        // Log unhandled events for debugging
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    // Mark webhook as processed
    await prisma.webhookEvent.update({
      where: {
        provider_externalId: {
          provider: 'stripe',
          externalId: event.id,
        },
      },
      data: {
        status: 'processed',
        processedAt: new Date(),
      },
    });
  } catch (error) {
    // Mark webhook as failed
    await prisma.webhookEvent.update({
      where: {
        provider_externalId: {
          provider: 'stripe',
          externalId: event.id,
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

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.warn('Checkout completed without userId in metadata');
    return;
  }

  const tier = (session.metadata?.tier as SubscriptionTier) || 'starter';
  const subscriptionId = session.subscription as string | undefined;
  const customerId = session.customer as string | undefined;

  if (!subscriptionId || !customerId) {
    console.warn('Checkout completed without subscription or customer ID');
    return;
  }

  // Update or create subscription
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      provider: 'stripe',
      externalId: subscriptionId,
      externalCustomerId: customerId,
      tier,
      status: 'active',
      currentPeriodStart: new Date(),
    },
    update: {
      provider: 'stripe',
      externalId: subscriptionId,
      externalCustomerId: customerId,
      tier,
      status: 'active',
      currentPeriodStart: new Date(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });

  console.log(`Subscription created for user ${userId}, tier: ${tier}`);
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.warn('Subscription created without userId in metadata');
    return;
  }

  const tier = mapPriceToTier(subscription.items.data[0]?.price?.id);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      provider: 'stripe',
      externalId: subscription.id,
      externalCustomerId: subscription.customer as string,
      tier,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
    update: {
      externalId: subscription.id,
      externalCustomerId: subscription.customer as string,
      tier,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
  });
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  // Find subscription by external ID
  const existingSubscription = await prisma.subscription.findFirst({
    where: { externalId: subscription.id },
  });

  if (!existingSubscription) {
    // Try to find by customer ID
    const subByCustomer = await prisma.subscription.findFirst({
      where: { externalCustomerId: subscription.customer as string },
    });

    if (!subByCustomer) {
      console.warn(`No subscription found for Stripe subscription ${subscription.id}`);
      return;
    }
  }

  const tier = mapPriceToTier(subscription.items.data[0]?.price?.id);

  await prisma.subscription.update({
    where: { id: existingSubscription?.id || undefined },
    data: {
      tier,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    },
  });

  console.log(`Subscription ${subscription.id} updated to tier: ${tier}, status: ${subscription.status}`);
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const existingSubscription = await prisma.subscription.findFirst({
    where: { externalId: subscription.id },
  });

  if (!existingSubscription) {
    console.warn(`No subscription found for deleted Stripe subscription ${subscription.id}`);
    return;
  }

  // Downgrade to free tier
  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      tier: 'free',
      status: 'canceled',
      canceledAt: new Date(),
    },
  });

  console.log(`Subscription ${subscription.id} deleted, user downgraded to free tier`);
}

/**
 * Handle invoice paid
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  // Find subscription by customer ID
  const subscription = await prisma.subscription.findFirst({
    where: { externalCustomerId: customerId },
  });

  if (!subscription) {
    console.warn(`No subscription found for customer ${customerId}`);
    return;
  }

  // Create payment record
  await prisma.payment.create({
    data: {
      userId: subscription.userId,
      amount: invoice.amount_paid,
      currency: invoice.currency.toUpperCase(),
      status: 'completed',
      provider: 'stripe',
      externalId: invoice.id,
      paymentMethod: 'card',
      invoiceId: invoice.id,
      receiptUrl: invoice.hosted_invoice_url || undefined,
      description: invoice.description || 'Subscription payment',
    },
  });

  // Ensure subscription is active
  if (subscription.status !== 'active') {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'active' },
    });
  }

  console.log(`Invoice ${invoice.id} paid for user ${subscription.userId}`);
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  const subscription = await prisma.subscription.findFirst({
    where: { externalCustomerId: customerId },
  });

  if (!subscription) {
    console.warn(`No subscription found for customer ${customerId}`);
    return;
  }

  // Create failed payment record
  await prisma.payment.create({
    data: {
      userId: subscription.userId,
      amount: invoice.amount_due,
      currency: invoice.currency.toUpperCase(),
      status: 'failed',
      provider: 'stripe',
      externalId: invoice.id,
      paymentMethod: 'card',
      description: 'Payment failed',
    },
  });

  // Update subscription status to past_due
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'past_due' },
  });

  console.log(`Invoice ${invoice.id} payment failed for user ${subscription.userId}`);

  // TODO: Send email notification to user about failed payment
}

/**
 * Handle trial ending soon
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
  const existingSubscription = await prisma.subscription.findFirst({
    where: { externalId: subscription.id },
  });

  if (!existingSubscription) {
    return;
  }

  console.log(`Trial ending soon for user ${existingSubscription.userId}`);

  // TODO: Send email notification about trial ending
}

/**
 * Map Stripe subscription status to our status
 */
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: 'active',
    canceled: 'canceled',
    incomplete: 'active',
    incomplete_expired: 'canceled',
    past_due: 'past_due',
    paused: 'paused',
    trialing: 'trialing',
    unpaid: 'past_due',
  };

  return statusMap[status] || 'active';
}

/**
 * Map Stripe price ID to subscription tier
 */
function mapPriceToTier(priceId?: string): SubscriptionTier {
  if (!priceId) return 'free';

  const { prices } = stripeConfig;

  for (const [tier, tierPrices] of Object.entries(prices)) {
    if (tierPrices.monthly === priceId || tierPrices.yearly === priceId) {
      return tier as SubscriptionTier;
    }
  }

  return 'starter';
}
