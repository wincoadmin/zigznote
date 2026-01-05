'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  Building2,
  Users,
  Eye,
  Edit,
  CreditCard,
  Ban,
} from 'lucide-react';

// Placeholder data
const organizations = [
  {
    id: '1',
    name: 'Acme Corp',
    plan: 'enterprise',
    accountType: 'REGULAR',
    userCount: 45,
    meetingCount: 1234,
    status: 'active',
    createdAt: '2024-01-15',
    mrr: '$499',
  },
  {
    id: '2',
    name: 'TechStart',
    plan: 'pro',
    accountType: 'TRIAL',
    userCount: 12,
    meetingCount: 89,
    status: 'active',
    createdAt: '2024-02-10',
    mrr: '$99',
  },
  {
    id: '3',
    name: 'DevTeam Inc',
    plan: 'free',
    accountType: 'COMPLIMENTARY',
    userCount: 5,
    meetingCount: 23,
    status: 'suspended',
    createdAt: '2024-01-20',
    mrr: '$0',
  },
];

const planColors: Record<string, string> = {
  free: 'bg-slate-100 text-slate-700',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('all');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
          <p className="text-slate-500 mt-1">
            Manage organizations and billing
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Organizations</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{organizations.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {organizations.filter((o) => o.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">On Trial</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">
            {organizations.filter((o) => o.accountType === 'TRIAL').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total MRR</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">$598</p>
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
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  Organization
                </th>
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  Plan
                </th>
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  Account Type
                </th>
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  Users
                </th>
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  Status
                </th>
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  MRR
                </th>
                <th className="text-right text-sm font-medium text-slate-500 px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{org.name}</p>
                        <p className="text-sm text-slate-500">
                          {org.meetingCount} meetings
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${planColors[org.plan]}`}
                    >
                      {org.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${accountTypeColors[org.accountType]}`}
                    >
                      {org.accountType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <Users className="w-4 h-4" />
                      {org.userCount}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        org.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {org.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {org.mrr}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-slate-100 rounded-lg" title="View">
                        <Eye className="w-4 h-4 text-slate-500" />
                      </button>
                      <button className="p-2 hover:bg-slate-100 rounded-lg" title="Edit">
                        <Edit className="w-4 h-4 text-slate-500" />
                      </button>
                      <button className="p-2 hover:bg-slate-100 rounded-lg" title="Billing Override">
                        <CreditCard className="w-4 h-4 text-slate-500" />
                      </button>
                      <button className="p-2 hover:bg-slate-100 rounded-lg" title="Suspend">
                        <Ban className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing 1 to {organizations.length} of {organizations.length} organizations
          </p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border border-slate-200 rounded text-sm hover:bg-slate-50 disabled:opacity-50" disabled>
              Previous
            </button>
            <button className="px-3 py-1 border border-slate-200 rounded text-sm hover:bg-slate-50 disabled:opacity-50" disabled>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
