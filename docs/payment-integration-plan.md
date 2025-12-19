# Payment & Subscription System - Implementation Plan

> **STATUS: ✅ COMPLETED** (December 2024)
>
> All payment providers have been implemented with 63 unit tests passing.

## Overview

This document outlines the complete implementation plan for integrating payment gateways into the Localhost-Tunnel service. The system supports multiple payment providers to serve different markets:

- **Stripe** - International payments (primary for US, CA, etc.)
- **Paymob** - Egyptian market (cards, wallets, kiosk)
- **PayTabs** - MENA region (Saudi, UAE, Egypt, Oman, Jordan)
- **Paddle** - EU Merchant of Record (handles VAT compliance)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Prisma with SQLite (dev) / PostgreSQL (prod)
- **Language**: TypeScript
- **Auth**: NextAuth v5
- **Testing**: Vitest (unit/integration), Playwright (E2E)

## Subscription Tiers

```typescript
enum SubscriptionTier {
  FREE = 'free',           // 1 tunnel, random subdomain, 1hr timeout
  STARTER = 'starter',     // 3 tunnels, custom subdomain, no timeout - $9/mo
  PRO = 'pro',             // 10 tunnels, custom domain, priority support - $29/mo
  ENTERPRISE = 'enterprise' // Unlimited, SLA, dedicated support - Custom pricing
}

const TIER_LIMITS = {
  free: {
    tunnels: 1,
    customSubdomain: false,
    customDomain: false,
    timeout: 3600,  // 1 hour
    requestsPerDay: 1000,
    bandwidth: '1GB'
  },
  starter: {
    tunnels: 3,
    customSubdomain: true,
    customDomain: false,
    timeout: null,  // No timeout
    requestsPerDay: 10000,
    bandwidth: '10GB'
  },
  pro: {
    tunnels: 10,
    customSubdomain: true,
    customDomain: true,
    timeout: null,
    requestsPerDay: 100000,
    bandwidth: '100GB'
  },
  enterprise: {
    tunnels: Infinity,
    customSubdomain: true,
    customDomain: true,
    timeout: null,
    requestsPerDay: Infinity,
    bandwidth: 'Unlimited'
  }
};
```

---

## Phase 0: Database Schema Design

### 0.1 New Prisma Models

Add the following models to `apps/server/prisma/schema.prisma`:

```prisma
// ==================== Subscription & Payment Models ====================

model Subscription {
  id                   String    @id @default(cuid())
  userId               String    @unique
  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Subscription details
  tier                 String    @default("free") // free, starter, pro, enterprise
  status               String    @default("active") // active, canceled, past_due, paused, trialing

  // Payment provider info
  provider             String?   // stripe, paymob, paytabs, paddle
  externalId           String?   // Subscription ID from provider
  externalCustomerId   String?   // Customer ID from provider

  // Billing period
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean   @default(false)
  canceledAt           DateTime?

  // Trial
  trialStart           DateTime?
  trialEnd             DateTime?

  // Metadata
  metadata             String?   // JSON string for additional data

  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@index([status])
  @@index([provider])
  @@index([externalId])
}

model Payment {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Payment details
  amount            Int       // Amount in smallest currency unit (cents)
  currency          String    @default("USD")
  status            String    // pending, completed, failed, refunded, disputed

  // Provider info
  provider          String    // stripe, paymob, paytabs, paddle
  externalId        String?   // Payment/Transaction ID from provider
  paymentMethod     String?   // card, wallet, kiosk, etc.

  // Card info (if applicable)
  cardBrand         String?   // visa, mastercard, etc.
  cardLast4         String?

  // Invoice/Receipt
  invoiceId         String?
  receiptUrl        String?

  // Refund info
  refundedAmount    Int?
  refundedAt        DateTime?
  refundReason      String?

  // Metadata
  description       String?
  metadata          String?   // JSON string

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([userId])
  @@index([status])
  @@index([provider])
  @@index([externalId])
  @@index([createdAt])
}

model PaymentMethod {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Provider info
  provider          String    // stripe, paymob, paytabs, paddle
  externalId        String    // Payment method ID from provider

  // Method details
  type              String    // card, wallet, bank_account

  // Card details (if type = card)
  cardBrand         String?   // visa, mastercard, amex, etc.
  cardLast4         String?
  cardExpMonth      Int?
  cardExpYear       Int?
  cardCountry       String?

  // Wallet details (if type = wallet)
  walletType        String?   // vodafone_cash, orange, etisalat, apple_pay, google_pay
  walletPhone       String?

  // Status
  isDefault         Boolean   @default(false)
  isActive          Boolean   @default(true)

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([provider, externalId])
  @@index([userId])
  @@index([provider])
}

model Invoice {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Invoice details
  invoiceNumber     String    @unique
  status            String    // draft, open, paid, void, uncollectible

  // Amounts
  subtotal          Int       // Before tax
  tax               Int       @default(0)
  total             Int       // After tax
  amountPaid        Int       @default(0)
  amountDue         Int
  currency          String    @default("USD")

  // Provider info
  provider          String?
  externalId        String?
  hostedInvoiceUrl  String?
  pdfUrl            String?

  // Dates
  dueDate           DateTime?
  paidAt            DateTime?

  // Line items stored as JSON
  lineItems         String?   // JSON array

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([userId])
  @@index([status])
  @@index([invoiceNumber])
}

model WebhookEvent {
  id                String    @id @default(cuid())
  provider          String    // stripe, paymob, paytabs, paddle
  eventType         String    // Event type from provider
  externalId        String    // Event ID from provider

  // Payload
  payload           String    // JSON string of full webhook payload

  // Processing status
  status            String    @default("pending") // pending, processed, failed
  processedAt       DateTime?
  error             String?
  retryCount        Int       @default(0)

  createdAt         DateTime  @default(now())

  @@unique([provider, externalId])
  @@index([provider])
  @@index([eventType])
  @@index([status])
  @@index([createdAt])
}
```

