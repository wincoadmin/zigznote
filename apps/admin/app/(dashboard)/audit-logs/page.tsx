'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  Clock,
  User,
  Building2,
  Key,
  Settings,
  Shield,
} from 'lucide-react';

// Placeholder data
const auditLogs = [
  {
    id: '1',
    action: 'user.updated',
    adminName: 'John Admin',
    adminEmail: 'john@admin.com',
    entityType: 'user',
    entityId: 'usr_123',
    details: 'Changed role from member to admin',
    ipAddress: '192.168.1.1',
    createdAt: '2024-03-05T10:30:00Z',
  },
  {
    id: '2',
    action: 'organization.billing_override',
    adminName: 'Jane Admin',
    adminEmail: 'jane@admin.com',
    entityType: 'organization',
    entityId: 'org_456',
    details: 'Set account type to COMPLIMENTARY',
    ipAddress: '192.168.1.2',
    createdAt: '2024-03-05T09:15:00Z',
  },
  {
    id: '3',
    action: 'feature_flag.toggled',
    adminName: 'John Admin',
    adminEmail: 'john@admin.com',
    entityType: 'feature_flag',
    entityId: 'ff_789',
    details: 'Enabled new_dashboard flag',
    ipAddress: '192.168.1.1',
    createdAt: '2024-03-05T08:45:00Z',
  },
  {
    id: '4',
    action: 'system_api_key.rotated',
    adminName: 'Jane Admin',
    adminEmail: 'jane@admin.com',
    entityType: 'system_api_key',
    entityId: 'key_101',
    details: 'Rotated Deepgram production key',
    ipAddress: '192.168.1.2',
    createdAt: '2024-03-04T16:30:00Z',
  },
  {
    id: '5',
    action: 'admin.login',
    adminName: 'John Admin',
    adminEmail: 'john@admin.com',
    entityType: 'admin',
    entityId: 'adm_123',
    details: 'Successful login',
    ipAddress: '192.168.1.1',
    createdAt: '2024-03-04T08:00:00Z',
  },
];

const entityIcons: Record<string, React.ElementType> = {
  user: User,
  organization: Building2,
  system_api_key: Key,
  feature_flag: Settings,
  admin: Shield,
  security: Shield,
};

const actionColors: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
  toggled: 'bg-yellow-100 text-yellow-700',
  rotated: 'bg-purple-100 text-purple-700',
  login: 'bg-slate-100 text-slate-700',
  billing_override: 'bg-orange-100 text-orange-700',
};

function getActionColor(action: string): string {
  const actionType = action.split('.')[1] || action;
  return actionColors[actionType] || 'bg-slate-100 text-slate-700';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-slate-500 mt-1">
            Track all admin actions and changes
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Actions</option>
          <option value="user">User Actions</option>
          <option value="organization">Organization Actions</option>
          <option value="feature_flag">Feature Flag Actions</option>
          <option value="system_api_key">API Key Actions</option>
          <option value="admin">Admin Actions</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <Filter className="w-4 h-4" />
          Date Range
        </button>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="divide-y divide-slate-100">
          {auditLogs.map((log) => {
            const Icon = entityIcons[log.entityType] || Shield;
            return (
              <div key={log.id} className="px-6 py-4 hover:bg-slate-50">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${getActionColor(log.action)}`}
                      >
                        {log.action}
                      </span>
                      <span className="text-sm text-slate-500">by</span>
                      <span className="text-sm font-medium text-slate-900">
                        {log.adminName}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{log.details}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(log.createdAt)}
                      </span>
                      <span>IP: {log.ipAddress}</span>
                      <span className="font-mono">Entity: {log.entityId}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing 1 to {auditLogs.length} of {auditLogs.length} entries
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
