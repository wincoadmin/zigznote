/**
 * Billing Seeder
 * Creates billing plans, customers, subscriptions, invoices, and payments
 *
 * @ownership
 * @domain Billing
 * @description Seeds billing-related test data
 */

import type { PrismaClient, Organization } from '@prisma/client';
import { randomString } from './utils';

/**
 * Seed billing plans
 */
export async function seedBillingPlans(prisma: PrismaClient) {
  console.info('Seeding billing plans...');

  const plans = [
    {
      name: 'Free',
      slug: 'free',
      description: 'Get started with basic features',
      amount: 0,
      currency: 'usd',
      interval: 'month',
      trialDays: 0,
      features: JSON.stringify([
        '5 meetings per month',
        '30 minutes per meeting',
        'Basic transcription',
        'Email support',
      ]),
      limits: JSON.stringify({
        meetings_per_month: 5,
        minutes_per_meeting: 30,
        storage_gb: 1,
        team_members: 1,
      }),
      sortOrder: 1,
    },
    {
      name: 'Pro',
      slug: 'pro',
      description: 'Perfect for growing teams',
      amount: 2900,
      currency: 'usd',
      interval: 'month',
      trialDays: 14,
      features: JSON.stringify([
        'Unlimited meetings',
        '2 hours per meeting',
        'AI-powered summaries',
        'Action item extraction',
        'Priority support',
        'Team collaboration',
        'Calendar integrations',
      ]),
      limits: JSON.stringify({
        meetings_per_month: -1,
        minutes_per_meeting: 120,
        storage_gb: 50,
        team_members: 10,
      }),
      stripePriceId: 'price_pro_monthly',
      sortOrder: 2,
    },
    {
      name: 'Pro Yearly',
      slug: 'pro-yearly',
      description: 'Pro plan billed annually (2 months free)',
      amount: 29000,
      currency: 'usd',
      interval: 'year',
      trialDays: 14,
      features: JSON.stringify([
        'Unlimited meetings',
        '2 hours per meeting',
        'AI-powered summaries',
        'Action item extraction',
        'Priority support',
        'Team collaboration',
        'Calendar integrations',
      ]),
      limits: JSON.stringify({
        meetings_per_month: -1,
        minutes_per_meeting: 120,
        storage_gb: 50,
        team_members: 10,
      }),
      stripePriceId: 'price_pro_yearly',
      sortOrder: 3,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For large organizations',
      amount: 9900,
      currency: 'usd',
      interval: 'month',
      trialDays: 30,
      features: JSON.stringify([
        'Everything in Pro',
        'Unlimited meeting length',
        'SSO/SAML integration',
        'Custom vocabulary',
        'Advanced analytics',
        'Dedicated support',
        'API access',
        'Custom integrations',
        'SLA guarantee',
      ]),
      limits: JSON.stringify({
        meetings_per_month: -1,
        minutes_per_meeting: -1,
        storage_gb: 500,
        team_members: -1,
      }),
      stripePriceId: 'price_enterprise_monthly',
      sortOrder: 4,
    },
  ];

  const created = [];
  for (const plan of plans) {
    const existing = await prisma.billingPlan.findUnique({
      where: { slug: plan.slug },
    });

    if (existing) {
      created.push(existing);
    } else {
      const newPlan = await prisma.billingPlan.create({ data: plan });
      created.push(newPlan);
    }
  }

  console.info(`  ✓ Created ${created.length} billing plans`);
  return created;
}

/**
 * Seed billing customers for organizations
 */
export async function seedBillingCustomers(
  prisma: PrismaClient,
  organizations: Organization[]
) {
  console.info('Seeding billing customers...');

  const customers = [];

  for (const org of organizations) {
    const existing = await prisma.billingCustomer.findUnique({
      where: { organizationId: org.id },
    });

    if (existing) {
      customers.push(existing);
    } else {
      const customer = await prisma.billingCustomer.create({
        data: {
          organizationId: org.id,
          email: `billing@${org.name.toLowerCase().replace(/\s+/g, '')}.com`,
          name: org.name,
          stripeCustomerId: `cus_${randomString(14)}`,
          defaultProvider: 'stripe',
          metadata: {},
        },
      });
      customers.push(customer);
    }
  }

  console.info(`  ✓ Created ${customers.length} billing customers`);
  return customers;
}

/**
 * Seed subscriptions
 */
export async function seedSubscriptions(
  prisma: PrismaClient,
  customers: { id: string; organizationId: string }[],
  plans: { id: string; slug: string; amount: number }[]
) {
  console.info('Seeding subscriptions...');

  const subscriptions = [];
  const now = new Date();
  const proPlan = plans.find(p => p.slug === 'pro')!;
  const enterprisePlan = plans.find(p => p.slug === 'enterprise')!;
  const freePlan = plans.find(p => p.slug === 'free')!;

  const statuses = ['active', 'active', 'active', 'trialing', 'past_due', 'cancelled'];

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const status = statuses[i % statuses.length];

    const existing = await prisma.subscription.findFirst({
      where: { customerId: customer.id },
    });

    if (existing) {
      subscriptions.push(existing);
      continue;
    }

    // Assign different plans based on index
    let plan = proPlan;
    if (i % 4 === 0) plan = enterprisePlan;
    if (i % 5 === 0) plan = freePlan;

    const periodStart = new Date(now);
    periodStart.setMonth(periodStart.getMonth() - 1);

    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: plan.id,
        provider: 'stripe',
        providerSubId: `sub_${randomString(14)}`,
        status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: status === 'cancelled',
        cancelledAt: status === 'cancelled' ? new Date() : null,
        trialEnd: status === 'trialing' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
        graceEndsAt: status === 'past_due' ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) : null,
        paymentFailedAt: status === 'past_due' ? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) : null,
        paymentRetryCount: status === 'past_due' ? 2 : 0,
        metadata: {},
      },
    });

    subscriptions.push(subscription);
  }

  console.info(`  ✓ Created ${subscriptions.length} subscriptions`);
  return subscriptions;
}