### 0.2 Update User Model

Add relations to the existing User model:

```prisma
model User {
  // ... existing fields ...

  // Payment relations
  subscription    Subscription?
  payments        Payment[]
  paymentMethods  PaymentMethod[]
  invoices        Invoice[]
}
```

### 0.3 Migration Commands

```bash
# Generate migration
cd apps/server && npx prisma migrate dev --name add_payment_models

# Generate Prisma client
npm run db:generate
```

---

## Phase 1: Stripe Integration

### Architecture

```
apps/server/
├── src/
│   ├── lib/
│   │   └── payments/
│   │       ├── index.ts              # Unified payment interface
│   │       ├── types.ts              # Shared types
│   │       ├── stripe/
│   │       │   ├── index.ts          # Stripe service class
│   │       │   ├── config.ts         # Stripe configuration
│   │       │   ├── webhooks.ts       # Webhook handlers
│   │       │   └── utils.ts          # Helper functions
│   │       └── constants.ts          # Price IDs, etc.
│   ├── app/
│   │   ├── api/
│   │   │   ├── payments/
│   │   │   │   ├── stripe/
│   │   │   │   │   ├── checkout/route.ts
│   │   │   │   │   ├── portal/route.ts
│   │   │   │   │   └── subscription/route.ts
│   │   │   │   └── subscription/route.ts    # Get current subscription
│   │   │   └── webhooks/
│   │   │       └── stripe/route.ts
│   │   └── [locale]/
│   │       └── billing/
│   │           ├── page.tsx          # Billing dashboard
│   │           ├── success/page.tsx  # Payment success
│   │           └── cancel/page.tsx   # Payment canceled
```

### 1.1 Stripe Service Class

```typescript
// apps/server/src/lib/payments/stripe/index.ts

import Stripe from 'stripe';
import { prisma } from '@/lib/db/prisma';

class StripeService {
  private static instance: StripeService;
  private stripe: Stripe;

  private constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-11-20.acacia',
      typescript: true,
    });
  }

  static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  // Create checkout session for subscription
  async createCheckoutSession(params: {
    userId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) throw new Error('User not found');

    // Get or create Stripe customer
    let customerId = await this.getOrCreateCustomer(params.userId, user.email);

    return this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { userId: params.userId },
    });
  }

  // Create customer portal session
  async createPortalSession(userId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.externalCustomerId) {
      throw new Error('No active subscription found');
    }

    return this.stripe.billingPortal.sessions.create({
      customer: subscription.externalCustomerId,
      return_url: returnUrl,
    });
  }

  // Get or create Stripe customer
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription?.externalCustomerId) {
      return subscription.externalCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email,
      metadata: { userId },
    });

    return customer.id;
  }

  // Handle webhook events
  constructEvent(payload: string, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  }

  // Get subscription
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
    if (immediately) {
      return this.stripe.subscriptions.cancel(subscriptionId);
    }
    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  // Resume subscription
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  // Create refund
  async createRefund(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
    });
  }
}

export const stripeService = StripeService.getInstance();
```

