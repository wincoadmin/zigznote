'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plug,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Play,
  Loader2,
} from 'lucide-react';

interface Integration {
  provider: string;
  name: string;
  description: string;
  docsUrl: string;
  icon: string;
  requiredScopes: string[];
  additionalFields?: Array<{ key: string; label: string; required: boolean; default?: string }>;
  configured: boolean;
  enabled: boolean;
  source: 'database' | 'environment' | 'none';
  clientId: string | null;
  redirectUri: string | null;
  additionalConfig: Record<string, unknown> | null;
  configuredAt: string | null;
  lastTestedAt: string | null;
  testStatus: 'success' | 'failed' | 'pending' | null;
  testError: string | null;
}

interface ConfigModalProps {
  integration: Integration | null;
  onClose: () => void;
  onSave: (provider: string, data: ConfigData) => Promise<void>;
}

interface ConfigData {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  additionalConfig?: Record<string, string>;
  enabled: boolean;
}

const iconColors: Record<string, string> = {
  slack: 'bg-[#4A154B] text-white',
  zoom: 'bg-[#2D8CFF] text-white',
  hubspot: 'bg-[#FF7A59] text-white',
  salesforce: 'bg-[#00A1E0] text-white',
  microsoft: 'bg-[#00A4EF] text-white',
  google: 'bg-white text-[#4285F4] border border-slate-200',
};

function ConfigModal({ integration, onClose, onSave }: ConfigModalProps) {
  const [clientId, setClientId] = useState(integration?.clientId || '');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState(integration?.redirectUri || '');
  const [additionalConfig, setAdditionalConfig] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(integration?.enabled ?? true);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (integration?.additionalFields) {
      const defaults: Record<string, string> = {};
      for (const field of integration.additionalFields) {
        defaults[field.key] = (integration.additionalConfig?.[field.key] as string) || field.default || '';
      }
      setAdditionalConfig(defaults);
    }
  }, [integration]);

  if (!integration) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(integration.provider, {
        clientId,
        clientSecret,
        redirectUri: redirectUri || undefined,
        additionalConfig: Object.keys(additionalConfig).length > 0 ? additionalConfig : undefined,
        enabled,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColors[integration.icon] || 'bg-slate-100'}`}>
              <Plug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Configure {integration.name}</h2>
              <a
                href={integration.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:underline flex items-center gap-1"
              >
                View documentation <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Client ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Enter client ID from provider"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Client Secret <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={integration.configured ? '••••••••••••' : 'Enter client secret'}
                className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {integration.configured && (
              <p className="text-xs text-slate-500 mt-1">Leave blank to keep existing secret</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Redirect URI
            </label>
            <input
              type="text"
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              placeholder="Auto-generated if left blank"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {integration.additionalFields?.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={additionalConfig[field.key] || ''}
                onChange={(e) => setAdditionalConfig({ ...additionalConfig, [field.key]: e.target.value })}
                placeholder={field.default || `Enter ${field.label.toLowerCase()}`}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          ))}

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Enable Integration</p>
              <p className="text-xs text-slate-500">Users can connect when enabled</p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-primary-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm font-medium text-slate-700 mb-1">Required Scopes</p>
            <div className="flex flex-wrap gap-1">
              {integration.requiredScopes.map((scope) => (
                <code key={scope} className="text-xs bg-slate-200 px-2 py-0.5 rounded">
                  {scope}
                </code>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !clientId || (!integration.configured && !clientSecret)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/integrations', {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setIntegrations(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleSave = async (provider: string, configData: ConfigData) => {
    const res = await fetch(`/api/admin/integrations/${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(configData),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    await fetchIntegrations();
  };

  const handleToggle = async (provider: string, enabled: boolean) => {
    const res = await fetch(`/api/admin/integrations/${provider}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (data.success) {
      await fetchIntegrations();
    }
  };

  const handleTest = async (provider: string) => {
    setTestingProvider(provider);
    try {
      const res = await fetch(`/api/admin/integrations/${provider}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      await res.json();
      await fetchIntegrations();
    } finally {
      setTestingProvider(null);
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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  const configuredCount = integrations.filter((i) => i.configured).length;
  const enabledCount = integrations.filter((i) => i.enabled && i.configured).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integration Credentials</h1>
        <p className="text-slate-500 mt-1">
          Configure OAuth credentials for third-party integrations
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Integrations</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{integrations.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Configured</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{configuredCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Enabled</p>
          <p className="text-2xl font-bold text-primary-600 mt-1">{enabledCount}</p>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div
            key={integration.provider}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconColors[integration.icon] || 'bg-slate-100'}`}>
                  <Plug className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{integration.name}</h3>
                  <p className="text-xs text-slate-500">{integration.description}</p>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Status</span>
                {integration.configured ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Configured
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-400">
                    <XCircle className="w-4 h-4" />
                    Not configured
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Source</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  integration.source === 'database' ? 'bg-blue-100 text-blue-700' :
                  integration.source === 'environment' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {integration.source === 'database' ? 'Database' :
                   integration.source === 'environment' ? 'Env Vars' : 'None'}
                </span>
              </div>
              {integration.testStatus && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Last Test</span>
                  {integration.testStatus === 'success' ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Passed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600" title={integration.testError || ''}>
                      <AlertTriangle className="w-4 h-4" />
                      Failed
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedIntegration(integration)}
                className="flex-1 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center justify-center gap-1"
              >
                <Settings className="w-4 h-4" />
                Configure
              </button>
              {integration.configured && (
                <>
                  <button
                    onClick={() => handleTest(integration.provider)}
                    disabled={testingProvider === integration.provider}
                    className="px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                    title="Test connection"
                  >
                    {testingProvider === integration.provider ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggle(integration.provider, !integration.enabled)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      integration.enabled ? 'bg-primary-600' : 'bg-slate-200'
                    }`}
                    title={integration.enabled ? 'Disable' : 'Enable'}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow ${
                        integration.enabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Config Modal */}
      {selectedIntegration && (
        <ConfigModal
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
