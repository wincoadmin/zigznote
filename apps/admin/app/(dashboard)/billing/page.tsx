'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { billingApi } from '@/lib/api';

interface BillingStats {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  newThisMonth: number;
  churnedThisMonth: number;
  churnRate: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowth: number;
  failedPayments: number;
  trialConversionRate: number;
  subscriptionsByStatus: Record<string, number>;
}

interface RevenueDataPoint {
  month: string;
  revenue: number;
  subscriptions: number;
}

interface ActivityItem {
  type: string;
  organization: string;
  amount?: number;
  plan?: string;
  date: string;
}

export default function BillingOverviewPage() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsRes, chartRes, activityRes] = await Promise.all([
        billingApi.stats(),
        billingApi.revenueChart(),
        billingApi.recentActivity(),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data as BillingStats);
      }

      if (chartRes.success && chartRes.data) {
        setRevenueData((chartRes.data as { data: RevenueDataPoint[] }).data || []);
      }

      if (activityRes.success && activityRes.data) {
        setActivity((activityRes.data as { activity: ActivityItem[] }).activity || []);
      }
    } catch (err) {
      setError('Failed to load billing data');
    } finally {
      setLoading(false);
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <DollarSign className="w-4 h-4 text-green-600" />;
      case 'subscription_started':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'trial_started':
        return <Clock className="w-4 h-4 text-purple-600" />;
      case 'cancellation':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <CreditCard className="w-4 h-4 text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchData}
          className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const statCards = [
    {
      name: 'MRR',
      value: formatCurrency(stats?.mrr || 0),
      subValue: `ARR: ${formatCurrency(stats?.arr || 0)}`,
      icon: DollarSign,
      color: 'bg-green-100 text-green-600',
    },
    {
      name: 'Active Subscriptions',
      value: stats?.activeSubscriptions || 0,
      subValue: `${stats?.trialingSubscriptions || 0} in trial`,
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      name: 'Revenue Growth',
      value: `${stats?.revenueGrowth || 0}%`,
      subValue: `vs last month`,
      icon: TrendingUp,
      color: stats?.revenueGrowth && stats.revenueGrowth >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600',
      change: stats?.revenueGrowth || 0,
    },
    {
      name: 'Failed Payments',
      value: stats?.failedPayments || 0,
      subValue: 'Needs attention',
      icon: AlertTriangle,
      color: stats?.failedPayments ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600',
      link: '/billing/failed-payments',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
          <p className="text-slate-500 mt-1">Revenue and subscription management</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const content = (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {stat.change !== undefined && (
                  <div className={`flex items-center gap-1 text-sm font-medium ${stat.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Math.abs(stat.change)}%
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.name}</p>
                <p className="text-xs text-slate-400 mt-1">{stat.subValue}</p>
              </div>
            </div>
          );

          return stat.link ? (
            <Link key={stat.name} href={stat.link}>
              {content}
            </Link>
          ) : (
            <div key={stat.name}>{content}</div>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link
          href="/billing/subscriptions"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <Users className="w-5 h-5 text-primary-600" />
          <div>
            <p className="font-medium text-slate-900">Subscriptions</p>
            <p className="text-sm text-slate-500">Manage customer subscriptions</p>
          </div>
        </Link>
        <Link
          href="/billing/invoices"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <CreditCard className="w-5 h-5 text-primary-600" />
          <div>
            <p className="font-medium text-slate-900">Invoices</p>
            <p className="text-sm text-slate-500">View all invoices</p>
          </div>
        </Link>
        <Link
          href="/billing/plans"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <DollarSign className="w-5 h-5 text-primary-600" />
          <div>
            <p className="font-medium text-slate-900">Plans</p>
            <p className="text-sm text-slate-500">Manage pricing tiers</p>
          </div>
        </Link>
        <Link
          href="/billing/failed-payments"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-colors"
        >
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <div>
            <p className="font-medium text-slate-900">Failed Payments</p>
            <p className="text-sm text-slate-500">{stats?.failedPayments || 0} pending</p>
          </div>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Revenue (Last 12 Months)</h2>
          </div>
          <div className="p-6">
            {revenueData.length > 0 ? (
              <div className="space-y-3">
                {revenueData.slice(-6).map((item) => (
                  <div key={item.month} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{item.month}</span>
                    <div className="flex items-center gap-4">
                      <div className="w-32 bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min((item.revenue / (Math.max(...revenueData.map(d => d.revenue)) || 1)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-900 w-24 text-right">
                        {formatCurrency(item.revenue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No revenue data available</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {activity.length > 0 ? (
              activity.slice(0, 8).map((item, index) => (
                <div key={index} className="px-6 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    {getActivityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {item.organization}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.type === 'payment' && item.amount
                        ? `Paid ${formatCurrency(item.amount)}`
                        : item.type === 'cancellation'
                          ? 'Cancelled subscription'
                          : item.type === 'trial_started'
                            ? `Started trial - ${item.plan}`
                            : `Subscribed to ${item.plan}`}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {item.date ? formatDate(item.date) : ''}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-center py-8">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Key Metrics</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6">
          <div>
            <p className="text-sm text-slate-500">Revenue This Month</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(stats?.revenueThisMonth || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Revenue Last Month</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(stats?.revenueLastMonth || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">New This Month</p>
            <p className="text-xl font-bold text-slate-900">{stats?.newThisMonth || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Churned This Month</p>
            <p className="text-xl font-bold text-slate-900">{stats?.churnedThisMonth || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Churn Rate</p>
            <p className="text-xl font-bold text-slate-900">{(stats?.churnRate || 0).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Trial Conversion</p>
            <p className="text-xl font-bold text-slate-900">{stats?.trialConversionRate || 0}%</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Active Trials</p>
            <p className="text-xl font-bold text-slate-900">{stats?.trialingSubscriptions || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Past Due</p>
            <p className="text-xl font-bold text-red-600">{stats?.failedPayments || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