### 1.2 Webhook Handler

```typescript
// apps/server/src/lib/payments/stripe/webhooks.ts

import { Stripe } from 'stripe';
import { prisma } from '@/lib/db/prisma';

export async function handleStripeWebhook(event: Stripe.Event) {
  // Store webhook event
  await prisma.webhookEvent.upsert({
    where: { provider_externalId: { provider: 'stripe', externalId: event.id } },
    create: {
      provider: 'stripe',
      eventType: event.type,
      externalId: event.id,
      payload: JSON.stringify(event),
      status: 'pending',
    },
    update: {},
  });

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.created':
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
  }

  // Mark as processed
  await prisma.webhookEvent.update({
    where: { provider_externalId: { provider: 'stripe', externalId: event.id } },
    data: { status: 'processed', processedAt: new Date() },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  // Update subscription in database
  if (session.subscription) {
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        provider: 'stripe',
        externalId: session.subscription as string,
        externalCustomerId: session.customer as string,
        tier: mapPriceToTier(session.metadata?.priceId),
        status: 'active',
        currentPeriodStart: new Date(),
      },
      update: {
        provider: 'stripe',
        externalId: session.subscription as string,
        externalCustomerId: session.customer as string,
        tier: mapPriceToTier(session.metadata?.priceId),
        status: 'active',
      },
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find user by customer ID
  const existingSubscription = await prisma.subscription.findFirst({
    where: { externalCustomerId: customerId },
  });

  if (!existingSubscription) return;

  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existingSubscription = await prisma.subscription.findFirst({
    where: { externalId: subscription.id },
  });

  if (!existingSubscription) return;

  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status: 'canceled',
      tier: 'free',
      canceledAt: new Date(),
    },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const subscription = await prisma.subscription.findFirst({
    where: { externalCustomerId: customerId },
  });

  if (!subscription) return;

  // Create payment record
  await prisma.payment.create({
    data: {
      userId: subscription.userId,
      amount: invoice.amount_paid,
      currency: invoice.currency.toUpperCase(),
      status: 'completed',
      provider: 'stripe',
      externalId: invoice.id,
      invoiceId: invoice.id,
      receiptUrl: invoice.hosted_invoice_url || undefined,
    },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const subscription = await prisma.subscription.findFirst({
    where: { externalCustomerId: customerId },
  });

  if (!subscription) return;

  // Update subscription status
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'past_due' },
  });

  // Create failed payment record
  await prisma.payment.create({
    data: {
      userId: subscription.userId,
      amount: invoice.amount_due,
      currency: invoice.currency.toUpperCase(),
      status: 'failed',
      provider: 'stripe',
      externalId: invoice.id,
    },
  });
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    canceled: 'canceled',
    incomplete: 'pending',
    incomplete_expired: 'canceled',
    past_due: 'past_due',
    paused: 'paused',
    trialing: 'trialing',
    unpaid: 'past_due',
  };
  return statusMap[status] || 'active';
}

function mapPriceToTier(priceId?: string): string {
  if (!priceId) return 'starter';

  const priceMap: Record<string, string> = {
    [process.env.STRIPE_PRICE_STARTER!]: 'starter',
    [process.env.STRIPE_PRICE_PRO!]: 'pro',
    [process.env.STRIPE_PRICE_ENTERPRISE!]: 'enterprise',
  };
  return priceMap[priceId] || 'starter';
}
```

### 1.3 API Routes

```typescript
// apps/server/src/app/api/payments/stripe/checkout/route.ts

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { success, ApiException, parseBody } from '@/lib/api/withApiHandler';
import { stripeService } from '@/lib/payments/stripe';

export const POST = withAuth(async (request, { user }) => {
  const { priceId } = await parseBody<{ priceId: string }>(request, ['priceId']);

  const validPriceIds = [
    process.env.STRIPE_PRICE_STARTER,
    process.env.STRIPE_PRICE_PRO,
    process.env.STRIPE_PRICE_ENTERPRISE,
  ].filter(Boolean);

  if (!validPriceIds.includes(priceId)) {
    throw ApiException.badRequest('Invalid price ID');
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const session = await stripeService.createCheckoutSession({
    userId: user.id,
    priceId,
    successUrl: `${baseUrl}/en/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/en/billing/cancel`,
  });

  return success({ url: session.url });
});
```

