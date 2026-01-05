'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive' | 'failed';
  failureCount: number;
  lastTriggeredAt?: string;
}

const AVAILABLE_EVENTS = [
  { id: 'meeting.started', label: 'Meeting Started' },
  { id: 'meeting.ended', label: 'Meeting Ended' },
  { id: 'transcript.ready', label: 'Transcript Ready' },
  { id: 'summary.ready', label: 'Summary Ready' },
  { id: 'action_items.ready', label: 'Action Items Ready' },
  { id: 'bot.joined', label: 'Bot Joined' },
  { id: 'bot.left', label: 'Bot Left' },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });

  const handleCreate = async () => {
    // API call to create webhook
    console.log('Creating webhook:', newWebhook);
    setShowCreateModal(false);
    setNewWebhook({ name: '', url: '', events: [] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    setWebhooks(webhooks.filter((w) => w.id !== id));
  };

  const handleTest = async (id: string) => {
    console.log('Testing webhook:', id);
    // API call to test webhook
  };

  const toggleEvent = (eventId: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
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
        <Button onClick={() => setShowCreateModal(true)}>Create Webhook</Button>
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No webhooks</h3>
            <p className="mt-1 text-sm text-slate-500">
              Create a webhook to start receiving meeting events.
            </p>
            <div className="mt-6">
              <Button onClick={() => setShowCreateModal(true)}>Create Webhook</Button>
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
                    </div>
                    <p className="text-sm text-slate-500 mt-1 font-mono">{webhook.url}</p>
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
                    {webhook.lastTriggeredAt && (
                      <p className="text-xs text-slate-400 mt-2">
                        Last triggered: {new Date(webhook.lastTriggeredAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleTest(webhook.id)}>
                      Test
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
            <CardHeader>
              <CardTitle>Create Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                  placeholder="My Webhook"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  placeholder="https://example.com/webhook"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Events
                </label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label
                      key={event.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event.id)}
                        onChange={() => toggleEvent(event.id)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-slate-700">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
                >
                  Create Webhook
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
