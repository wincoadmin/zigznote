'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  Database,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Loader2,
  HardDrive,
} from 'lucide-react';
import { operationsApi } from '@/lib/api';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
}

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: Record<string, HealthCheck>;
  version: string;
  environment: string;
}

interface SystemData {
  node: {
    version: string;
    platform: string;
    arch: string;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
  environment: string;
  pid: number;
}

interface QueueData {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

interface JobsData {
  queues: QueueData[];
  totalWaiting: number;
  totalActive: number;
  totalFailed: number;
}

const statusColors = {
  healthy: 'text-green-500',
  degraded: 'text-yellow-500',
  unhealthy: 'text-red-500',
};

const statusIcons = {
  healthy: CheckCircle,
  degraded: AlertTriangle,
  unhealthy: XCircle,
};

export default function OperationsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [system, setSystem] = useState<SystemData | null>(null);
  const [jobs, setJobs] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [healthRes, systemRes, jobsRes] = await Promise.all([
        operationsApi.health(),
        operationsApi.system(),
        operationsApi.jobs(),
      ]);

      if (healthRes.success && healthRes.data) {
        setHealth(healthRes.data as HealthData);
      }
      if (systemRes.success && systemRes.data) {
        setSystem(systemRes.data as SystemData);
      }
      if (jobsRes.success && jobsRes.data) {
        setJobs(jobsRes.data as JobsData);
      }
    } catch {
      setError('Failed to fetch operations data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handlePauseQueue = async (queueName: string) => {
    setActionLoading(`pause-${queueName}`);
    try {
      const response = await operationsApi.pauseQueue(queueName);
      if (response.success) {
        fetchData();
      } else {
        setError(response.error?.message || 'Failed to pause queue');
      }
    } catch {
      setError('Failed to pause queue');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeQueue = async (queueName: string) => {
    setActionLoading(`resume-${queueName}`);
    try {
      const response = await operationsApi.resumeQueue(queueName);
      if (response.success) {
        fetchData();
      } else {
        setError(response.error?.message || 'Failed to resume queue');
      }
    } catch {
      setError('Failed to resume queue');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanQueue = async (queueName: string) => {
    if (!confirm(`Are you sure you want to clean failed jobs from ${queueName} queue?`)) return;
    setActionLoading(`clean-${queueName}`);
    try {
      const response = await operationsApi.cleanQueue(queueName, 'failed');
      if (response.success) {
        fetchData();
      } else {
        setError(response.error?.message || 'Failed to clean queue');
      }
    } catch {
      setError('Failed to clean queue');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the entire cache?')) return;
    setActionLoading('clear-cache');
    try {
      const response = await operationsApi.clearCache();
      if (response.success) {
        alert('Cache cleared successfully');
      } else {
        setError(response.error?.message || 'Failed to clear cache');
      }
    } catch {
      setError('Failed to clear cache');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMaintenance = async (task: string) => {
    if (!confirm(`Are you sure you want to run ${task}?`)) return;
    setActionLoading(task);
    try {
      const response = await operationsApi.maintenance([task]);
      if (response.success) {
        const results = response.data as Record<string, { success: boolean; message: string }>;
        const result = results[task];
        alert(result?.message || 'Task completed');
        fetchData();
      } else {
        setError(response.error?.message || 'Failed to run maintenance task');
      }
    } catch {
      setError('Failed to run maintenance task');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operations</h1>
          <p className="text-slate-500 mt-1">
            System health, queues, and maintenance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/operations/backups"
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <HardDrive className="w-4 h-4" />
            Backups
          </Link>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* System Info Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Version</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{health?.version || '-'}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Node.js</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{system?.node?.version || '-'}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Uptime</p>
          <p className="text-lg font-bold text-green-600 mt-1">{system?.uptime?.formatted || '-'}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Memory</p>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {system?.memory ? `${system.memory.heapUsed}MB / ${system.memory.heapTotal}MB` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">RSS Memory</p>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {system?.memory ? `${system.memory.rss}MB` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Environment</p>
          <p className="text-lg font-bold text-blue-600 mt-1 capitalize">{health?.environment || '-'}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Health */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">System Health</h2>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.status === 'healthy'
                    ? 'bg-green-500'
                    : health?.status === 'degraded'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                } animate-pulse`}
              />
              <span className="text-sm text-slate-500 capitalize">{health?.status || 'Unknown'}</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {health?.checks &&
              Object.entries(health.checks).map(([name, check]) => {
                const StatusIcon = statusIcons[check.status];
                return (
                  <div
                    key={name}
                    className="px-6 py-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon
                        className={`w-5 h-5 ${statusColors[check.status]}`}
                      />
                      <span className="font-medium text-slate-900 capitalize">{name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {check.latency !== undefined && (
                        <span className="text-sm font-mono text-slate-600">{check.latency}ms</span>
                      )}
                      {check.error && (
                        <span className="text-sm text-red-600">{check.error}</span>
                      )}
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded capitalize ${
                          check.status === 'healthy'
                            ? 'bg-green-100 text-green-700'
                            : check.status === 'degraded'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {check.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            {!health?.checks && (
              <div className="px-6 py-8 text-center text-slate-500">
                No health checks available
              </div>
            )}
          </div>
        </div>

        {/* Job Queues */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Job Queues</h2>
            {jobs && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-yellow-600">{jobs.totalWaiting} waiting</span>
                <span className="text-blue-600">{jobs.totalActive} active</span>
                {jobs.totalFailed > 0 && (
                  <span className="text-red-600">{jobs.totalFailed} failed</span>
                )}
              </div>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {jobs?.queues?.map((queue) => (
              <div key={queue.name} className="px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-900 capitalize">
                    {queue.name.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePauseQueue(queue.name)}
                      disabled={actionLoading === `pause-${queue.name}`}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-50"
                      title="Pause"
                    >
                      {actionLoading === `pause-${queue.name}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Pause className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    <button
                      onClick={() => handleResumeQueue(queue.name)}
                      disabled={actionLoading === `resume-${queue.name}`}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-50"
                      title="Resume"
                    >
                      {actionLoading === `resume-${queue.name}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    {queue.failed > 0 && (
                      <button
                        onClick={() => handleCleanQueue(queue.name)}
                        disabled={actionLoading === `clean-${queue.name}`}
                        className="p-1 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Clean Failed"
                      >
                        {actionLoading === `clean-${queue.name}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-500" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Waiting</p>
                    <p className="font-medium text-yellow-600">{queue.waiting}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Active</p>
                    <p className="font-medium text-blue-600">{queue.active}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Completed</p>
                    <p className="font-medium text-green-600">{queue.completed.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Failed</p>
                    <p className={`font-medium ${queue.failed > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                      {queue.failed}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {(!jobs?.queues || jobs.queues.length === 0) && (
              <div className="px-6 py-8 text-center text-slate-500">
                No job queues available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Maintenance Actions</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <button
            onClick={handleClearCache}
            disabled={actionLoading === 'clear-cache'}
            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {actionLoading === 'clear-cache' ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            ) : (
              <Trash2 className="w-5 h-5 text-slate-500" />
            )}
            <div className="text-left">
              <p className="font-medium text-slate-900">Clear Cache</p>
              <p className="text-sm text-slate-500">Flush Redis cache</p>
            </div>
          </button>
          <button
            onClick={() => handleMaintenance('vacuum_database')}
            disabled={actionLoading === 'vacuum_database'}
            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {actionLoading === 'vacuum_database' ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            ) : (
              <Database className="w-5 h-5 text-slate-500" />
            )}
            <div className="text-left">
              <p className="font-medium text-slate-900">Vacuum DB</p>
              <p className="text-sm text-slate-500">Optimize database</p>
            </div>
          </button>
          <button
            onClick={() => handleMaintenance('cleanup_sessions')}
            disabled={actionLoading === 'cleanup_sessions'}
            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {actionLoading === 'cleanup_sessions' ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            ) : (
              <Clock className="w-5 h-5 text-slate-500" />
            )}
            <div className="text-left">
              <p className="font-medium text-slate-900">Cleanup Sessions</p>
              <p className="text-sm text-slate-500">Remove expired sessions</p>
            </div>
          </button>
          <button
            onClick={() => handleMaintenance('cleanup_audit_logs')}
            disabled={actionLoading === 'cleanup_audit_logs'}
            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {actionLoading === 'cleanup_audit_logs' ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            ) : (
              <Activity className="w-5 h-5 text-slate-500" />
            )}
            <div className="text-left">
              <p className="font-medium text-slate-900">Cleanup Audit Logs</p>
              <p className="text-sm text-slate-500">Remove old audit logs</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
