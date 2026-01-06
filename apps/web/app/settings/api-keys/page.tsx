'use client';

import { useState } from 'react';
import { Key, Copy, Trash2, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

const AVAILABLE_SCOPES = [
  { scope: 'meetings:read', description: 'Read meeting data' },
  { scope: 'meetings:write', description: 'Create and update meetings' },
  { scope: 'transcripts:read', description: 'Read transcripts' },
  { scope: 'users:read', description: 'Read user information' },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Zapier Integration',
      keyPrefix: 'sk_live_abc123',
      scopes: ['meetings:read', 'transcripts:read'],
      createdAt: '2026-01-01T00:00:00Z',
      lastUsedAt: '2026-01-05T12:00:00Z',
      expiresAt: null,
    },
  ]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const handleCreateKey = () => {
    if (!newKeyName || selectedScopes.length === 0) return;

    const generatedKey = `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    const newApiKey: ApiKey = {
      id: Math.random().toString(36).substring(7),
      name: newKeyName,
      keyPrefix: generatedKey.substring(0, 15),
      scopes: selectedScopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: null,
    };

    setKeys(prev => [...prev, newApiKey]);
    setNewKey(generatedKey);
    setShowCreateForm(false);
    setNewKeyName('');
    setSelectedScopes([]);
  };

  const handleRevokeKey = (id: string) => {
    if (confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      setKeys(prev => prev.filter(k => k.id !== id));
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">API Keys</h2>
          <p className="text-sm text-slate-500">
            Create and manage API keys to access zigznote from external applications
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {/* New Key Display */}
      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-green-800">API Key Created Successfully</h3>
              <p className="text-sm text-green-700 mt-1">
                Copy your API key now. You won&apos;t be able to see it again!
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 bg-white border border-green-300 rounded px-3 py-2 text-sm font-mono break-all">
                  {newKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(newKey)}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
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

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Create New API Key</h3>
              <p className="text-sm text-slate-500 mt-1">
                API keys allow external applications to access your zigznote data
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Key Name
                </label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Zapier Integration"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope.scope}
                      className="flex items-start gap-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.scope)}
                        onChange={() => toggleScope(scope.scope)}
                        className="mt-0.5 h-4 w-4 text-primary-600 rounded"
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
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateKey}
                disabled={!newKeyName || selectedScopes.length === 0}
              >
                Create Key
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {keys.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900">No API keys</h3>
            <p className="text-sm text-slate-500 mt-1">
              Create your first API key to get started
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Scopes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Last Used
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{key.name}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <code className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                      {key.keyPrefix}...
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                    {formatDate(key.lastUsedAt)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                    {formatDate(key.createdAt)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Documentation */}
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
