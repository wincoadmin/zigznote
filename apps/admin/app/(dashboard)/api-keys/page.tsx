'use client';

import { useState } from 'react';
import {
  Search,
  Plus,
  Key,
  Eye,
  EyeOff,
  RotateCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

// Placeholder data
const apiKeys = [
  {
    id: '1',
    name: 'Production Deepgram',
    provider: 'deepgram',
    environment: 'production',
    keyHint: '...x4a7',
    isActive: true,
    lastUsedAt: '2 minutes ago',
    rotationDue: null,
    usageCount: 125847,
  },
  {
    id: '2',
    name: 'Production Anthropic',
    provider: 'anthropic',
    environment: 'production',
    keyHint: '...m9k2',
    isActive: true,
    lastUsedAt: '5 minutes ago',
    rotationDue: 'In 7 days',
    usageCount: 45231,
  },
  {
    id: '3',
    name: 'Production Recall',
    provider: 'recall',
    environment: 'production',
    keyHint: '...b3f1',
    isActive: true,
    lastUsedAt: '1 hour ago',
    rotationDue: null,
    usageCount: 8923,
  },
  {
    id: '4',
    name: 'Staging OpenAI',
    provider: 'openai',
    environment: 'staging',
    keyHint: '...r7p4',
    isActive: false,
    lastUsedAt: '3 days ago',
    rotationDue: null,
    usageCount: 234,
  },
];

const providerColors: Record<string, string> = {
  deepgram: 'bg-green-100 text-green-700',
  anthropic: 'bg-orange-100 text-orange-700',
  openai: 'bg-emerald-100 text-emerald-700',
  recall: 'bg-blue-100 text-blue-700',
  google: 'bg-red-100 text-red-700',
  clerk: 'bg-purple-100 text-purple-700',
};

export default function ApiKeysPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnv, setSelectedEnv] = useState('all');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
          <p className="text-slate-500 mt-1">
            Manage third-party service API keys
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" />
          Add API Key
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Keys</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{apiKeys.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {apiKeys.filter((k) => k.isActive).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Inactive</p>
          <p className="text-2xl font-bold text-slate-600 mt-1">
            {apiKeys.filter((k) => !k.isActive).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Due for Rotation</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">
            {apiKeys.filter((k) => k.rotationDue).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search API keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={selectedEnv}
          onChange={(e) => setSelectedEnv(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Environments</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="development">Development</option>
        </select>
      </div>

      {/* Keys List */}
      <div className="space-y-4">
        {apiKeys.map((key) => (
          <div
            key={key.id}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Key className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-900">{key.name}</h3>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${providerColors[key.provider] || 'bg-slate-100 text-slate-700'}`}
                    >
                      {key.provider}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {key.environment}
                    </span>
                    {key.isActive ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <EyeOff className="w-3 h-3" />
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    <span className="font-mono">****{key.keyHint}</span>
                    <span>Used {key.usageCount.toLocaleString()} times</span>
                    <span>Last used {key.lastUsedAt}</span>
                  </div>
                  {key.rotationDue && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-yellow-600">
                      <AlertTriangle className="w-4 h-4" />
                      Rotation due: {key.rotationDue}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-slate-100 rounded-lg" title="View">
                  <Eye className="w-4 h-4 text-slate-500" />
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-lg" title="Rotate">
                  <RotateCw className="w-4 h-4 text-slate-500" />
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
