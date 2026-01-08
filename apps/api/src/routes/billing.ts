/**
 * User-facing billing routes
 * Allows users to view and manage their organization's subscription
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zigznote/database';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, validateRequest } from '../middleware';
import { BillingService } from '../billing/BillingService';

const router = Router();
const billingService = new BillingService();

// All routes require authentication
router.use(requireAuth as (req: Request, res: Response, next: NextFunction) => void);

/**
 * @route GET /api/v1/billing/subscription
 * @description Get current subscription for user's organization
 */
router.get(
  '/subscription',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'User has no organization' },
      });
      return;
    }

    const subscription = await billingService.getSubscription(organizationId);

    if (!subscription) {
      // Return free plan info if no subscription
      const freePlan = await billingService.getPlanBySlug('free');
      res.json({
        success: true,
        data: {
          plan: freePlan || { name: 'Free', slug: 'free' },
          status: 'active',
          isFreePlan: true,
        },
      });
      return;
    }

    // Get plan details
    const plan = await prisma.billingPlan.findUnique({
      where: { id: subscription.planId },
    });

    res.json({
      success: true,
      data: {
        id: subscription.id,
        plan: plan ? {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          amount: plan.amount,
          currency: plan.currency,
          interval: plan.interval,
          features: plan.features,
          limits: plan.limits,
        } : null,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEnd: subscription.trialEnd,
        isFreePlan: false,
      },
    });
  })
);

/**
 * @route GET /api/v1/billing/plans
 * @description Get all available billing plans
 */
router.get(
  '/plans',
  asyncHandler(async (_req: Request, res: Response) => {
    const plans = await billingService.getPlans();

    res.json({
      success: true,
      data: plans,
    });
  })
);

/**
 * @route GET /api/v1/billing/usage
 * @description Get current usage for user's organization
 */
router.get(
  '/usage',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'User has no organization' },
      });
      return;
    }

    // Get current period
    const currentPeriod = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    // Get usage record
    const usageRecord = await prisma.usageRecord.findUnique({
      where: { organizationId_period: { organizationId, period: currentPeriod } },
    });

    // Get organization with plan
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    // Get plan limits
    const plan = await prisma.billingPlan.findUnique({
      where: { slug: org?.plan || 'free' },
    });

    // Count team members
    const teamMemberCount = await prisma.user.count({
      where: { organizationId, deletedAt: null },
    });

    const limits = (plan?.limits as Record<string, number>) || {};

    res.json({
      success: true,
      data: {
        period: currentPeriod,
        usage: {
          meetings: usageRecord?.meetingsCount || 0,
          minutes: usageRecord?.meetingMinutes || 0,
          storage: usageRecord ? Number(usageRecord.storageUsed) : 0,
          teamMembers: teamMemberCount,
        },
        limits: {
          meetings: limits.meetings_per_month || -1,
          minutes: limits.minutes_per_meeting || -1,
          storage: (limits.storage_gb || 1) * 1024 * 1024 * 1024, // Convert to bytes
          teamMembers: limits.team_members || 1,
        },
        plan: org?.plan || 'free',
      },
    });
  })
);

/**
 * @route GET /api/v1/billing/invoices
 * @description Get invoice history
 */
router.get(
  '/invoices',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'User has no organization' },
      });
      return;
    }

    const invoices = await billingService.getInvoices(organizationId);

    res.json({
      success: true,
      data: invoices,
    });
  })
);

/**
 * @route GET /api/v1/billing/payments
 * @description Get payment history
 */
router.get(
  '/payments',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'User has no organization' },
      });
      return;
    }

    const payments = await billingService.getPaymentHistory(organizationId);

    res.json({
      success: true,
      data: payments,
    });
  })
);

// Validation schemas
const checkoutSchema = {
  body: z.object({
    planSlug: z.string().min(1),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  }),
};

/**
 * @route POST /api/v1/billing/checkout
 * @description Create a checkout session for plan upgrade
 */
router.post(
  '/checkout',
  validateRequest(checkoutSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { planSlug, successUrl, cancelUrl } = req.body as z.infer<typeof checkoutSchema.body>;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'User has no organization' },
      });
      return;
    }

    // Check if user is admin
    if (authReq.auth?.role !== 'admin' && authReq.auth?.role !== 'owner') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins can change subscription' },
      });
      return;
    }

    const baseUrl = process.env.WEB_URL || 'http://localhost:3000';

    const result = await billingService.createCheckoutSession({
      organizationId,
      planSlug,
      successUrl: successUrl || `${baseUrl}/settings/billing?success=true`,
      cancelUrl: cancelUrl || `${baseUrl}/settings/billing?canceled=true`,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route POST /api/v1/billing/cancel
 * @description Cancel subscription at period end
 */
router.post(
  '/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'User has no organization' },
      });
      return;
    }

    // Check if user is admin
    if (authReq.auth?.role !== 'admin' && authReq.auth?.role !== 'owner') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins can cancel subscription' },
      });
      return;
    }

    const subscription = await billingService.getSubscription(organizationId);

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active subscription found' },
      });
      return;
    }

    const result = await billingService.cancelSubscription(subscription.id, false);

    res.json({
      success: true,
      data: result,
      message: 'Subscription will be cancelled at the end of the billing period',
    });
  })
);

/**
 * @route POST /api/v1/billing/resume
 * @description Resume a cancelled subscription
 */
router.post(
  '/resume',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'User has no organization' },
      });
      return;
    }

    // Check if user is admin
    if (authReq.auth?.role !== 'admin' && authReq.auth?.role !== 'owner') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins can manage subscription' },
      });
      return;
    }

    const subscription = await billingService.getSubscription(organizationId);

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No subscription found' },
      });
      return;
    }

    const result = await billingService.resumeSubscription(subscription.id);

    res.json({
      success: true,
      data: result,
      message: 'Subscription resumed successfully',
    });
  })
);

export default router;
