'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Zap, Copy, Check, X, AlertCircle } from 'lucide-react';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive' | 'failed';
  failureCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  signingSecret?: string;
}

const AVAILABLE_EVENTS = [
  { id: 'meeting.started', label: 'Meeting Started', description: 'When a meeting begins' },
  { id: 'meeting.ended', label: 'Meeting Ended', description: 'When a meeting ends' },
  { id: 'transcript.ready', label: 'Transcript Ready', description: 'When transcription is complete' },
  { id: 'summary.ready', label: 'Summary Ready', description: 'When AI summary is generated' },
  { id: 'action_items.ready', label: 'Action Items Ready', description: 'When action items are extracted' },
  { id: 'bot.joined', label: 'Bot Joined', description: 'When the bot joins a meeting' },
  { id: 'bot.left', label: 'Bot Left', description: 'When the bot leaves a meeting' },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });

  const loadWebhooks = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks');
      const data = await res.json();
      if (data.success) {
        setWebhooks(data.data);
      }
    } catch (error) {
      console.error('Error loading webhooks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const handleCreate = async () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    if (!newWebhook.url.startsWith('https://')) {
      setMessage({ type: 'error', text: 'URL must start with https://' });
      return;
    }

    setCreating(true);
    setMessage(null);

    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWebhook),
      });

      const data = await res.json();

      if (data.success) {
        setWebhooks((prev) => [data.data, ...prev]);
        setNewWebhookSecret(data.data.signingSecret);
        setShowCreateModal(false);
        setShowSecretModal(true);
        setNewWebhook({ name: '', url: '', events: [] });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create webhook' });
      }
    } catch (error) {
      console.error('Error creating webhook:', error);
      setMessage({ type: 'error', text: 'Failed to create webhook' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
        setMessage({ type: 'success', text: 'Webhook deleted' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete webhook' });
      }
    } catch (error) {
      console.error('Error deleting webhook:', error);
      setMessage({ type: 'error', text: 'Failed to delete webhook' });
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setMessage(null);

    try {
      const res = await fetch(`/api/webhooks/${id}/test`, {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Test webhook sent successfully!' });
        // Reload to get updated lastTriggeredAt
        loadWebhooks();
      } else {
        setMessage({ type: 'error', text: data.error || 'Test failed' });
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      setMessage({ type: 'error', text: 'Failed to send test webhook' });
    } finally {
      setTesting(null);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? false : true;

    try {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      });

      const data = await res.json();

      if (data.success) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === id ? { ...w, status: data.data.status } : w))
        );
      }
    } catch (error) {
      console.error('Error toggling webhook:', error);
    }
  };

  const toggleEvent = (eventId: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(newWebhookSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Webhooks</h2>
          <p className="text-sm text-slate-500">
            Send meeting events to external services
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Webhook
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'error' && <AlertCircle className="w-5 h-5" />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">No webhooks</h3>
            <p className="mt-1 text-sm text-slate-500">
              Create a webhook to start receiving meeting events.
            </p>
            <div className="mt-6">
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Webhook
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{webhook.name}</h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          webhook.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : webhook.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {webhook.status}
                      </span>
                      {webhook.failureCount > 0 && webhook.status !== 'failed' && (
                        <span className="text-xs text-amber-600">
                          ({webhook.failureCount} failures)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 font-mono break-all">
                      {webhook.url}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Last triggered: {formatDate(webhook.lastTriggeredAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(webhook.id)}
                      disabled={testing === webhook.id || webhook.status === 'inactive'}
                    >
                      {testing === webhook.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Test'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(webhook.id, webhook.status)}
                    >
                      {webhook.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(webhook.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Webhook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Create Webhook</CardTitle>
              <button onClick={() => setShowCreateModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <Input
                  type="text"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                  placeholder="My Webhook"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Endpoint URL
                </label>
                <Input
                  type="url"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  placeholder="https://example.com/webhook"
                />
                <p className="text-xs text-slate-500 mt-1">Must be HTTPS</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Events
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label
                      key={event.id}
                      className="flex items-start gap-3 p-2 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event.id)}
                        onChange={() => toggleEvent(event.id)}
                        className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700">{event.label}</span>
                        <p className="text-xs text-slate-500">{event.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {message && message.type === 'error' && (
                <p className="text-sm text-red-600">{message.text}</p>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Webhook'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Signing Secret Modal */}
      {showSecretModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>Webhook Created Successfully</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Save your signing secret
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      This secret is used to verify webhook signatures. It will only be shown once.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Signing Secret
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newWebhookSecret}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" onClick={copySecret}>
                    {copiedSecret ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => {
                  setShowSecretModal(false);
                  setNewWebhookSecret('');
                }}
                className="w-full"
              >
                I&apos;ve Saved My Secret
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Documentation */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-medium text-slate-900 mb-2">Webhook Signature Verification</h3>
          <p className="text-sm text-slate-600 mb-4">
            All webhook payloads are signed using HMAC-SHA256. Verify the signature using the
            <code className="mx-1 px-1 bg-slate-100 rounded text-xs">X-Webhook-Signature</code>
            header.
          </p>
          <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Signature format: t=timestamp,v1=signature
const signature = crypto
  .createHmac('sha256', signingSecret)
  .update(\`\${timestamp}.\${payload}\`)
  .digest('hex');`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