/**
 * Seed invoices
 */
export async function seedInvoices(
  prisma: PrismaClient,
  subscriptions: { id: string; customerId: string; planId: string }[]
) {
  console.info('Seeding invoices...');

  const invoices = [];
  const statuses = ['paid', 'paid', 'paid', 'open', 'past_due', 'void'];

  const plans = await prisma.billingPlan.findMany();
  const planMap = new Map(plans.map(p => [p.id, p]));

  for (let i = 0; i < subscriptions.length; i++) {
    const sub = subscriptions[i];
    const plan = planMap.get(sub.planId);
    if (!plan || plan.amount === 0) continue;

    // Create 3 invoices per subscription
    for (let j = 0; j < 3; j++) {
      const status = statuses[(i + j) % statuses.length];
      const createdAt = new Date();
      createdAt.setMonth(createdAt.getMonth() - j);

      const dueDate = new Date(createdAt);
      dueDate.setDate(dueDate.getDate() + 30);

      const existing = await prisma.invoice.findFirst({
        where: {
          customerId: sub.customerId,
          createdAt: {
            gte: new Date(createdAt.getFullYear(), createdAt.getMonth(), 1),
            lt: new Date(createdAt.getFullYear(), createdAt.getMonth() + 1, 1),
          },
        },
      });

      if (existing) {
        invoices.push(existing);
        continue;
      }

      const invoice = await prisma.invoice.create({
        data: {
          customerId: sub.customerId,
          provider: 'stripe',
          providerInvId: `in_${randomString(14)}`,
          subscriptionId: sub.id,
          amount: plan.amount,
          amountPaid: status === 'paid' ? plan.amount : 0,
          currency: 'usd',
          status,
          dueDate,
          paidAt: status === 'paid' ? new Date(dueDate.getTime() - 5 * 24 * 60 * 60 * 1000) : null,
          invoiceUrl: `https://invoice.stripe.com/${randomString(24)}`,
          lineItems: JSON.stringify([
            {
              description: `${plan.name} subscription`,
              amount: plan.amount,
              quantity: 1,
            },
          ]),
          createdAt,
        },
      });

      invoices.push(invoice);
    }
  }

  console.info(`  ✓ Created ${invoices.length} invoices`);
  return invoices;
}

/**
 * Seed payments
 */
export async function seedPayments(
  prisma: PrismaClient,
  customers: { id: string }[],
  invoices: { id: string; customerId: string; amount: number; status: string }[]
) {
  console.info('Seeding payments...');

  const payments = [];

  // Create payments for paid invoices
  for (const invoice of invoices) {
    if (invoice.status !== 'paid') continue;

    const existing = await prisma.payment.findFirst({
      where: { invoiceId: invoice.id },
    });

    if (existing) {
      payments.push(existing);
      continue;
    }

    const payment = await prisma.payment.create({
      data: {
        customerId: invoice.customerId,
        provider: 'stripe',
        providerPayId: `pi_${randomString(24)}`,
        amount: invoice.amount,
        currency: 'usd',
        status: 'succeeded',
        description: 'Subscription payment',
        invoiceId: invoice.id,
        receiptUrl: `https://pay.stripe.com/receipts/${randomString(24)}`,
        metadata: {},
      },
    });

    payments.push(payment);
  }

  // Add some failed payments
  const failureReasons = ['card_declined', 'insufficient_funds', 'expired_card'];
  const failureMessages = [
    'Your card was declined.',
    'Your card has insufficient funds.',
    'Your card has expired.',
  ];

  for (let i = 0; i < Math.min(3, customers.length); i++) {
    const customer = customers[i];

    const failedPayment = await prisma.payment.create({
      data: {
        customerId: customer.id,
        provider: 'stripe',
        providerPayId: `pi_${randomString(24)}`,
        amount: 2900,
        currency: 'usd',
        status: 'failed',
        description: 'Failed subscription payment',
        metadata: {
          failure_reason: failureReasons[i],
          failure_message: failureMessages[i],
        },
      },
    });

    payments.push(failedPayment);
  }

  console.info(`  ✓ Created ${payments.length} payments`);
  return payments;
}

/**
 * Seed all billing data
 */
export async function seedBilling(
  prisma: PrismaClient,
  organizations: Organization[]
) {
  console.info('\n💳 Seeding billing data...');

  const plans = await seedBillingPlans(prisma);
  const customers = await seedBillingCustomers(prisma, organizations);
  const subscriptions = await seedSubscriptions(prisma, customers, plans);
  const invoices = await seedInvoices(prisma, subscriptions);
  const payments = await seedPayments(prisma, customers, invoices);

  return {
    plans,
    customers,
    subscriptions,
    invoices,
    payments,
  };
}

/**
 * Clear all billing data
 */
export async function clearBillingData(prisma: PrismaClient) {
  console.info('Clearing billing data...');
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.billingCustomer.deleteMany();
  await prisma.billingPlan.deleteMany();
  console.info('  ✓ Billing data cleared');
}
