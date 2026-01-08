'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Play,
  Archive,
  AlertTriangle,
  Shield,
  HardDrive,
  Calendar,
} from 'lucide-react';
import { backupsApi, operationsApi } from '@/lib/api';

interface Backup {
  id: string;
  filename: string;
  size: number;
  type: 'FULL' | 'INCREMENTAL' | 'SCHEDULED' | 'MANUAL' | 'PRE_MIGRATION';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'DELETED';
  storageUrl: string | null;
  checksum: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  createdById: string | null;
  errorMessage: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface LatestBackup {
  backup: Backup;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-500',
  DELETED: 'bg-slate-100 text-slate-400',
};

const typeColors: Record<string, string> = {
  FULL: 'bg-purple-100 text-purple-700',
  INCREMENTAL: 'bg-cyan-100 text-cyan-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  MANUAL: 'bg-orange-100 text-orange-700',
  PRE_MIGRATION: 'bg-pink-100 text-pink-700',
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'FAILED':
      return <XCircle className="w-4 h-4 text-red-600" />;
    case 'IN_PROGRESS':
      return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
    case 'PENDING':
      return <Clock className="w-4 h-4 text-yellow-600" />;
    case 'EXPIRED':
      return <AlertTriangle className="w-4 h-4 text-slate-400" />;
    default:
      return <Database className="w-4 h-4 text-slate-400" />;
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleString();
};

const formatRelativeTime = (date: string): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [latestBackup, setLatestBackup] = useState<Backup | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [storageInfo, setStorageInfo] = useState<{ used: number; total: number } | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: page.toString(), limit: '20' };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const [backupsRes, latestRes] = await Promise.all([
        backupsApi.list(params),
        backupsApi.getLatest(),
      ]);

      if (backupsRes.success && backupsRes.data) {
        const data = backupsRes.data as { data?: Backup[]; backups?: Backup[]; pagination?: Pagination };
        setBackups(data.data || data.backups || []);
        setPagination(data.pagination || null);
      }

      if (latestRes.success && latestRes.data) {
        const data = latestRes.data as LatestBackup;
        setLatestBackup(data.backup);
      }

      // Try to get storage info from system endpoint
      const systemRes = await operationsApi.system();
      if (systemRes.success && systemRes.data) {
        const sysData = systemRes.data as { storage?: { used: number; total: number } };
        if (sysData.storage) {
          setStorageInfo(sysData.storage);
        }
      }
    } catch {
      setError('Failed to fetch backups');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreateBackup = async (type: 'FULL' | 'MANUAL' | 'PRE_MIGRATION') => {
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await backupsApi.create(type);
      if (res.success) {
        setSuccess(`Backup created successfully!`);
        fetchBackups();
      } else {
        setError(res.error?.message || 'Failed to create backup');
      }
    } catch {
      setError('Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    setError(null);
    try {
      const res = await backupsApi.verify(id);
      if (res.success) {
        setSuccess('Backup verified successfully - integrity check passed');
        fetchBackups();
      } else {
        setError(res.error?.message || 'Backup verification failed');
      }
    } catch {
      setError('Failed to verify backup');
    } finally {
      setVerifying(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
      return;
    }
    setError(null);
    try {
      const res = await backupsApi.delete(id);
      if (res.success) {
        setSuccess('Backup deleted successfully');
        fetchBackups();
      } else {
        setError(res.error?.message || 'Failed to delete backup');
      }
    } catch {
      setError('Failed to delete backup');
    }
  };

  const handleCleanup = async () => {
    if (!confirm('This will delete all expired backups. Continue?')) {
      return;
    }
    setError(null);
    try {
      const res = await backupsApi.cleanup();
      if (res.success) {
        const data = res.data as { deletedCount?: number; message?: string };
        setSuccess(data.message || `Cleaned up ${data.deletedCount || 0} expired backups`);
        fetchBackups();
      } else {
        setError(res.error?.message || 'Failed to cleanup backups');
      }
    } catch {
      setError('Failed to cleanup backups');
    }
  };

  const stats = {
    total: pagination?.total || backups.length,
    completed: backups.filter((b) => b.status === 'COMPLETED').length,
    failed: backups.filter((b) => b.status === 'FAILED').length,
    totalSize: backups.reduce((sum, b) => sum + (b.size || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Database Backups</h1>
          <p className="text-slate-500 mt-1">Manage database backups and recovery</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBackups}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleCleanup}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Archive className="w-4 h-4" />
            Cleanup Expired
          </button>
          <button
            onClick={() => handleCreateBackup('MANUAL')}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Create Backup
          </button>
          <Link
            href="/operations"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Back to Operations
          </Link>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">
            &times;
          </button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Backups</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Successful</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <HardDrive className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Size</p>
              <p className="text-2xl font-bold text-purple-600">{formatBytes(stats.totalSize)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Backup Card */}
      {latestBackup && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Latest Successful Backup</h3>
              </div>
              <p className="text-sm text-green-700">{latestBackup.filename}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-green-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(latestBackup.completedAt || latestBackup.startedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive className="w-4 h-4" />
                  {formatBytes(latestBackup.size)}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[latestBackup.type]}`}>
                  {latestBackup.type}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVerify(latestBackup.id)}
                disabled={verifying === latestBackup.id}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 bg-white border border-green-300 rounded-lg hover:bg-green-50 disabled:opacity-50"
              >
                {verifying === latestBackup.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                Verify Integrity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <button
            onClick={() => handleCreateBackup('MANUAL')}
            disabled={creating}
            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 text-left"
          >
            <div className="p-2 bg-orange-100 rounded-lg">
              <Play className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Manual Backup</p>
              <p className="text-sm text-slate-500">Create an on-demand backup now</p>
            </div>
          </button>
          <button
            onClick={() => handleCreateBackup('PRE_MIGRATION')}
            disabled={creating}
            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 text-left"
          >
            <div className="p-2 bg-pink-100 rounded-lg">
              <Database className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Pre-Migration Backup</p>
              <p className="text-sm text-slate-500">Backup before major changes</p>
            </div>
          </button>
          <button
            onClick={() => handleCreateBackup('FULL')}
            disabled={creating}
            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 text-left"
          >
            <div className="p-2 bg-purple-100 rounded-lg">
              <Archive className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Full Backup</p>
              <p className="text-sm text-slate-500">Complete database snapshot</p>
            </div>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Types</option>
          <option value="FULL">Full</option>
          <option value="INCREMENTAL">Incremental</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="MANUAL">Manual</option>
          <option value="PRE_MIGRATION">Pre-Migration</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {/* Backups Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : backups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No backups found</h3>
          <p className="text-slate-500 mb-4">Create your first backup to protect your data</p>
          <button
            onClick={() => handleCreateBackup('MANUAL')}
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            <Database className="w-4 h-4" />
            Create First Backup
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Backup
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={backup.status} />
                      <div>
                        <p className="font-medium text-slate-900 text-sm truncate max-w-[200px]">
                          {backup.filename}
                        </p>
                        {backup.checksum && (
                          <p className="text-xs text-slate-400 font-mono truncate max-w-[200px]">
                            {backup.checksum.substring(0, 16)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[backup.type]}`}>
                      {backup.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[backup.status]}`}>
                      {backup.status}
                    </span>
                    {backup.errorMessage && (
                      <p className="text-xs text-red-500 mt-1 truncate max-w-[150px]" title={backup.errorMessage}>
                        {backup.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatBytes(backup.size)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <span title={formatDate(backup.startedAt)}>
                      {formatRelativeTime(backup.startedAt)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {backup.expiresAt ? (
                      <span title={formatDate(backup.expiresAt)}>
                        {new Date(backup.expiresAt) < new Date() ? (
                          <span className="text-red-500">Expired</span>
                        ) : (
                          formatRelativeTime(backup.expiresAt).replace(' ago', '')
                        )}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {backup.status === 'COMPLETED' && (
                        <>
                          <button
                            onClick={() => handleVerify(backup.id)}
                            disabled={verifying === backup.id}
                            className="p-2 hover:bg-slate-100 rounded-lg"
                            title="Verify Integrity"
                          >
                            {verifying === backup.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                            ) : (
                              <Shield className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                          {backup.storageUrl && (
                            <a
                              href={backup.storageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-slate-100 rounded-lg"
                              title="Download"
                            >
                              <Download className="w-4 h-4 text-slate-500" />
                            </a>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(backup.id)}
                        className="p-2 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, pagination.total)} of{' '}
            {pagination.total} backups
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 border border-slate-200 rounded text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 border border-slate-200 rounded text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
