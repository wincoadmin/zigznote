/**
 * Admin Billing Routes
 * Manage all billing, subscriptions, and revenue for the platform
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zigznote/database';
import { requireAdminAuth, AdminAuthenticatedRequest } from '../../middleware/adminAuth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { BadRequestError, NotFoundError } from '@zigznote/shared';
import { BillingService } from '../../billing/BillingService';

const router: Router = Router();
const billingService = new BillingService();

// All routes require admin authentication
router.use(requireAdminAuth);

/**
 * GET /admin/billing/stats
 * Get revenue statistics and metrics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: { status: { in: ['active', 'trialing'] } },
    });

    // Get subscriptions by status
    const subscriptionsByStatus = await prisma.subscription.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    // Get MRR (Monthly Recurring Revenue)
    const activeWithPlans = await prisma.subscription.findMany({
      where: { status: 'active' },
      include: { plan: true },
    });

    const mrr = activeWithPlans.reduce((sum, sub) => {
      if (!sub.plan) return sum;
      const monthlyAmount = sub.plan.interval === 'year'
        ? sub.plan.amount / 12
        : sub.plan.amount;
      return sum + monthlyAmount;
    }, 0);

    // Get new subscriptions this month
    const newThisMonth = await prisma.subscription.count({
      where: {
        createdAt: { gte: startOfMonth },
        status: { in: ['active', 'trialing'] },
      },
    });

    // Get churned this month
    const churnedThisMonth = await prisma.subscription.count({
      where: {
        cancelledAt: { gte: startOfMonth },
        status: 'cancelled',
      },
    });

    // Get revenue this month (from payments)
    const revenueThisMonth = await prisma.payment.aggregate({
      where: {
        createdAt: { gte: startOfMonth },
        status: 'succeeded',
      },
      _sum: { amount: true },
    });

    // Get revenue last month
    const revenueLastMonth = await prisma.payment.aggregate({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        status: 'succeeded',
      },
      _sum: { amount: true },
    });

    // Get trial conversions
    const trialsStartedLastMonth = await prisma.subscription.count({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        trialEnd: { not: null },
      },
    });

    const trialsConvertedLastMonth = await prisma.subscription.count({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        trialEnd: { not: null },
        status: 'active',
      },
    });

    // Get failed payments (past_due)
    const failedPayments = await prisma.subscription.count({
      where: { status: 'past_due' },
    });

    // Calculate growth
    const currentRevenue = revenueThisMonth._sum.amount || 0;
    const lastRevenue = revenueLastMonth._sum.amount || 0;
    const revenueGrowth = lastRevenue > 0
      ? ((currentRevenue - lastRevenue) / lastRevenue) * 100
      : 0;

    res.json({
      mrr: mrr / 100, // Convert cents to dollars
      arr: (mrr * 12) / 100,
      activeSubscriptions,
      trialingSubscriptions: subscriptionsByStatus.find(s => s.status === 'trialing')?._count.status || 0,
      newThisMonth,
      churnedThisMonth,
      churnRate: activeSubscriptions > 0 ? (churnedThisMonth / activeSubscriptions) * 100 : 0,
      revenueThisMonth: currentRevenue / 100,
      revenueLastMonth: lastRevenue / 100,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      failedPayments,
      trialConversionRate: trialsStartedLastMonth > 0
        ? Math.round((trialsConvertedLastMonth / trialsStartedLastMonth) * 100)
        : 0,
      subscriptionsByStatus: subscriptionsByStatus.reduce((acc, s) => {
        acc[s.status] = s._count.status;
        return acc;
      }, {} as Record<string, number>),
    });
  })
);

/**
 * GET /admin/billing/revenue-chart
 * Get revenue data for charts (last 12 months)
 */
