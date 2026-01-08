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
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { billingApi } from '@/lib/api';

interface Invoice {
  id: string;
  organization: { id: string; name: string };
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt: string | null;
  invoiceNumber: string;
  stripeInvoiceId: string | null;
  stripeInvoiceUrl: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showRefundModal, setShowRefundModal] = useState<Invoice | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, [page, statusFilter]);

  const fetchInvoices = async () => {
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

      const res = await billingApi.invoices(params);

      if (res.success && res.data) {
        const data = res.data as { invoices: Invoice[]; pagination: Pagination };
        setInvoices(data.invoices);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  const handleRefund = async () => {
    if (!showRefundModal) return;

    setActionLoading(true);
    try {
      const res = await billingApi.refund({
        paymentId: showRefundModal.id,
        amount: refundAmount ? parseFloat(refundAmount) * 100 : undefined,
        reason: refundReason || undefined,
      });

      if (res.success) {
        fetchInvoices();
        setShowRefundModal(null);
        setRefundAmount('');
        setRefundReason('');
      }
    } catch (err) {
      console.error('Failed to process refund:', err);
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
      paid: { bg: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
      open: { bg: 'bg-blue-100 text-blue-700', icon: <Clock className="w-3 h-3" /> },
      draft: { bg: 'bg-slate-100 text-slate-700', icon: <Clock className="w-3 h-3" /> },
      uncollectible: { bg: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
      void: { bg: 'bg-slate-100 text-slate-500', icon: <XCircle className="w-3 h-3" /> },
      past_due: { bg: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="w-3 h-3" /> },
    };

    const style = styles[status] || styles.draft;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${style.bg}`}>
        {style.icon}
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 mt-1">View and manage all customer invoices</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchInvoices}
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by organization or invoice number..."
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
            <option value="paid">Paid</option>
            <option value="open">Open</option>
            <option value="past_due">Past Due</option>
            <option value="uncollectible">Uncollectible</option>
            <option value="void">Void</option>
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
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
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
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-slate-500">{formatDate(invoice.createdAt)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-slate-600" />
                        </div>
                        <p className="font-medium text-slate-900">{invoice.organization.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(invoice.status)}
                      {invoice.paidAt && (
                        <p className="text-xs text-slate-500 mt-1">
                          Paid {formatDate(invoice.paidAt)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-900">Due: {formatDate(invoice.dueDate)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.stripeInvoiceUrl && (
                          <a
                            href={invoice.stripeInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-primary-600"
                            title="View in Stripe"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          className="p-1 text-slate-400 hover:text-slate-600"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {invoice.status === 'paid' && (
                          <button
                            onClick={() => {
                              setShowRefundModal(invoice);
                              setRefundAmount((invoice.amount / 100).toString());
                            }}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Refund"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
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

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Process Refund</h3>
            <p className="text-slate-600 mb-4">
              Refund for invoice <strong>{showRefundModal.invoiceNumber}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount ({showRefundModal.currency.toUpperCase()})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  max={showRefundModal.amount / 100}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Full amount if empty"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Max: {formatCurrency(showRefundModal.amount, showRefundModal.currency)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Reason for refund..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleRefund}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Process Refund'}
              </button>
              <button
                onClick={() => {
                  setShowRefundModal(null);
                  setRefundAmount('');
                  setRefundReason('');
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
