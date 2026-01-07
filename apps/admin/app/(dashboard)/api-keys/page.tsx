'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Loader2,
  X,
} from 'lucide-react';
import { apiKeysApi } from '@/lib/api';

interface ApiKeyData {
  id: string;
  name: string;
  provider: string;
  environment: string;
  keyHint?: string;
  isActive: boolean;
  lastUsedAt?: string;
  rotationDays?: number | null;
  expiresAt?: string | null;
  createdAt: string;
  usageCount?: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const providerColors: Record<string, string> = {
  deepgram: 'bg-green-100 text-green-700',
  anthropic: 'bg-orange-100 text-orange-700',
  openai: 'bg-emerald-100 text-emerald-700',
  recall: 'bg-blue-100 text-blue-700',
  google: 'bg-red-100 text-red-700',
  clerk: 'bg-purple-100 text-purple-700',
  stripe: 'bg-indigo-100 text-indigo-700',
  flutterwave: 'bg-yellow-100 text-yellow-700',
};

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnv, setSelectedEnv] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (searchQuery) params.search = searchQuery;
      if (selectedEnv !== 'all') params.environment = selectedEnv;

      const response = await apiKeysApi.list(params);
      if (response.success && response.data) {
        const responseData = response.data;
        if (Array.isArray(responseData)) {
          setApiKeys(responseData as ApiKeyData[]);
          setPagination(null);
        } else {
          const data = responseData as { data?: ApiKeyData[]; pagination?: Pagination };
          setApiKeys(data.data || []);
          setPagination(data.pagination || null);
        }
      } else {
        setError(response.error?.message || 'Failed to fetch API keys');
      }
    } catch {
      setError('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedEnv]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      const response = await apiKeysApi.delete(id);
      if (response.success) {
        fetchApiKeys();
      } else {
        setError(response.error?.message || 'Failed to delete');
      }
    } catch {
      setError('Failed to delete API key');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const response = await apiKeysApi.update(id, { isActive: !isActive });
      if (response.success) {
        fetchApiKeys();
      }
    } catch {
      setError('Failed to toggle API key');
    }
  };

  const stats = {
    total: pagination?.total || apiKeys.length,
    active: apiKeys.filter((k) => k.isActive).length,
    inactive: apiKeys.filter((k) => !k.isActive).length,
    expiring: apiKeys.filter((k) => k.expiresAt && new Date(k.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
          <p className="text-slate-500 mt-1">Manage third-party service API keys</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Add API Key
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Keys</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Inactive</p>
          <p className="text-2xl font-bold text-slate-600 mt-1">{stats.inactive}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Expiring Soon</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.expiring}</p>
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
        <div className="space-y-4">
          {apiKeys.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <Key className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No API keys found</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Add your first API key
              </button>
            </div>
          ) : (
            apiKeys.map((key) => (
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
                      <div className="flex items-center gap-3 flex-wrap">
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
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 flex-wrap">
                        {key.keyHint && <span className="font-mono">****{key.keyHint}</span>}
                        <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                        {key.lastUsedAt && (
                          <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      {key.expiresAt && new Date(key.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-yellow-600">
                          <AlertTriangle className="w-4 h-4" />
                          Expires: {new Date(key.expiresAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(key.id, key.isActive)}
                      className="p-2 hover:bg-slate-100 rounded-lg"
                      title={key.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {key.isActive ? (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setShowRotateModal(key.id)}
                      className="p-2 hover:bg-slate-100 rounded-lg"
                      title="Rotate"
                    >
                      <RotateCw className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(key.id)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddApiKeyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchApiKeys();
          }}
        />
      )}

      {/* Rotate Modal */}
      {showRotateModal && (
        <RotateKeyModal
          keyId={showRotateModal}
          onClose={() => setShowRotateModal(null)}
          onSuccess={() => {
            setShowRotateModal(null);
            fetchApiKeys();
          }}
        />
      )}
    </div>
  );
}

function AddApiKeyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('deepgram');
  const [environment, setEnvironment] = useState('production');
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name || !key) {
      setError('Name and key are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await apiKeysApi.create({ name, provider, environment, key });
      if (response.success) {
        onSuccess();
      } else {
        setError(response.error?.message || 'Failed to create');
      }
    } catch {
      setError('Failed to create API key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Add API Key</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Deepgram"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="deepgram">Deepgram</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="recall">Recall.ai</option>
              <option value="google">Google</option>
              <option value="clerk">Clerk</option>
              <option value="stripe">Stripe</option>
              <option value="flutterwave">Flutterwave</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter the API key"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add Key'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RotateKeyModal({ keyId, onClose, onSuccess }: { keyId: string; onClose: () => void; onSuccess: () => void }) {
  const [newKey, setNewKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleRotate = async () => {
    if (!newKey) {
      setError('New key is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await apiKeysApi.rotate(keyId, newKey);
      if (response.success) {
        onSuccess();
      } else {
        setError(response.error?.message || 'Failed to rotate');
      }
    } catch {
      setError('Failed to rotate API key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Rotate API Key</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <p className="text-sm text-slate-500 mb-4">
          Enter the new API key value. The old key will be replaced immediately.
        </p>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">New API Key</label>
          <input
            type="password"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Enter the new API key"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleRotate}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Rotating...' : 'Rotate Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