```typescript
// apps/server/src/app/api/payments/stripe/portal/route.ts

import { withAuth } from '@/lib/api/withAuth';
import { success } from '@/lib/api/withApiHandler';
import { stripeService } from '@/lib/payments/stripe';

export const POST = withAuth(async (request, { user }) => {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const session = await stripeService.createPortalSession(
    user.id,
    `${baseUrl}/en/billing`
  );

  return success({ url: session.url });
});
```

```typescript
// apps/server/src/app/api/webhooks/stripe/route.ts

import { NextResponse } from 'next/server';
import { stripeService } from '@/lib/payments/stripe';
import { handleStripeWebhook } from '@/lib/payments/stripe/webhooks';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  try {
    const event = stripeService.constructEvent(body, signature);
    await handleStripeWebhook(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}
```

---

## Phase 2: Paymob Integration

### Architecture

```
apps/server/src/lib/payments/paymob/
├── index.ts          # Paymob service class
├── config.ts         # Configuration
├── webhooks.ts       # Webhook handlers
├── types.ts          # Paymob-specific types
└── utils.ts          # HMAC verification, etc.
```

### 2.1 Paymob Service Class

```typescript
// apps/server/src/lib/payments/paymob/index.ts

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

interface PaymobAuthResponse {
  token: string;
}

interface PaymobOrderResponse {
  id: number;
  amount_cents: number;
}

interface PaymobPaymentKeyResponse {
  token: string;
}

class PaymobService {
  private static instance: PaymobService;
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private readonly baseUrl = 'https://accept.paymob.com/api';
  private readonly apiKey = process.env.PAYMOB_API_KEY!;

  static getInstance(): PaymobService {
    if (!PaymobService.instance) {
      PaymobService.instance = new PaymobService();
    }
    return PaymobService.instance;
  }

  // Get authentication token
  async getAuthToken(): Promise<string> {
    if (this.authToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.authToken;
    }

    const response = await fetch(`${this.baseUrl}/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: this.apiKey }),
    });

    const data: PaymobAuthResponse = await response.json();
    this.authToken = data.token;
    this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000); // 55 minutes

    return this.authToken;
  }

  // Create order
  async createOrder(params: {
    amountCents: number;
    currency: string;
    items: Array<{ name: string; amount_cents: number; quantity: number }>;
  }): Promise<PaymobOrderResponse> {
    const token = await this.getAuthToken();

    const response = await fetch(`${this.baseUrl}/ecommerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: false,
        amount_cents: params.amountCents,
        currency: params.currency,
        items: params.items,
      }),
    });

    return response.json();
  }

  // Get payment key for card iframe
  async getPaymentKey(params: {
    orderId: number;
    amountCents: number;
    currency: string;
    billingData: {
      email: string;
      first_name: string;
      last_name: string;
      phone_number: string;
      city: string;
      country: string;
    };
    integrationId: number;
  }): Promise<string> {
    const token = await this.getAuthToken();

    const response = await fetch(`${this.baseUrl}/acceptance/payment_keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_token: token,
        order_id: params.orderId,
        amount_cents: params.amountCents,
        currency: params.currency,
        expiration: 3600,
        billing_data: {
          ...params.billingData,
          apartment: 'NA',
          floor: 'NA',
          street: 'NA',
          building: 'NA',
          shipping_method: 'NA',
          postal_code: 'NA',
          state: 'NA',
        },
        integration_id: params.integrationId,
      }),
    });

    const data: PaymobPaymentKeyResponse = await response.json();
    return data.token;
  }

  // Initiate mobile wallet payment
  async initiateWalletPayment(params: {
    paymentToken: string;
    phoneNumber: string;
  }): Promise<{ redirect_url: string }> {
    const response = await fetch(`${this.baseUrl}/acceptance/payments/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: {
          identifier: params.phoneNumber,
          subtype: 'WALLET',
        },
        payment_token: params.paymentToken,
      }),
    });

    return response.json();
  }

  // Get kiosk bill reference
  async getKioskReference(paymentToken: string): Promise<{ bill_reference: string }> {
    const response = await fetch(`${this.baseUrl}/acceptance/payments/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { identifier: 'AGGREGATOR', subtype: 'AGGREGATOR' },
        payment_token: paymentToken,
      }),
    });

    return response.json();
  }

  // Verify webhook HMAC
  verifyWebhookHmac(data: Record<string, unknown>, receivedHmac: string): boolean {
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET!;

    // Paymob HMAC calculation fields (in order)
    const hmacFields = [
      'amount_cents', 'created_at', 'currency', 'error_occured',
      'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
      'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
      'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan',
      'source_data.sub_type', 'source_data.type', 'success',
    ];

    const concatenated = hmacFields.map(field => {
      const keys = field.split('.');
      let value: unknown = data;
      for (const key of keys) {
        value = (value as Record<string, unknown>)?.[key];
      }
      return String(value ?? '');
    }).join('');

    const calculatedHmac = crypto
      .createHmac('sha512', hmacSecret)
      .update(concatenated)
      .digest('hex');

    return calculatedHmac === receivedHmac;
  }
}

