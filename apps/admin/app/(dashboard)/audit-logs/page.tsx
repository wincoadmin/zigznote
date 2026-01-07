'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
} from 'lucide-react';
import { auditLogsApi } from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  adminUserId?: string;
  adminUser?: {
    id: string;
    name: string;
    email: string;
  };
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const entityIcons: Record<string, React.ElementType> = {
  user: User,
  organization: Building2,
  system_api_key: Key,
  api_key: Key,
  feature_flag: Settings,
  admin: Shield,
  security: Shield,
  admin_user: Shield,
  cache: Settings,
  system: Settings,
  job_queue: Settings,
  platform_integration: Key,
  audit_log: Shield,
};

const actionColors: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
  toggled: 'bg-yellow-100 text-yellow-700',
  rotated: 'bg-purple-100 text-purple-700',
  login: 'bg-slate-100 text-slate-700',
  logout: 'bg-slate-100 text-slate-700',
  billing_override: 'bg-orange-100 text-orange-700',
  impersonated: 'bg-pink-100 text-pink-700',
  suspended: 'bg-red-100 text-red-700',
  restored: 'bg-green-100 text-green-700',
  exported: 'bg-blue-100 text-blue-700',
  configured: 'bg-purple-100 text-purple-700',
};

function getActionColor(action: string): string {
  const actionType = action.split('.').pop() || action;
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

function formatDetails(details: Record<string, unknown> | undefined): string {
  if (!details) return '';
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('all');
  const [page, setPage] = useState(1);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '50',
      };
      if (selectedEntityType !== 'all') params.entityType = selectedEntityType;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate).toISOString();

      const response = await auditLogsApi.list(params);
      if (response.success && response.data) {
        const responseData = response.data;
        if (Array.isArray(responseData)) {
          setLogs(responseData as AuditLog[]);
          setPagination(null);
        } else {
          const data = responseData as { data?: AuditLog[]; pagination?: Pagination };
          setLogs(data.data || []);
          setPagination(data.pagination || null);
        }
      } else {
        setError(response.error?.message || 'Failed to fetch audit logs');
      }
    } catch {
      setError('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, selectedEntityType, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      setError('Please select a date range to export');
      return;
    }
    setExporting(true);
    try {
      const params: Record<string, string> = {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      };
      if (selectedEntityType !== 'all') params.entityType = selectedEntityType;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/audit-logs/export?${new URLSearchParams(params)}`,
        { credentials: 'include' }
      );
      const data = await response.json();

      if (data.success) {
        // Create and download CSV
        const logs = data.data as AuditLog[];
        const csv = [
          ['ID', 'Action', 'Entity Type', 'Entity ID', 'Admin', 'IP Address', 'Details', 'Created At'],
          ...logs.map((log) => [
            log.id,
            log.action,
            log.entityType,
            log.entityId || '',
            log.adminUser?.email || log.adminUserId || '',
            log.ipAddress || '',
            formatDetails(log.details),
            log.createdAt,
          ]),
        ]
          .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${startDate}-to-${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setError(data.error?.message || 'Failed to export audit logs');
      }
    } catch {
      setError('Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      log.entityType.toLowerCase().includes(query) ||
      log.entityId?.toLowerCase().includes(query) ||
      log.adminUser?.name?.toLowerCase().includes(query) ||
      log.adminUser?.email?.toLowerCase().includes(query) ||
      formatDetails(log.details).toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-slate-500 mt-1">
            Track all admin actions and changes
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || !startDate || !endDate}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 relative min-w-64">
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
          value={selectedEntityType}
          onChange={(e) => {
            setSelectedEntityType(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Entity Types</option>
          <option value="user">User</option>
          <option value="organization">Organization</option>
          <option value="feature_flag">Feature Flag</option>
          <option value="api_key">API Key</option>
          <option value="admin_user">Admin User</option>
          <option value="platform_integration">Platform Integration</option>
          <option value="system">System</option>
        </select>
        <button
          onClick={() => setShowDateFilter(!showDateFilter)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-slate-50 ${
            showDateFilter || startDate || endDate
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Date Range
        </button>
      </div>

      {/* Date Filter Panel */}
      {showDateFilter && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="mt-6 p-2 text-slate-500 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

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
          {/* Logs List */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-500">
                  No audit logs found
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const Icon = entityIcons[log.entityType] || Shield;
                  return (
                    <div key={log.id} className="px-6 py-4 hover:bg-slate-50">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${getActionColor(log.action)}`}
                            >
                              {log.action}
                            </span>
                            <span className="text-sm text-slate-500">by</span>
                            <span className="text-sm font-medium text-slate-900">
                              {log.adminUser?.name || log.adminUser?.email || log.adminUserId || 'System'}
                            </span>
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <p className="text-sm text-slate-600 mt-1 truncate max-w-xl">
                              {formatDetails(log.details)}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(log.createdAt)}
                            </span>
                            {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                            {log.entityId && (
                              <span className="font-mono">
                                {log.entityType}: {log.entityId.substring(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination */}
            {pagination && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, pagination.total)} of{' '}
                  {pagination.total} entries
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="p-2 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-4 py-2 text-sm">
                    Page {page} of {pagination.totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= (pagination.totalPages || 1)}
                    className="p-2 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
