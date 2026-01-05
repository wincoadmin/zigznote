'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface DataPoint {
  date: string;
  count: number;
}

interface MeetingTrendsChartProps {
  data: DataPoint[];
  isLoading?: boolean;
  title?: string;
}

export function MeetingTrendsChart({
  data,
  isLoading = false,
  title = 'Meeting Trends',
}: MeetingTrendsChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded mb-4" />
        <div className="h-48 bg-slate-100 rounded" />
      </div>
    );
  }

  // Format date for display
  const formattedData = data.map((item) => ({
    ...item,
    displayDate: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  // Calculate total and average
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const average = data.length > 0 ? Math.round(total / data.length * 10) / 10 : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary-500" />
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-slate-500">Total: </span>
            <span className="font-semibold text-slate-900">{total}</span>
          </div>
          <div>
            <span className="text-slate-500">Avg: </span>
            <span className="font-semibold text-slate-900">{average}/day</span>
          </div>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData}>
            <defs>
              <linearGradient id="colorMeetings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              labelStyle={{ color: '#0f172a', fontWeight: 600 }}
              formatter={(value: number) => [`${value} meetings`, 'Meetings']}
              labelFormatter={(label) => label}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#colorMeetings)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