export const paymobService = PaymobService.getInstance();
```

---

## Phase 3: PayTabs Integration

### 3.1 PayTabs Service Class

```typescript
// apps/server/src/lib/payments/paytabs/index.ts

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

interface PayTabsPaymentResponse {
  tran_ref: string;
  redirect_url: string;
}

class PayTabsService {
  private static instance: PayTabsService;

  private readonly profileId = process.env.PAYTABS_PROFILE_ID!;
  private readonly serverKey = process.env.PAYTABS_SERVER_KEY!;
  private readonly region = process.env.PAYTABS_REGION || 'SAU';

  private get baseUrl(): string {
    const regionUrls: Record<string, string> = {
      SAU: 'https://secure.paytabs.sa',
      EGY: 'https://secure-egypt.paytabs.com',
      ARE: 'https://secure.paytabs.com',
      OMN: 'https://secure-oman.paytabs.com',
      JOR: 'https://secure-jordan.paytabs.com',
    };
    return regionUrls[this.region] || regionUrls.SAU;
  }

  static getInstance(): PayTabsService {
    if (!PayTabsService.instance) {
      PayTabsService.instance = new PayTabsService();
    }
    return PayTabsService.instance;
  }

  // Create payment page
  async createPaymentPage(params: {
    userId: string;
    amount: number;
    currency: string;
    description: string;
    customerEmail: string;
    customerName: string;
    callbackUrl: string;
    returnUrl: string;
  }): Promise<PayTabsPaymentResponse> {
    const cartId = `cart_${params.userId}_${Date.now()}`;

    const response = await fetch(`${this.baseUrl}/payment/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.serverKey,
      },
      body: JSON.stringify({
        profile_id: this.profileId,
        tran_type: 'sale',
        tran_class: 'ecom',
        cart_id: cartId,
        cart_description: params.description,
        cart_currency: params.currency,
        cart_amount: params.amount,
        callback: params.callbackUrl,
        return: params.returnUrl,
        customer_details: {
          name: params.customerName,
          email: params.customerEmail,
        },
        user_defined: {
          userId: params.userId,
        },
      }),
    });

    return response.json();
  }

  // Create recurring payment
  async createRecurringPayment(params: {
    userId: string;
    amount: number;
    currency: string;
    tokenId: string;
    description: string;
  }): Promise<PayTabsPaymentResponse> {
    const response = await fetch(`${this.baseUrl}/payment/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.serverKey,
      },
      body: JSON.stringify({
        profile_id: this.profileId,
        tran_type: 'sale',
        tran_class: 'recurring',
        cart_id: `recurring_${params.userId}_${Date.now()}`,
        cart_description: params.description,
        cart_currency: params.currency,
        cart_amount: params.amount,
        token: params.tokenId,
        user_defined: { userId: params.userId },
      }),
    });

    return response.json();
  }

  // Verify callback signature
  verifyCallback(payload: Record<string, unknown>, signature: string): boolean {
    const calculatedSignature = crypto
      .createHmac('sha256', this.serverKey)
      .update(JSON.stringify(payload))
      .digest('hex');

    return calculatedSignature === signature;
  }

  // Query transaction
  async queryTransaction(tranRef: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/payment/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.serverKey,
      },
      body: JSON.stringify({
        profile_id: this.profileId,
        tran_ref: tranRef,
      }),
    });

    return response.json();
  }

  // Refund transaction
  async refundTransaction(params: {
    tranRef: string;
    amount: number;
    description: string;
  }): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/payment/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.serverKey,
      },
      body: JSON.stringify({
        profile_id: this.profileId,
        tran_type: 'refund',
        tran_class: 'ecom',
        cart_id: `refund_${Date.now()}`,
        cart_currency: 'SAR',
        cart_amount: params.amount,
        cart_description: params.description,
        tran_ref: params.tranRef,
      }),
    });

    return response.json();
  }
}

