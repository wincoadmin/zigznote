'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiKeysApi, type ApiKey, type ApiKeyScope, type ApiKeyWithSecret } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CreateKeyFormData {
  name: string;
  scopes: string[];
  expiresInDays: number | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [scopes, setScopes] = useState<ApiKeyScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKey, setNewKey] = useState<ApiKeyWithSecret | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState<CreateKeyFormData>({
    name: '',
    scopes: [],
    expiresInDays: null,
  });
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysRes, scopesRes] = await Promise.all([
        apiKeysApi.list(),
        apiKeysApi.getScopes(),
      ]);

      if (keysRes.success && keysRes.data) {
        setKeys(keysRes.data);
      }
      if (scopesRes.success && scopesRes.data) {
        setScopes(scopesRes.data);
      }
    } catch {
      setError('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.scopes.length === 0) return;

    setCreating(true);
    setError(null);
    try {
      const res = await apiKeysApi.create({
        name: formData.name,
        scopes: formData.scopes,
        expiresInDays: formData.expiresInDays ?? undefined,
      });

      if (res.success && res.data) {
        setNewKey(res.data);
        setFormData({ name: '', scopes: [], expiresInDays: null });
        setShowCreateForm(false);
        loadData();
      } else {
        setError(res.error?.message || 'Failed to create API key');
      }
    } catch {
      setError('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      return;
    }

    setRevoking(keyId);
    try {
      const res = await apiKeysApi.revoke(keyId);
      if (res.success) {
        loadData();
      } else {
        setError(res.error?.message || 'Failed to revoke API key');
      }
    } catch {
      setError('Failed to revoke API key');
    } finally {
      setRevoking(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setFormData((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/4" />
        <div className="h-32 bg-slate-200 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">API Keys</h2>
          <p className="text-sm text-slate-600">
            Create and manage API keys to access zigznote from external applications.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          Create API Key
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* New Key Display */}
      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 text-green-600">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-green-800">
                API Key Created Successfully
              </h3>
              <p className="mt-1 text-sm text-green-700">
                Copy your API key now. You won&apos;t be able to see it again!
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 bg-white border border-green-300 rounded px-3 py-2 text-sm font-mono text-slate-900 break-all">
                  {newKey.key}
                </code>
                <button
                  onClick={() => copyToClipboard(newKey.key)}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                  )}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="mt-3 text-sm text-green-600 hover:text-green-800"
              >
                I&apos;ve saved my key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Key Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateKey}>
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Create New API Key</h3>
                <p className="text-sm text-slate-600 mt-1">
                  API keys allow external applications to access your zigznote data.
                </p>
              </div>

              <div className="p-6 space-y-4">
                {/* Key Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Zapier Integration"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Scopes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Permissions
                  </label>
                  <div className="space-y-2">
                    {scopes.map((scope) => (
                      <label
                        key={scope.scope}
                        className="flex items-start gap-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.scopes.includes(scope.scope)}
                          onChange={() => toggleScope(scope.scope)}
                          className="mt-0.5 h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300 rounded"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {scope.scope}
                          </div>
                          <div className="text-xs text-slate-500">{scope.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expiration (optional)
                  </label>
                  <select
                    value={formData.expiresInDays ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expiresInDays: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Never expires</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !formData.name || formData.scopes.length === 0}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {keys.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900">No API keys</h3>
            <p className="text-sm text-slate-500 mt-1">
              Create your first API key to get started.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Scopes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{key.name}</div>
                    {key.expiresAt && (
                      <div className="text-xs text-slate-500">
                        Expires: {formatDate(key.expiresAt)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <code className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                      {key.keyPrefix}...
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.slice(0, 3).map((scope) => (
                        <span
                          key={scope}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {scope}
                        </span>
                      ))}
                      {key.scopes.length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          +{key.scopes.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                    {formatDate(key.lastUsedAt)}
                    {key.usageCount > 0 && (
                      <div className="text-xs text-slate-400">
                        {key.usageCount.toLocaleString()} requests
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                    {formatDate(key.createdAt)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      disabled={revoking === key.id}
                      className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                    >
                      {revoking === key.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Documentation Link */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-900">Using API Keys</h3>
        <p className="text-sm text-slate-600 mt-1">
          Include your API key in the Authorization header:
        </p>
        <code className="block mt-2 bg-slate-900 text-slate-100 px-4 py-2 rounded text-sm font-mono">
          Authorization: Bearer sk_live_xxxxx
        </code>
      </div>
    </div>
  );
}
