'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Clock,
  CreditCard,
  RefreshCw,
  Mail,
  Building2,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { billingApi } from '@/lib/api';

interface FailedPayment {
  id: string;
  organization: { id: string; name: string; email: string };
  subscription: { id: string; plan: string };
  amount: number;
  currency: string;
  failureReason: string;
  failedAt: string;
  attemptCount: number;
  nextRetry: string | null;
  gracePeriodEnd: string;
  status: string;
  stripePaymentIntentId: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function FailedPaymentsPage() {
  const [payments, setPayments] = useState<FailedPayment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showExtendModal, setShowExtendModal] = useState<FailedPayment | null>(null);
  const [extendDays, setExtendDays] = useState(7);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, [page]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '20',
      };

      const res = await billingApi.failedPayments(params);

      if (res.success && res.data) {
        const data = res.data as { failedPayments: FailedPayment[]; pagination: Pagination };
        setPayments(data.failedPayments || []);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExtendGrace = async () => {
    if (!showExtendModal) return;

    setActionLoading(true);
    try {
      const res = await billingApi.extendGrace(showExtendModal.id, extendDays);
      if (res.success) {
        fetchPayments();
        setShowExtendModal(null);
        setExtendDays(7);
      }
    } catch (err) {
      console.error('Failed to extend grace period:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysRemaining = (graceEnd: string) => {
    const now = new Date();
    const end = new Date(graceEnd);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getStatusBadge = (payment: FailedPayment) => {
    const daysRemaining = getDaysRemaining(payment.gracePeriodEnd);

    if (daysRemaining <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="w-3 h-3" />
          Grace Expired
        </span>
      );
    }

    if (daysRemaining <= 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
          <Clock className="w-3 h-3" />
          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
        <Clock className="w-3 h-3" />
        {daysRemaining} days left
      </span>
    );
  };

  const getFailureReasonDisplay = (reason: string) => {
    const reasons: Record<string, string> = {
      card_declined: 'Card Declined',
      insufficient_funds: 'Insufficient Funds',
      expired_card: 'Expired Card',
      processing_error: 'Processing Error',
      authentication_required: 'Authentication Required',
      fraudulent: 'Suspected Fraud',
    };
    return reasons[reason] || reason.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Failed Payments</h1>
          <p className="text-slate-500 mt-1">Manage payment failures and dunning</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPayments}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link
            href="/billing"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Back to Billing
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {payments.filter(p => getDaysRemaining(p.gracePeriodEnd) <= 0).length}
              </p>
              <p className="text-sm text-slate-500">Grace Expired</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {payments.filter(p => {
                  const d = getDaysRemaining(p.gracePeriodEnd);
                  return d > 0 && d <= 3;
                }).length}
              </p>
              <p className="text-sm text-slate-500">Expiring Soon</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}
              </p>
              <p className="text-sm text-slate-500">Total At Risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Failure Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Attempts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Grace Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-600 mx-auto" />
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                      <p className="text-slate-900 font-medium">No failed payments</p>
                      <p className="text-slate-500 text-sm">All payments are up to date</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{payment.organization.name}</p>
                          <p className="text-sm text-slate-500">{payment.subscription.plan}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      <p className="text-sm text-slate-500">
                        Failed {formatDate(payment.failedAt)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded bg-red-50 text-red-700">
                        <CreditCard className="w-3 h-3" />
                        {getFailureReasonDisplay(payment.failureReason)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-900">{payment.attemptCount} attempts</p>
                      {payment.nextRetry && (
                        <p className="text-sm text-slate-500">
                          Next: {formatDateTime(payment.nextRetry)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(payment)}
                      <p className="text-xs text-slate-500 mt-1">
                        Ends {formatDate(payment.gracePeriodEnd)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setShowExtendModal(payment)}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                          title="Extend grace period"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <a
                          href={`mailto:${payment.organization.email}?subject=Payment Issue - ${payment.organization.name}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Contact customer"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                        {payment.stripePaymentIntentId && (
                          <a
                            href={`https://dashboard.stripe.com/payments/${payment.stripePaymentIntentId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"
                            title="View in Stripe"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} results
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.totalPages}
                className="p-2 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Extend Grace Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Extend Grace Period</h3>
            <p className="text-slate-600 mb-2">
              Extend grace period for <strong>{showExtendModal.organization.name}</strong>
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Current grace period ends: {formatDate(showExtendModal.gracePeriodEnd)}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Extend by (days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={extendDays}
                onChange={(e) => setExtendDays(parseInt(e.target.value) || 7)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExtendGrace}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {actionLoading ? 'Extending...' : `Extend ${extendDays} days`}
              </button>
              <button
                onClick={() => {
                  setShowExtendModal(null);
                  setExtendDays(7);
                }}
                className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add CheckCircle to imports if missing
function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
