'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Building2,
  Users,
  Eye,
  CreditCard,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Ban,
  CheckCircle,
} from 'lucide-react';
import { organizationsApi } from '@/lib/api';

interface OrgData {
  id: string;
  name: string;
  plan: string;
  accountType: string;
  _count?: {
    users: number;
    meetings: number;
  };
  userCount?: number;
  meetingCount?: number;
  deletedAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const planColors: Record<string, string> = {
  free: 'bg-slate-100 text-slate-700',
  starter: 'bg-green-100 text-green-700',
  pro: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
};

const accountTypeColors: Record<string, string> = {
  REGULAR: 'bg-slate-100 text-slate-700',
  TRIAL: 'bg-yellow-100 text-yellow-700',
  COMPLIMENTARY: 'bg-green-100 text-green-700',
  PARTNER: 'bg-blue-100 text-blue-700',
  INTERNAL: 'bg-purple-100 text-purple-700',
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrgData[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('all');
  const [page, setPage] = useState(1);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [billingModalOpen, setBillingModalOpen] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '20',
      };
      if (searchQuery) params.search = searchQuery;
      if (selectedPlan !== 'all') params.plan = selectedPlan;

      const response = await organizationsApi.list(params);
      if (response.success && response.data) {
        const responseData = response.data;
        if (Array.isArray(responseData)) {
          setOrganizations(responseData as OrgData[]);
          setPagination(null);
        } else {
          const data = responseData as { data?: OrgData[]; pagination?: Pagination };
          setOrganizations(data.data || []);
          setPagination(data.pagination || null);
        }
      } else {
        setError(response.error?.message || 'Failed to fetch organizations');
      }
    } catch {
      setError('Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedPlan]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    const handleClickOutside = () => setActionMenuOpen(null);
    if (actionMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [actionMenuOpen]);

  const handleBillingOverride = async (orgId: string, accountType: string, reason: string) => {
    try {
      const response = await organizationsApi.setBillingOverride(orgId, { accountType, reason });
      if (response.success) {
        fetchOrganizations();
        setBillingModalOpen(null);
      }
    } catch {
      setError('Failed to set billing override');
    }
  };

  const stats = {
    total: pagination?.total || organizations.length,
    active: organizations.filter((o) => !o.deletedAt).length,
    trial: organizations.filter((o) => o.accountType === 'TRIAL').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
          <p className="text-slate-500 mt-1">Manage organizations and billing</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Organizations</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">On Trial</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.trial}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Users</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {organizations.reduce((sum, o) => sum + (o._count?.users || o.userCount || 0), 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={selectedPlan}
          onChange={(e) => {
            setSelectedPlan(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
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
                    Account Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No organizations found
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{org.name}</p>
                            <p className="text-sm text-slate-500">
                              {org._count?.meetings || org.meetingCount || 0} meetings
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${planColors[org.plan] || 'bg-slate-100 text-slate-700'}`}
                        >
                          {org.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${accountTypeColors[org.accountType] || 'bg-slate-100 text-slate-700'}`}
                        >
                          {org.accountType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Users className="w-4 h-4" />
                          {org._count?.users || org.userCount || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {org.deletedAt ? (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-700">
                            Suspended
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuOpen(actionMenuOpen === org.id ? null : org.id);
                            }}
                            className="p-2 hover:bg-slate-100 rounded-lg"
                          >
                            <MoreVertical className="w-4 h-4 text-slate-500" />
                          </button>
                          {actionMenuOpen === org.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                              <button
                                onClick={() => {/* View details */}}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                View Details
                              </button>
                              <button
                                onClick={() => {
                                  setBillingModalOpen(org.id);
                                  setActionMenuOpen(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <CreditCard className="w-4 h-4" />
                                Billing Override
                              </button>
                              {org.deletedAt ? (
                                <button
                                  onClick={() => {/* Restore org */}}
                                  className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Restore
                                </button>
                              ) : (
                                <button
                                  onClick={() => {/* Suspend org */}}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Ban className="w-4 h-4" />
                                  Suspend
                                </button>
                              )}
                            </div>
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, pagination.total)} of{' '}
                {pagination.total} organizations
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 text-sm">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Billing Override Modal */}
      {billingModalOpen && (
        <BillingOverrideModal
          orgId={billingModalOpen}
          onClose={() => setBillingModalOpen(null)}
          onSave={handleBillingOverride}
        />
      )}
    </div>
  );
}

function BillingOverrideModal({
  orgId,
  onClose,
  onSave,
}: {
  orgId: string;
  onClose: () => void;
  onSave: (orgId: string, accountType: string, reason: string) => void;
}) {
  const [accountType, setAccountType] = useState('COMPLIMENTARY');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason');
      return;
    }
    setSaving(true);
    await onSave(orgId, accountType, reason);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Set Billing Override</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Account Type
            </label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="REGULAR">Regular</option>
              <option value="TRIAL">Trial</option>
              <option value="COMPLIMENTARY">Complimentary</option>
              <option value="PARTNER">Partner</option>
              <option value="INTERNAL">Internal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this override is being applied..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !reason.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Apply Override'}
          </button>
        </div>
      </div>
    </div>
  );
}
