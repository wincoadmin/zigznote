'use client';

import {
  Activity,
  Server,
  Database,
  HardDrive,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';

// Placeholder data
const systemHealth = [
  { name: 'API Server', status: 'healthy', latency: '45ms', uptime: '99.99%' },
  { name: 'Database', status: 'healthy', latency: '12ms', uptime: '99.97%' },
  { name: 'Redis Cache', status: 'healthy', latency: '3ms', uptime: '100%' },
  { name: 'Transcription Service', status: 'degraded', latency: '2.3s', uptime: '98.5%' },
  { name: 'Summarization Service', status: 'healthy', latency: '890ms', uptime: '99.9%' },
];

const queues = [
  { name: 'transcription', waiting: 12, active: 3, completed: 4521, failed: 2 },
  { name: 'summarization', waiting: 5, active: 2, completed: 3892, failed: 0 },
  { name: 'webhook', waiting: 0, active: 0, completed: 12847, failed: 15 },
  { name: 'calendar_sync', waiting: 45, active: 5, completed: 8923, failed: 8 },
];

const systemInfo = {
  version: '0.1.0',
  nodeVersion: '20.10.0',
  uptime: '5d 12h 34m',
  memoryUsed: '512MB',
  memoryTotal: '2048MB',
  cpuUsage: '23%',
};

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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operations</h1>
          <p className="text-slate-500 mt-1">
            System health, queues, and maintenance
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* System Info Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Version</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{systemInfo.version}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Node.js</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{systemInfo.nodeVersion}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Uptime</p>
          <p className="text-lg font-bold text-green-600 mt-1">{systemInfo.uptime}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Memory</p>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {systemInfo.memoryUsed} / {systemInfo.memoryTotal}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">CPU</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{systemInfo.cpuUsage}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Environment</p>
          <p className="text-lg font-bold text-blue-600 mt-1">Production</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Health */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">System Health</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-slate-500">Live</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {systemHealth.map((service) => {
              const StatusIcon = statusIcons[service.status as keyof typeof statusIcons];
              return (
                <div
                  key={service.name}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon
                      className={`w-5 h-5 ${statusColors[service.status as keyof typeof statusColors]}`}
                    />
                    <span className="font-medium text-slate-900">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500">{service.uptime}</span>
                    <span className="text-sm font-mono text-slate-600">{service.latency}</span>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded capitalize ${
                        service.status === 'healthy'
                          ? 'bg-green-100 text-green-700'
                          : service.status === 'degraded'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {service.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Job Queues */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Job Queues</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {queues.map((queue) => (
              <div key={queue.name} className="px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-900 capitalize">
                    {queue.name.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="p-1 hover:bg-slate-100 rounded" title="Pause">
                      <Pause className="w-4 h-4 text-slate-500" />
                    </button>
                    <button className="p-1 hover:bg-slate-100 rounded" title="Clean Failed">
                      <Trash2 className="w-4 h-4 text-slate-500" />
                    </button>
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
          </div>
        </div>
      </div>

      {/* Maintenance Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Maintenance Actions</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <button className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <Trash2 className="w-5 h-5 text-slate-500" />
            <div className="text-left">
              <p className="font-medium text-slate-900">Clear Cache</p>
              <p className="text-sm text-slate-500">Flush Redis cache</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <Database className="w-5 h-5 text-slate-500" />
            <div className="text-left">
              <p className="font-medium text-slate-900">Vacuum DB</p>
              <p className="text-sm text-slate-500">Optimize database</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <Clock className="w-5 h-5 text-slate-500" />
            <div className="text-left">
              <p className="font-medium text-slate-900">Cleanup Sessions</p>
              <p className="text-sm text-slate-500">Remove expired sessions</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <Activity className="w-5 h-5 text-slate-500" />
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
