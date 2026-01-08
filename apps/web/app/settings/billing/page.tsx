'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  FileText,
  Calendar,
  TrendingUp,
  Users,
  Clock,
  HardDrive,
  Zap,
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  amount: number;
  currency: string;
  interval: string;
  features: string[];
  limits: Record<string, number>;
}

interface Subscription {
  id?: string;
  plan: Plan | null;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: string;
  isFreePlan: boolean;
}

interface Usage {
  period: string;
  usage: {
    meetings: number;
    minutes: number;
    storage: number;
    teamMembers: number;
  };
  limits: {
    meetings: number;
    minutes: number;
    storage: number;
    teamMembers: number;
  };
  plan: string;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoiceUrl?: string;
  createdAt: string;
}

export default function BillingPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [resuming, setResuming] = useState(false);

  const isAdmin = (session?.user as any)?.role === 'admin' || (session?.user as any)?.role === 'owner';
  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const [subRes, plansRes, usageRes, invoicesRes] = await Promise.all([
        fetch('/api/v1/billing/subscription'),
        fetch('/api/v1/billing/plans'),
        fetch('/api/v1/billing/usage'),
        fetch('/api/v1/billing/invoices'),
      ]);

      if (subRes.ok) {
        const data = await subRes.json();
        setSubscription(data.data);
      }

      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.data || []);
      }

      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data.data);
      }

      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        setInvoices(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planSlug: string) => {
    setUpgrading(planSlug);
    try {
      const res = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.data?.url) {
          window.location.href = data.data.url;
        }
      }
    } catch (error) {
      console.error('Failed to create checkout:', error);
    } finally {
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }

    setCanceling(true);
    try {
      const res = await fetch('/api/v1/billing/cancel', {
        method: 'POST',
      });

      if (res.ok) {
        await fetchBillingData();
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    } finally {
      setCanceling(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      const res = await fetch('/api/v1/billing/resume', {
        method: 'POST',
      });

      if (res.ok) {
        await fetchBillingData();
      }
    } catch (error) {
      console.error('Failed to resume subscription:', error);
    } finally {
      setResuming(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Billing & Subscription</h2>
        <p className="text-slate-500 mt-1">Manage your subscription and billing information</p>
      </div>

      {/* Success/Cancel Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-green-600" />
          <p className="text-green-800">Your subscription has been updated successfully!</p>
        </div>
      )}

      {canceled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <p className="text-yellow-800">Checkout was canceled. No changes were made to your subscription.</p>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-slate-900">Current Plan</h3>
          {subscription?.status && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              subscription.status === 'active' ? 'bg-green-100 text-green-700' :
              subscription.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
              subscription.status === 'past_due' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {subscription.status === 'trialing' ? 'Trial' :
               subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1).replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <Zap className="h-6 w-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-xl font-semibold text-slate-900">
              {subscription?.plan?.name || 'Free'}
            </h4>
            {subscription?.plan?.amount ? (
              <p className="text-slate-500">
                {formatCurrency(subscription.plan.amount, subscription.plan.currency || 'usd')}
                /{subscription.plan.interval}
              </p>
            ) : (
              <p className="text-slate-500">No charge</p>
            )}
          </div>
        </div>

        {subscription?.currentPeriodEnd && !subscription.isFreePlan && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4" />
              {subscription.cancelAtPeriodEnd ? (
                <span className="text-red-600">
                  Cancels on {formatDate(subscription.currentPeriodEnd)}
                </span>
              ) : (
                <span>Renews on {formatDate(subscription.currentPeriodEnd)}</span>
              )}
            </div>
          </div>
        )}

        {subscription?.trialEnd && (
          <div className="mt-2">
            <p className="text-sm text-blue-600">
              Trial ends on {formatDate(subscription.trialEnd)}
            </p>
          </div>
        )}

        {/* Cancel/Resume buttons for admins */}
        {isAdmin && !subscription?.isFreePlan && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            {subscription?.cancelAtPeriodEnd ? (
              <button
                onClick={handleResume}
                disabled={resuming}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
              >
                {resuming ? 'Resuming...' : 'Resume subscription'}
              </button>
            ) : (
              <button
                onClick={handleCancel}
                disabled={canceling}
                className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
              >
                {canceling ? 'Canceling...' : 'Cancel subscription'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Usage */}
      {usage && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Current Usage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Meetings */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <TrendingUp className="h-4 w-4" />
                  <span>Meetings this month</span>
                </div>
                <span className="text-sm font-medium text-slate-900">
                  {usage.usage.meetings} / {usage.limits.meetings === -1 ? '∞' : usage.limits.meetings}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${getUsagePercentage(usage.usage.meetings, usage.limits.meetings)}%` }}
                />
              </div>
            </div>

            {/* Storage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <HardDrive className="h-4 w-4" />
                  <span>Storage used</span>
                </div>
                <span className="text-sm font-medium text-slate-900">
                  {formatBytes(usage.usage.storage)} / {usage.limits.storage === -1 ? '∞' : formatBytes(usage.limits.storage)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${getUsagePercentage(usage.usage.storage, usage.limits.storage)}%` }}
                />
              </div>
            </div>

            {/* Team Members */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users className="h-4 w-4" />
                  <span>Team members</span>
                </div>
                <span className="text-sm font-medium text-slate-900">
                  {usage.usage.teamMembers} / {usage.limits.teamMembers === -1 ? '∞' : usage.limits.teamMembers}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${getUsagePercentage(usage.usage.teamMembers, usage.limits.teamMembers)}%` }}
                />
              </div>
            </div>

            {/* Minutes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="h-4 w-4" />
                  <span>Minutes used</span>
                </div>
                <span className="text-sm font-medium text-slate-900">
                  {usage.usage.minutes} min
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${Math.min((usage.usage.minutes / 1000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Available Plans */}
      {isAdmin && plans.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Available Plans</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrentPlan = subscription?.plan?.slug === plan.slug ||
                (subscription?.isFreePlan && plan.slug === 'free');
              const features = Array.isArray(plan.features)
                ? plan.features
                : (typeof plan.features === 'string' ? JSON.parse(plan.features) : []);

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-lg border p-5 ${
                    isCurrentPlan
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {isCurrentPlan && (
                    <span className="absolute -top-3 left-4 bg-primary-500 text-white text-xs font-medium px-2 py-1 rounded">
                      Current Plan
                    </span>
                  )}
                  <h4 className="text-lg font-semibold text-slate-900">{plan.name}</h4>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-slate-900">
                      {plan.amount === 0 ? 'Free' : formatCurrency(plan.amount, plan.currency)}
                    </span>
                    {plan.amount > 0 && (
                      <span className="text-slate-500">/{plan.interval}</span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                  )}
                  <ul className="mt-4 space-y-2">
                    {features.slice(0, 5).map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {!isCurrentPlan && plan.amount > 0 && (
                    <button
                      onClick={() => handleUpgrade(plan.slug)}
                      disabled={!!upgrading}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {upgrading === plan.slug ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <span>Upgrade</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoice History */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Invoice History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 px-4 text-sm text-slate-900">
                      {formatDate(invoice.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-900">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                        invoice.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {invoice.invoiceUrl && (
                        <a
                          href={invoice.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                        >
                          <FileText className="h-4 w-4" />
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No admin warning */}
      {!isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">Limited Access</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Only organization admins can manage billing and subscriptions.
                Contact your admin to upgrade your plan.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