router.get(
  '/revenue-chart',
  asyncHandler(async (_req: Request, res: Response) => {
    const months: Array<{ month: string; revenue: number; subscriptions: number }> = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const revenue = await prisma.payment.aggregate({
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
          status: 'succeeded',
        },
        _sum: { amount: true },
      });

      const subscriptions = await prisma.subscription.count({
        where: {
          createdAt: { lte: endOfMonth },
          OR: [
            { cancelledAt: null },
            { cancelledAt: { gt: endOfMonth } },
          ],
          status: { in: ['active', 'trialing'] },
        },
      });

      months.push({
        month: startOfMonth.toISOString().slice(0, 7), // YYYY-MM
        revenue: (revenue._sum.amount || 0) / 100,
        subscriptions,
      });
    }

    res.json({ data: months });
  })
);

/**
 * GET /admin/billing/subscriptions
 * List all subscriptions with filtering
 */
router.get(
  '/subscriptions',
  asyncHandler(async (req: Request, res: Response) => {
    const { status, plan, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (plan) {
      where.plan = { slug: plan };
    }

    if (search) {
      where.customer = {
        organization: {
          name: { contains: search as string, mode: 'insensitive' },
        },
      };
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          customer: {
            include: {
              organization: { select: { id: true, name: true } },
            },
          },
          plan: { select: { id: true, name: true, slug: true, amount: true, interval: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.subscription.count({ where }),
    ]);

    res.json({
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        organization: sub.customer.organization,
        plan: sub.plan,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        trialEnd: sub.trialEnd,
        createdAt: sub.createdAt,
        cancelledAt: sub.cancelledAt,
        mrr: sub.plan
          ? (sub.plan.interval === 'year' ? sub.plan.amount / 12 : sub.plan.amount) / 100
          : 0,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

/**
 * GET /admin/billing/subscriptions/:id
 * Get subscription details
 */
router.get(
  '/subscriptions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            organization: true,
          },
        },
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    res.json({ subscription });
  })
);

/**
 * POST /admin/billing/subscriptions/:id/cancel
 * Cancel a subscription
 */
router.post(
  '/subscriptions/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { immediately = false, reason } = req.body;
    const adminReq = req as AdminAuthenticatedRequest;

    if (!id) {
      throw new BadRequestError('Subscription ID is required');
    }

    const subscription = await billingService.cancelSubscription(id, immediately);

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'subscription.cancelled',
        entityType: 'subscription',
        entityId: id,
        adminUserId: adminReq.adminAuth?.adminId,
        details: { immediately, reason },
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({ subscription });
  })
);

/**
 * POST /admin/billing/subscriptions/:id/resume
 * Resume a cancelled subscription
 */
router.post(
  '/subscriptions/:id/resume',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminReq = req as AdminAuthenticatedRequest;

    if (!id) {
      throw new BadRequestError('Subscription ID is required');
    }

    const subscription = await billingService.resumeSubscription(id);

    await prisma.auditLog.create({
      data: {
        action: 'subscription.resumed',
        entityType: 'subscription',
        entityId: id,
        adminUserId: adminReq.adminAuth?.adminId,
        details: {},
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({ subscription });
  })
);

/**
 * POST /admin/billing/subscriptions/:id/extend-trial
 * Extend trial period
 */
router.post(
  '/subscriptions/:id/extend-trial',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { days } = req.body;
    const adminReq = req as AdminAuthenticatedRequest;

    if (!days || days < 1 || days > 90) {
      throw new BadRequestError('Days must be between 1 and 90');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    const currentTrialEnd = subscription.trialEnd || new Date();
    const newTrialEnd = new Date(currentTrialEnd);
    newTrialEnd.setDate(newTrialEnd.getDate() + days);

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        trialEnd: newTrialEnd,
        status: 'trialing',
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'subscription.trial_extended',
        entityType: 'subscription',
        entityId: id,
        adminUserId: adminReq.adminAuth?.adminId,
        details: { days, newTrialEnd: newTrialEnd.toISOString() },
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({ subscription: updated });
  })
);

/**
 * GET /admin/billing/invoices
 * List all invoices
 */
router.get(
  '/invoices',
  asyncHandler(async (req: Request, res: Response) => {
    const { status, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.customer = {
        organization: {
          name: { contains: search as string, mode: 'insensitive' },
        },
      };
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: {
            include: {
              organization: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      invoices: invoices.map(inv => ({
        id: inv.id,
        providerInvId: inv.providerInvId,
        organization: inv.customer.organization,
        amount: inv.amount / 100,
        currency: inv.currency,
        status: inv.status,
        invoiceUrl: inv.invoiceUrl,
        invoicePdf: inv.invoicePdf,
        createdAt: inv.createdAt,
        paidAt: inv.paidAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

/**
 * POST /admin/billing/refund
 * Process a refund
 */
router.post(
  '/refund',
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId, amount, reason } = req.body;
    const adminReq = req as AdminAuthenticatedRequest;

    if (!paymentId) {
      throw new BadRequestError('Payment ID required');
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { customer: true },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // TODO: Process refund through Stripe
    // For now, just log it
    await prisma.auditLog.create({
      data: {
        action: 'payment.refunded',
        entityType: 'payment',
        entityId: paymentId,
        adminUserId: adminReq.adminAuth?.adminId,
        details: { amount, reason },
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({ success: true, message: 'Refund initiated' });
  })
);

/**
 * GET /admin/billing/plans
 * List all billing plans
 */
router.get(
  '/plans',
  asyncHandler(async (_req: Request, res: Response) => {
    const plans = await prisma.billingPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    // Get subscriber count for each plan
    const plansWithStats = await Promise.all(
      plans.map(async (plan) => {
        const subscriberCount = await prisma.subscription.count({
          where: {
            planId: plan.id,
            status: { in: ['active', 'trialing'] },
          },
        });

        return {
          ...plan,
          amount: plan.amount / 100,
          subscriberCount,
        };
      })
    );

    res.json({ plans: plansWithStats });
  })
);

/**
 * POST /admin/billing/plans
 * Create a new billing plan
 */
router.post(
  '/plans',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, slug, description, amount, currency, interval, trialDays, features, limits, stripePriceId } = req.body;
    const adminReq = req as AdminAuthenticatedRequest;

    if (!name || !slug || !amount) {
      throw new BadRequestError('Name, slug, and amount are required');
    }

    // Check if slug already exists
    const existing = await prisma.billingPlan.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new BadRequestError('A plan with this slug already exists');
    }

    const plan = await prisma.billingPlan.create({
      data: {
        name,
        slug,
        description,
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency || 'usd',
        interval: interval || 'month',
        trialDays: trialDays || 0,
        features: features || [],
        limits: limits || {},
        stripePriceId,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'billing_plan.created',
        entityType: 'billing_plan',
        entityId: plan.id,
        adminUserId: adminReq.adminAuth?.adminId,
        details: { name, slug },
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({ plan: { ...plan, amount: plan.amount / 100 } });
  })
);

/**
 * PUT /admin/billing/plans/:id
 * Update a billing plan
 */
router.put(
  '/plans/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, features, limits, isActive, stripePriceId } = req.body;
    const adminReq = req as AdminAuthenticatedRequest;

    const plan = await prisma.billingPlan.update({
      where: { id },
      data: {
        name,
        description,
        features,
        limits,
        isActive,
        stripePriceId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'billing_plan.updated',
        entityType: 'billing_plan',
        entityId: id,
        adminUserId: adminReq.adminAuth?.adminId,
        details: {},
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({ plan: { ...plan, amount: plan.amount / 100 } });
  })
);

/**
 * DELETE /admin/billing/plans/:id
 * Archive a billing plan (soft delete)
 */
router.delete(
  '/plans/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminReq = req as AdminAuthenticatedRequest;

    // Check if plan has active subscribers
    const activeSubscribers = await prisma.subscription.count({
      where: {
        planId: id,
        status: { in: ['active', 'trialing'] },
      },
    });

    if (activeSubscribers > 0) {
      throw new BadRequestError(`Cannot delete plan with ${activeSubscribers} active subscribers`);
    }

    await prisma.billingPlan.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        action: 'billing_plan.archived',
        entityType: 'billing_plan',
        entityId: id,
        adminUserId: adminReq.adminAuth?.adminId,
        details: {},
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({ success: true });
  })
);

/**
 * GET /admin/billing/failed-payments
 * List subscriptions with failed payments (dunning)
 */
router.get(
  '/failed-payments',
  asyncHandler(async (req: Request, res: Response) => {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where: { status: 'past_due' },
        include: {
          customer: {
            include: {
              organization: { select: { id: true, name: true } },
            },
          },
          plan: { select: { name: true, amount: true } },
        },
        orderBy: { paymentFailedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.subscription.count({ where: { status: 'past_due' } }),
    ]);

    res.json({
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        organization: {
          ...sub.customer.organization,
          email: sub.customer.email, // Use billing customer email
        },
        plan: sub.plan,
        amount: sub.plan ? sub.plan.amount / 100 : 0,
        paymentFailedAt: sub.paymentFailedAt,
        paymentRetryCount: sub.paymentRetryCount,
        graceEndsAt: sub.graceEndsAt,
        daysUntilSuspension: sub.graceEndsAt
          ? Math.ceil((new Date(sub.graceEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

/**
 * POST /admin/billing/failed-payments/:id/extend-grace
 * Extend grace period for failed payment
 */
router.post(
  '/failed-payments/:id/extend-grace',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { days } = req.body;
    const adminReq = req as AdminAuthenticatedRequest;

    if (!days || days < 1 || days > 30) {
      throw new BadRequestError('Days must be between 1 and 30');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    const currentGraceEnd = subscription.graceEndsAt || new Date();
    const newGraceEnd = new Date(currentGraceEnd);
    newGraceEnd.setDate(newGraceEnd.getDate() + days);

    const updated = await prisma.subscription.update({
      where: { id },
      data: { graceEndsAt: newGraceEnd },
    });

    await prisma.auditLog.create({
      data: {
        action: 'subscription.grace_extended',
        entityType: 'subscription',
        entityId: id,
        adminUserId: adminReq.adminAuth?.adminId,
        details: { days, newGraceEnd: newGraceEnd.toISOString() },
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({ subscription: updated });
  })
);

/**
 * GET /admin/billing/recent-activity
 * Get recent billing activity
 */
router.get(
  '/recent-activity',
  asyncHandler(async (_req: Request, res: Response) => {
    const [recentPayments, recentSubscriptions, recentCancellations] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'succeeded' },
        include: {
          customer: {
            include: {
              organization: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.subscription.findMany({
        where: { status: { in: ['active', 'trialing'] } },
        include: {
          customer: {
            include: {
              organization: { select: { name: true } },
            },
          },
          plan: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.subscription.findMany({
        where: { status: 'cancelled' },
        include: {
          customer: {
            include: {
              organization: { select: { name: true } },
            },
          },
          plan: { select: { name: true } },
        },
        orderBy: { cancelledAt: 'desc' },
        take: 5,
      }),
    ]);

    const activity = [
      ...recentPayments.map(p => ({
        type: 'payment',
        organization: p.customer.organization.name,
        amount: p.amount / 100,
        date: p.createdAt,
      })),
      ...recentSubscriptions.map(s => ({
        type: s.status === 'trialing' ? 'trial_started' : 'subscription_started',
        organization: s.customer.organization.name,
        plan: s.plan?.name,
        date: s.createdAt,
      })),
      ...recentCancellations.map(s => ({
        type: 'cancellation',
        organization: s.customer.organization.name,
        plan: s.plan?.name,
        date: s.cancelledAt,
      })),
    ].sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime()).slice(0, 10);

    res.json({ activity });
  })
);

export const billingRouter = router;