export const paytabsService = PayTabsService.getInstance();
```

---

## Phase 4: Paddle Integration

### 4.1 Paddle Service Class

```typescript
// apps/server/src/lib/payments/paddle/index.ts

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

interface PaddleSubscription {
  id: string;
  status: string;
  customer_id: string;
  current_billing_period: {
    starts_at: string;
    ends_at: string;
  };
}

class PaddleService {
  private static instance: PaddleService;

  private readonly apiKey = process.env.PADDLE_API_KEY!;
  private readonly vendorId = process.env.PADDLE_VENDOR_ID!;
  private readonly environment = process.env.PADDLE_ENVIRONMENT || 'sandbox';

  private get baseUrl(): string {
    return this.environment === 'production'
      ? 'https://api.paddle.com'
      : 'https://sandbox-api.paddle.com';
  }

  static getInstance(): PaddleService {
    if (!PaddleService.instance) {
      PaddleService.instance = new PaddleService();
    }
    return PaddleService.instance;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.detail || 'Paddle API error');
    }

    return data.data;
  }

  // Get subscription
  async getSubscription(subscriptionId: string): Promise<PaddleSubscription> {
    return this.request(`/subscriptions/${subscriptionId}`);
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string, effectiveFrom: 'immediately' | 'next_billing_period' = 'next_billing_period'): Promise<PaddleSubscription> {
    return this.request(`/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ effective_from: effectiveFrom }),
    });
  }

  // Pause subscription
  async pauseSubscription(subscriptionId: string): Promise<PaddleSubscription> {
    return this.request(`/subscriptions/${subscriptionId}/pause`, {
      method: 'POST',
    });
  }

  // Resume subscription
  async resumeSubscription(subscriptionId: string): Promise<PaddleSubscription> {
    return this.request(`/subscriptions/${subscriptionId}/resume`, {
      method: 'POST',
    });
  }

  // Update subscription (upgrade/downgrade)
  async updateSubscription(subscriptionId: string, priceId: string): Promise<PaddleSubscription> {
    return this.request(`/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        proration_billing_mode: 'prorated_immediately',
      }),
    });
  }

  // Verify webhook signature
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const publicKey = process.env.PADDLE_PUBLIC_KEY!;

    try {
      const [ts, h1] = signature.split(';').reduce((acc, part) => {
        const [key, value] = part.split('=');
        if (key === 'ts') acc[0] = value;
        if (key === 'h1') acc[1] = value;
        return acc;
      }, ['', '']);

      const signedPayload = `${ts}:${payload}`;
      const verifier = crypto.createVerify('sha256');
      verifier.update(signedPayload);

      return verifier.verify(publicKey, h1, 'base64');
    } catch {
      return false;
    }
  }

  // Get client-side token for checkout
  getClientToken(): { vendorId: string; environment: string } {
    return {
      vendorId: this.vendorId,
      environment: this.environment,
    };
  }
}

export const paddleService = PaddleService.getInstance();
```

---

## Phase 5: Unified Payment System

### 5.1 Payment Provider Interface

```typescript
// apps/server/src/lib/payments/types.ts

export interface CheckoutParams {
  userId: string;
  tier: 'starter' | 'pro' | 'enterprise';
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  url: string;
  sessionId?: string;
}

export interface SubscriptionInfo {
  id: string;
  userId: string;
  tier: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  provider: string;
}

export interface PaymentProvider {
  name: string;

  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  getSubscription(userId: string): Promise<SubscriptionInfo | null>;
  cancelSubscription(userId: string, immediately?: boolean): Promise<void>;
  resumeSubscription(userId: string): Promise<void>;
  createPortalSession?(userId: string, returnUrl: string): Promise<{ url: string }>;
}
```

### 5.2 Payment Gateway Factory

```typescript
// apps/server/src/lib/payments/index.ts

import { PaymentProvider, CheckoutParams, CheckoutResult, SubscriptionInfo } from './types';
import { stripeService } from './stripe';
import { paymobService } from './paymob';
import { paytabsService } from './paytabs';
import { paddleService } from './paddle';
import { prisma } from '@/lib/db/prisma';

type ProviderName = 'stripe' | 'paymob' | 'paytabs' | 'paddle';

// Region to provider mapping
const REGION_PROVIDER_MAP: Record<string, ProviderName> = {
  // Egypt
  EG: 'paymob',
  // MENA
  SA: 'paytabs',
  AE: 'paytabs',
  KW: 'paytabs',
  QA: 'paytabs',
  BH: 'paytabs',
  OM: 'paytabs',
  JO: 'paytabs',
  // EU countries requiring Paddle (for VAT handling)
  DE: 'paddle',
  FR: 'paddle',
  GB: 'paddle',
  IT: 'paddle',
  ES: 'paddle',
  NL: 'paddle',
  // Default to Stripe
  US: 'stripe',
  CA: 'stripe',
};

