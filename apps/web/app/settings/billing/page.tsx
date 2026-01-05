'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UsageQuotaDisplay } from '@/components/settings';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  slug: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

interface Subscription {
  id: string;
  status: string;
  plan: {
    name: string;
    slug: string;
  };
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  receiptUrl?: string;
}

const MOCK_PLANS: Plan[] = [
  {
    id: 'plan_free',
    slug: 'free',
    name: 'Free',
    description: 'For individuals and small teams',
    amount: 0,
    currency: 'usd',
    interval: 'month',
    features: [
      '5 meetings per month',
      'Basic transcription',
      'AI summaries',
      'Email support',
    ],
  },
  {
    id: 'plan_pro',
    slug: 'pro',
    name: 'Pro',
    description: 'For growing teams',
    amount: 2900,
    currency: 'usd',
    interval: 'month',
    features: [
      'Unlimited meetings',
      'Advanced transcription',
      'Custom AI prompts',
      'Slack & HubSpot integrations',
      'Priority support',
      'API access',
    ],
  },
  {
    id: 'plan_enterprise',
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    amount: 9900,
    currency: 'usd',
    interval: 'month',
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'SSO / SAML',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
    ],
  },
];

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [plans] = useState<Plan[]>(MOCK_PLANS);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments] = useState<Payment[]>([]);
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const handleSelectPlan = async (planSlug: string) => {
    if (planSlug === 'free') return;

    setLoading(planSlug);

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug }),
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to start checkout:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access at the end of your billing period.')) {
      return;
    }

    try {
      const response = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediately: false }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
  };

  const handleResumeSubscription = async () => {
    try {
      const response = await fetch('/api/billing/subscription/resume', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error('Failed to resume subscription:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Billing</h2>
        <p className="text-sm text-slate-500">
          Manage your subscription and billing settings
        </p>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Your subscription has been updated successfully!</span>
          </div>
        </div>
      )}

      {/* Current Subscription */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {subscription.plan.name}
                </h3>
                <p className="text-sm text-slate-500">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                    : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                </p>
              </div>
              {subscription.cancelAtPeriodEnd ? (
                <Button onClick={handleResumeSubscription}>Resume Subscription</Button>
              ) : (
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={handleCancelSubscription}
                >
                  Cancel Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Quotas */}
      <UsageQuotaDisplay />

      {/* Billing Interval Toggle */}
      <div className="flex items-center justify-center gap-4">
        <span
          className={cn(
            'text-sm font-medium',
            selectedInterval === 'month' ? 'text-slate-900' : 'text-slate-500'
          )}
        >
          Monthly
        </span>
        <button
          onClick={() => setSelectedInterval(selectedInterval === 'month' ? 'year' : 'month')}
          className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200"
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition',
              selectedInterval === 'year' ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
        <span
          className={cn(
            'text-sm font-medium',
            selectedInterval === 'year' ? 'text-slate-900' : 'text-slate-500'
          )}
        >
          Yearly
          <span className="ml-1 text-green-600 text-xs">(Save 20%)</span>
        </span>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = subscription?.plan.slug === plan.slug;
          const price =
            selectedInterval === 'year'
              ? Math.round(plan.amount * 12 * 0.8) // 20% discount
              : plan.amount;

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative',
                plan.slug === 'pro' && 'border-primary-500 border-2'
              )}
            >
              {plan.slug === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.name}</span>
                  {isCurrentPlan && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      Current
                    </span>
                  )}
                </CardTitle>
                {plan.description && (
                  <p className="text-sm text-slate-500">{plan.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <span className="text-4xl font-bold text-slate-900">
                    {plan.amount === 0 ? 'Free' : formatPrice(price, plan.currency)}
                  </span>
                  {plan.amount > 0 && (
                    <span className="text-slate-500 ml-1">
                      /{selectedInterval === 'year' ? 'year' : 'month'}
                    </span>
                  )}
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-green-500 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.slug === 'pro' ? 'primary' : 'outline'}
                  onClick={() => handleSelectPlan(plan.slug)}
                  disabled={isCurrentPlan || loading === plan.slug}
                >
                  {loading === plan.slug
                    ? 'Loading...'
                    : isCurrentPlan
                    ? 'Current Plan'
                    : plan.slug === 'free'
                    ? 'Get Started'
                    : plan.slug === 'enterprise'
                    ? 'Contact Sales'
                    : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No payments yet
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatPrice(payment.amount, payment.currency)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        'text-sm px-2 py-1 rounded',
                        payment.status === 'succeeded'
                          ? 'bg-green-100 text-green-700'
                          : payment.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      {payment.status}
                    </span>
                    {payment.receiptUrl && (
                      <a
                        href={payment.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        Receipt
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 p-4 border border-slate-200 rounded-lg flex items-center gap-3">
              <svg className="w-8 h-8" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="4" fill="#635BFF" />
                <path
                  d="M13.9865 11.2c-1.5335 0-2.5468.7067-2.5468 1.8933 0 1.4934 2.0802 1.6534 2.0802 2.4267 0 .32-.28.4267-.7201.4267-.6401 0-1.44-.2934-1.44-.2934l-.2933 1.2267s.7866.36 1.6933.36c1.6 0 2.6267-.7333 2.6267-1.9466 0-1.5734-2.0933-1.68-2.0933-2.4134 0-.2666.2266-.4.6533-.4.5066 0 1.1866.2134 1.1866.2134l.28-1.2s-.6933-.2934-1.52-.2934z"
                  fill="white"
                />
              </svg>
              <div>
                <p className="font-medium text-slate-900">Stripe</p>
                <p className="text-sm text-slate-500">Credit card, Apple Pay, Google Pay</p>
              </div>
            </div>
            <div className="flex-1 p-4 border border-slate-200 rounded-lg flex items-center gap-3 opacity-50">
              <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Flutterwave</p>
                <p className="text-sm text-slate-500">Mobile money, bank transfer (Africa)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
