/**
 * Billing Routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zigznote/database';
import { BillingService } from './BillingService';
import { asyncHandler } from '../middleware/asyncHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { PaymentProviderType } from './providers';
import { config } from '../config';

const router: Router = Router();
const billingService = new BillingService();

/**
 * GET /billing/plans
 * Get all available billing plans
 */
router.get(
  '/plans',
  asyncHandler(async (_req: Request, res: Response) => {
    const plans = await billingService.getPlans();
    res.json({ plans });
  })
);

/**
 * GET /billing/subscription
 * Get current subscription for organization
 */
router.get(
  '/subscription',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const subscription = await billingService.getSubscription(organizationId);

    if (!subscription) {
      res.json({ subscription: null });
      return;
    }

    // Get plan details
    const plan = await prisma.billingPlan.findUnique({
      where: { id: subscription.planId },
    });

    res.json({
      subscription: {
        ...subscription,
        plan: plan ? {
          name: plan.name,
          slug: plan.slug,
          features: plan.features,
        } : null,
      },
    });
  })
);

/**
 * POST /billing/checkout
 * Create a checkout session for a new subscription
 */
router.post(
  '/checkout',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { planSlug, provider } = req.body;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    if (!planSlug || typeof planSlug !== 'string') {
      throw new BadRequestError('Plan slug required');
    }

    // Validate provider if specified
    if (provider && !['stripe', 'flutterwave'].includes(provider)) {
      throw new BadRequestError('Invalid payment provider');
    }

    const successUrl = `${config.webUrl}/settings/billing?success=true`;
    const cancelUrl = `${config.webUrl}/settings/billing?cancelled=true`;

    const session = await billingService.createCheckoutSession({
      organizationId,
      planSlug,
      successUrl,
      cancelUrl,
      provider: provider as PaymentProviderType | undefined,
    });

    res.json({ url: session.url });
  })
);

/**
 * POST /billing/subscription
 * Create a subscription directly (for use with payment methods)
 */
router.post(
  '/subscription',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { planSlug, paymentMethodId, provider } = req.body;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    if (!planSlug || typeof planSlug !== 'string') {
      throw new BadRequestError('Plan slug required');
    }

    const subscription = await billingService.createSubscription({
      organizationId,
      planSlug,
      paymentMethodId,
      provider: provider as PaymentProviderType | undefined,
    });

    res.json({ subscription });
  })
);

/**
 * POST /billing/subscription/cancel
 * Cancel current subscription
 */
router.post(
  '/subscription/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;
    const { immediately } = req.body;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const currentSubscription = await billingService.getSubscription(organizationId);

    if (!currentSubscription) {
      throw new NotFoundError('No active subscription');
    }

    const subscription = await billingService.cancelSubscription(
      currentSubscription.id,
      immediately === true
    );

    res.json({ subscription });
  })
);

/**
 * POST /billing/subscription/resume
 * Resume a cancelled subscription
 */
router.post(
  '/subscription/resume',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const currentSubscription = await billingService.getSubscription(organizationId);

    if (!currentSubscription) {
      throw new NotFoundError('No subscription found');
    }

    if (!currentSubscription.cancelAtPeriodEnd) {
      throw new BadRequestError('Subscription is not scheduled for cancellation');
    }

    const subscription = await billingService.resumeSubscription(currentSubscription.id);

    res.json({ subscription });
  })
);

/**
 * GET /billing/payments
 * Get payment history
 */
router.get(
  '/payments',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const payments = await billingService.getPaymentHistory(organizationId);

    res.json({ payments });
  })
);

/**
 * GET /billing/invoices
 * Get invoice history
 */
router.get(
  '/invoices',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = authReq.auth?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID required');
    }

    const invoices = await billingService.getInvoices(organizationId);

    res.json({ invoices });
  })
);

/**
 * POST /billing/webhooks/stripe
 * Handle Stripe webhooks
 */
router.post(
  '/webhooks/stripe',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      throw new BadRequestError('Missing Stripe signature');
    }

    await billingService.handleWebhook('stripe', req.body, signature);

    res.json({ received: true });
  })
);

/**
 * POST /billing/webhooks/flutterwave
 * Handle Flutterwave webhooks
 */
router.post(
  '/webhooks/flutterwave',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['verif-hash'] as string;

    if (!signature) {
      throw new BadRequestError('Missing Flutterwave signature');
    }

    await billingService.handleWebhook('flutterwave', JSON.stringify(req.body), signature);

    res.json({ received: true });
  })
);

export default router;