class PaymentGateway {
  private static instance: PaymentGateway;

  static getInstance(): PaymentGateway {
    if (!PaymentGateway.instance) {
      PaymentGateway.instance = new PaymentGateway();
    }
    return PaymentGateway.instance;
  }

  // Get appropriate provider based on country
  getProviderForCountry(countryCode: string): ProviderName {
    return REGION_PROVIDER_MAP[countryCode.toUpperCase()] || 'stripe';
  }

  // Get user's subscription
  async getSubscription(userId: string): Promise<SubscriptionInfo | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) return null;

    return {
      id: subscription.id,
      userId: subscription.userId,
      tier: subscription.tier,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      provider: subscription.provider || 'none',
    };
  }

  // Get tier limits
  getTierLimits(tier: string) {
    const limits = {
      free: {
        tunnels: 1,
        customSubdomain: false,
        customDomain: false,
        timeout: 3600,
        requestsPerDay: 1000,
      },
      starter: {
        tunnels: 3,
        customSubdomain: true,
        customDomain: false,
        timeout: null,
        requestsPerDay: 10000,
      },
      pro: {
        tunnels: 10,
        customSubdomain: true,
        customDomain: true,
        timeout: null,
        requestsPerDay: 100000,
      },
      enterprise: {
        tunnels: Infinity,
        customSubdomain: true,
        customDomain: true,
        timeout: null,
        requestsPerDay: Infinity,
      },
    };
    return limits[tier as keyof typeof limits] || limits.free;
  }

  // Check if user can create more tunnels
  async canCreateTunnel(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await this.getSubscription(userId);
    const tier = subscription?.tier || 'free';
    const limits = this.getTierLimits(tier);

    const tunnelCount = await prisma.tunnel.count({
      where: { userId, isActive: true },
    });

    if (tunnelCount >= limits.tunnels) {
      return {
        allowed: false,
        reason: `Your ${tier} plan allows ${limits.tunnels} tunnel(s). Upgrade to create more.`,
      };
    }

    return { allowed: true };
  }

  // Check if user can use custom subdomain
  async canUseCustomSubdomain(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    const tier = subscription?.tier || 'free';
    const limits = this.getTierLimits(tier);
    return limits.customSubdomain;
  }

  // Check if user can use custom domain
  async canUseCustomDomain(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    const tier = subscription?.tier || 'free';
    const limits = this.getTierLimits(tier);
    return limits.customDomain;
  }

  // Get tunnel timeout for user
  async getTunnelTimeout(userId: string): Promise<number | null> {
    const subscription = await this.getSubscription(userId);
    const tier = subscription?.tier || 'free';
    const limits = this.getTierLimits(tier);
    return limits.timeout;
  }
}

export const paymentGateway = PaymentGateway.getInstance();
```

### 5.3 Feature Gating Middleware

```typescript
// apps/server/src/lib/payments/middleware.ts

import { NextResponse } from 'next/server';
import { paymentGateway } from './index';
import { ApiException, error } from '@/lib/api/withApiHandler';

// Middleware to check tunnel creation limits
export async function checkTunnelLimit(userId: string) {
  const result = await paymentGateway.canCreateTunnel(userId);

  if (!result.allowed) {
    throw ApiException.forbidden(result.reason || 'Tunnel limit reached');
  }
}

// Middleware to check custom subdomain access
export async function checkCustomSubdomainAccess(userId: string) {
  const canUse = await paymentGateway.canUseCustomSubdomain(userId);

  if (!canUse) {
    throw ApiException.forbidden('Custom subdomains require a paid subscription');
  }
}

// Middleware to check custom domain access
export async function checkCustomDomainAccess(userId: string) {
  const canUse = await paymentGateway.canUseCustomDomain(userId);

  if (!canUse) {
    throw ApiException.forbidden('Custom domains require a Pro or Enterprise subscription');
  }
}
```

---

## Frontend Components

### Billing Page

```typescript
// apps/server/src/app/[locale]/billing/page.tsx

