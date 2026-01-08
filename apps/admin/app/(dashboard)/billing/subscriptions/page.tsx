'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  XCircle,
  PlayCircle,
  Clock,
  Building2,
} from 'lucide-react';
import { billingApi } from '@/lib/api';

interface Subscription {
  id: string;
  organization: { id: string; name: string };
  plan: { id: string; name: string; slug: string; amount: number; interval: string } | null;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  createdAt: string;
  cancelledAt: string | null;
  mrr: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [showExtendModal, setShowExtendModal] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(7);

  useEffect(() => {
    fetchSubscriptions();
  }, [page, statusFilter]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '20',
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (search) {
        params.search = search;
      }

      const res = await billingApi.subscriptions(params);

      if (res.success && res.data) {
        const data = res.data as { subscriptions: Subscription[]; pagination: Pagination };
        setSubscriptions(data.subscriptions);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSubscriptions();
  };

  const handleCancel = async (id: string, immediately: boolean) => {
    setActionLoading(id);
    try {
      const res = await billingApi.cancelSubscription(id, { immediately });
      if (res.success) {
        fetchSubscriptions();
        setShowCancelModal(null);
      }
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await billingApi.resumeSubscription(id);
      if (res.success) {
        fetchSubscriptions();
      }
    } catch (err) {
      console.error('Failed to resume subscription:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExtendTrial = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await billingApi.extendTrial(id, extendDays);
      if (res.success) {
        fetchSubscriptions();
        setShowExtendModal(null);
        setExtendDays(7);
      }
    } catch (err) {
      console.error('Failed to extend trial:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd && status === 'active') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
          Cancelling
        </span>
      );
    }

    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      trialing: 'bg-purple-100 text-purple-700',
      past_due: 'bg-red-100 text-red-700',
      cancelled: 'bg-slate-100 text-slate-700',
      incomplete: 'bg-yellow-100 text-yellow-700',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subscriptions</h1>
          <p className="text-slate-500 mt-1">Manage all customer subscriptions</p>
        </div>
        <Link
          href="/billing"
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          ← Back to Billing
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </form>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past Due</option>
            <option value="cancelled">Cancelled</option>
          </select>
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
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  MRR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Period End
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
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{sub.organization.name}</p>
                          <p className="text-sm text-slate-500">Since {formatDate(sub.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{sub.plan?.name || 'No plan'}</p>
                      {sub.plan && (
                        <p className="text-sm text-slate-500">
                          {formatCurrency(sub.plan.amount / 100)}/{sub.plan.interval}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(sub.status, sub.cancelAtPeriodEnd)}
                      {sub.trialEnd && sub.status === 'trialing' && (
                        <p className="text-xs text-slate-500 mt-1">
                          Trial ends {formatDate(sub.trialEnd)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{formatCurrency(sub.mrr)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-900">{formatDate(sub.currentPeriodEnd)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {sub.status === 'trialing' && (
                          <button
                            onClick={() => setShowExtendModal(sub.id)}
                            className="p-1 text-slate-400 hover:text-purple-600"
                            title="Extend trial"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        {sub.cancelAtPeriodEnd && sub.status === 'active' ? (
                          <button
                            onClick={() => handleResume(sub.id)}
                            disabled={actionLoading === sub.id}
                            className="p-1 text-slate-400 hover:text-green-600"
                            title="Resume subscription"
                          >
                            {actionLoading === sub.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PlayCircle className="w-4 h-4" />
                            )}
                          </button>
                        ) : sub.status === 'active' || sub.status === 'trialing' ? (
                          <button
                            onClick={() => setShowCancelModal(sub.id)}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Cancel subscription"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        ) : null}
                        <button className="p-1 text-slate-400 hover:text-slate-600">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
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

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Cancel Subscription</h3>
            <p className="text-slate-600 mb-6">
              How would you like to cancel this subscription?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleCancel(showCancelModal, false)}
                disabled={actionLoading === showCancelModal}
                className="w-full px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100"
              >
                Cancel at period end
              </button>
              <button
                onClick={() => handleCancel(showCancelModal, true)}
                disabled={actionLoading === showCancelModal}
                className="w-full px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100"
              >
                Cancel immediately
              </button>
              <button
                onClick={() => setShowCancelModal(null)}
                className="w-full px-4 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Never mind
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Trial Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Extend Trial</h3>
            <p className="text-slate-600 mb-4">
              How many days would you like to extend the trial?
            </p>
            <input
              type="number"
              min="1"
              max="90"
              value={extendDays}
              onChange={(e) => setExtendDays(parseInt(e.target.value) || 7)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleExtendTrial(showExtendModal)}
                disabled={actionLoading === showExtendModal}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {actionLoading === showExtendModal ? 'Extending...' : `Extend ${extendDays} days`}
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
