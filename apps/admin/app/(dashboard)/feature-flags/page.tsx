'use client';

import { useState } from 'react';
import {
  Search,
  Plus,
  ToggleLeft,
  ToggleRight,
  Edit,
  Trash2,
  Percent,
} from 'lucide-react';

// Placeholder data
const featureFlags = [
  {
    id: '1',
    key: 'new_dashboard',
    name: 'New Dashboard UI',
    description: 'Enable the redesigned dashboard interface',
    enabled: true,
    percentage: 100,
    category: 'ui',
    targetRules: [],
    updatedAt: '2024-03-01',
  },
  {
    id: '2',
    key: 'ai_summaries_v2',
    name: 'AI Summaries V2',
    description: 'Use the new AI summarization model',
    enabled: true,
    percentage: 50,
    category: 'ai',
    targetRules: [{ type: 'plan', value: 'enterprise' }],
    updatedAt: '2024-02-28',
  },
  {
    id: '3',
    key: 'realtime_transcription',
    name: 'Real-time Transcription',
    description: 'Show live transcription during meetings',
    enabled: false,
    percentage: 0,
    category: 'transcription',
    targetRules: [],
    updatedAt: '2024-02-15',
  },
  {
    id: '4',
    key: 'calendar_sync_v2',
    name: 'Calendar Sync V2',
    description: 'Use the improved calendar sync engine',
    enabled: true,
    percentage: 25,
    category: 'integrations',
    targetRules: [],
    updatedAt: '2024-03-05',
  },
];

const categories = ['all', 'ui', 'ai', 'transcription', 'integrations'];

export default function FeatureFlagsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredFlags = featureFlags.filter((flag) => {
    const matchesSearch =
      flag.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flag.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || flag.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feature Flags</h1>
          <p className="text-slate-500 mt-1">
            Control feature rollouts and A/B tests
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" />
          New Flag
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Flags</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{featureFlags.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Enabled</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {featureFlags.filter((f) => f.enabled).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Disabled</p>
          <p className="text-2xl font-bold text-slate-600 mt-1">
            {featureFlags.filter((f) => !f.enabled).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Gradual Rollout</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {featureFlags.filter((f) => f.enabled && f.percentage < 100).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search flags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                selectedCategory === cat
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Flags List */}
      <div className="space-y-4">
        {filteredFlags.map((flag) => (
          <div
            key={flag.id}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-slate-900">{flag.name}</h3>
                  <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {flag.key}
                  </code>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded capitalize">
                    {flag.category}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{flag.description}</p>
                {flag.targetRules.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Targeting:</span>
                    {flag.targetRules.map((rule, i) => (
                      <span
                        key={i}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                      >
                        {rule.type}: {rule.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                {flag.percentage < 100 && flag.enabled && (
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <Percent className="w-4 h-4" />
                    {flag.percentage}%
                  </div>
                )}
                <button
                  className={`p-2 rounded-lg ${
                    flag.enabled
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-slate-400 hover:bg-slate-50'
                  }`}
                  title={flag.enabled ? 'Disable' : 'Enable'}
                >
                  {flag.enabled ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-lg" title="Edit">
                  <Edit className="w-4 h-4 text-slate-500" />
                </button>
                <button className="p-2 hover:bg-red-50 rounded-lg" title="Delete">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