import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { PricingTable } from '@/components/billing/PricingTable';
import { SubscriptionStatus } from '@/components/billing/SubscriptionStatus';
import { PaymentHistory } from '@/components/billing/PaymentHistory';

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/login');

  const t = await getTranslations('billing');

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  const payments = await prisma.payment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">{t('title')}</h1>

      {/* Current Subscription */}
      <SubscriptionStatus subscription={subscription} />

      {/* Pricing Table */}
      <PricingTable currentTier={subscription?.tier || 'free'} />

      {/* Payment History */}
      <PaymentHistory payments={payments} />
    </div>
  );
}
```

---

## Environment Variables

Add to `.env` and `.env.example`:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# Paymob
PAYMOB_API_KEY=...
PAYMOB_INTEGRATION_ID_CARD=...
PAYMOB_INTEGRATION_ID_WALLET=...
PAYMOB_INTEGRATION_ID_KIOSK=...
PAYMOB_IFRAME_ID=...
PAYMOB_HMAC_SECRET=...

# PayTabs
PAYTABS_PROFILE_ID=...
PAYTABS_SERVER_KEY=...
PAYTABS_CLIENT_KEY=...
PAYTABS_REGION=SAU

# Paddle
PADDLE_VENDOR_ID=...
PADDLE_API_KEY=...
PADDLE_PUBLIC_KEY=...
PADDLE_ENVIRONMENT=sandbox
PADDLE_PRICE_STARTER=pri_...
PADDLE_PRICE_PRO=pri_...
PADDLE_PRICE_ENTERPRISE=pri_...
```

---

## Testing Strategy

### Unit Tests

```typescript
// apps/server/__tests__/unit/payments/stripe.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stripeService } from '@/lib/payments/stripe';

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com' }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com' }),
      },
    },
  })),
}));

describe('StripeService', () => {
  it('should create checkout session', async () => {
    const session = await stripeService.createCheckoutSession({
      userId: 'user_123',
      priceId: 'price_starter',
      successUrl: 'http://localhost:3000/success',
      cancelUrl: 'http://localhost:3000/cancel',
    });

    expect(session.url).toBe('https://checkout.stripe.com');
  });
});
```

### Integration Tests

```typescript
// apps/server/__tests__/integration/payments/checkout.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';

describe('Payment Checkout API', () => {
  let testUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: 'test-payment@example.com', password: 'hashed' },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it('should create checkout session for authenticated user', async () => {
    // Test implementation
  });

  it('should reject invalid price IDs', async () => {
    // Test implementation
  });
});
```

### E2E Tests

```typescript
// apps/server/__tests__/e2e/billing.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
  });

  test('should display pricing table', async ({ page }) => {
    await page.goto('/en/billing');
    await expect(page.getByText('Starter')).toBeVisible();
    await expect(page.getByText('Pro')).toBeVisible();
    await expect(page.getByText('Enterprise')).toBeVisible();
  });

  test('should redirect to Stripe checkout', async ({ page }) => {
    await page.goto('/en/billing');
    await page.click('[data-plan="starter"]');

    // Should redirect to Stripe
    await expect(page).toHaveURL(/checkout\.stripe\.com/);
  });
});
```

---

## Implementation Progress Tracking

Create `docs/implementation-progress.md` and update after each task:

```markdown
# Payment Implementation Progress

## Current: Phase 0, Task 0.1.1
## Coverage: 0%
## Last Updated: [timestamp]

### Phase 0: Database Schema
- [ ] 0.1.1 - Add payment models to schema
- [ ] 0.1.2 - Run migrations
- [ ] 0.1.3 - Create seed data
- [ ] 0.1.4 - Write tests

### Phase 1: Stripe Integration
- [ ] 1.1.1 - Install Stripe SDK
- [ ] 1.1.2 - Create Stripe service
- [ ] 1.1.3 - Implement webhooks
- [ ] 1.1.4 - Tests
...
```

---

## Critical Rules Summary

1. **Test Everything**: 100% coverage required before proceeding
2. **Use Prisma**: All database operations through Prisma
3. **Follow Patterns**: Use existing `withAuth`, `withApiHandler` patterns
4. **Secure Webhooks**: Always verify signatures
5. **Log Events**: Store all webhook events in `WebhookEvent` table
6. **Handle Errors**: Use `ApiException` for consistent error responses
7. **Update Translations**: Add i18n keys for all new UI text

---

## Next Steps

1. Start with Phase 0.1.1 - Add payment models to Prisma schema
2. Run `npx prisma migrate dev --name add_payment_models`
3. Generate Prisma client with `npm run db:generate`
4. Write and run tests for schema changes
5. Proceed to Phase 1 (Stripe Integration)
