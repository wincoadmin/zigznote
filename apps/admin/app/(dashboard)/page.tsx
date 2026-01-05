'use client';

import {
  Users,
  Building2,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// Placeholder stats - will be replaced with real data
const stats = [
  {
    name: 'Total Users',
    value: '12,847',
    change: '+12.5%',
    changeType: 'positive',
    icon: Users,
  },
  {
    name: 'Organizations',
    value: '1,234',
    change: '+8.2%',
    changeType: 'positive',
    icon: Building2,
  },
  {
    name: 'Active Meetings',
    value: '156',
    change: '-2.4%',
    changeType: 'negative',
    icon: Activity,
  },
  {
    name: 'MRR',
    value: '$48,392',
    change: '+15.3%',
    changeType: 'positive',
    icon: TrendingUp,
  },
];

const recentActivity = [
  {
    id: 1,
    type: 'user.created',
    message: 'New user registered',
    details: 'john@example.com',
    time: '2 minutes ago',
    icon: Users,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    id: 2,
    type: 'subscription.upgraded',
    message: 'Subscription upgraded',
    details: 'Acme Corp - Pro to Enterprise',
    time: '15 minutes ago',
    icon: TrendingUp,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    id: 3,
    type: 'system.warning',
    message: 'High API latency detected',
    details: 'Deepgram service',
    time: '1 hour ago',
    icon: AlertTriangle,
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
  },
  {
    id: 4,
    type: 'job.completed',
    message: 'Bulk transcription completed',
    details: '50 meetings processed',
    time: '2 hours ago',
    icon: CheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
];

const systemHealth = [
  { name: 'API', status: 'healthy', latency: '45ms' },
  { name: 'Database', status: 'healthy', latency: '12ms' },
  { name: 'Redis', status: 'healthy', latency: '3ms' },
  { name: 'Transcription Queue', status: 'degraded', latency: '2.3s' },
  { name: 'Summarization Queue', status: 'healthy', latency: '890ms' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Welcome to the zigznote admin panel
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    stat.changeType === 'positive'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {stat.changeType === 'positive' ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {stat.change}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.name}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentActivity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="px-6 py-4 flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${item.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {item.message}
                    </p>
                    <p className="text-sm text-slate-500 truncate">
                      {item.details}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {item.time}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">System Health</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {systemHealth.map((service) => (
              <div
                key={service.name}
                className="px-6 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      service.status === 'healthy'
                        ? 'bg-green-500'
                        : service.status === 'degraded'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm font-medium text-slate-900">
                    {service.name}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      service.status === 'healthy'
                        ? 'bg-green-100 text-green-700'
                        : service.status === 'degraded'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {service.status}
                  </span>
                  <span className="text-sm text-slate-500 font-mono">
                    {service.latency}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
