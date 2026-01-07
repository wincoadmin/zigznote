'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface IntegrationStatus {
  connected: boolean;
  status?: string;
  teamName?: string;
  portalId?: string;
  connectedAt?: string;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'communication' | 'crm' | 'calendar' | 'video';
  comingSoon?: boolean;
}

const integrations: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send meeting summaries and action items to Slack channels',
    category: 'communication',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </svg>
    ),
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Log meetings to HubSpot CRM and create tasks from action items',
    category: 'crm',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.981c0-1.218-.988-2.206-2.206-2.206a2.207 2.207 0 0 0-2.206 2.206c0 .894.534 1.662 1.3 2.006v2.811a5.159 5.159 0 0 0-2.48 1.05l-6.543-5.158a2.596 2.596 0 0 0 .066-.521A2.591 2.591 0 0 0 4.774.698 2.591 2.591 0 0 0 2.18 3.29c0 1.178.79 2.172 1.87 2.483v6.109a2.591 2.591 0 0 0-1.87 2.483 2.592 2.592 0 0 0 2.594 2.593c1.122 0 2.078-.718 2.437-1.72l5.163.666a5.119 5.119 0 0 0 4.852 3.499 5.136 5.136 0 0 0 5.128-5.127c0-2.4-1.655-4.413-3.883-4.974l-.307-.872zm-8.607 4.982l-5.095-.657a2.558 2.558 0 0 0-.28-.658V5.794c.22-.086.426-.2.611-.34l6.426 5.067a5.073 5.073 0 0 0-.463 2.065c0 .115.005.228.015.341a5.04 5.04 0 0 0-.2 0l-1.014-.015zm7.669 4.056a2.588 2.588 0 0 1-2.585-2.586 2.588 2.588 0 0 1 2.585-2.585 2.588 2.588 0 0 1 2.585 2.585 2.588 2.588 0 0 1-2.585 2.586z" />
      </svg>
    ),
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync meetings from your Google Calendar automatically',
    category: 'calendar',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3zm0 16.5h-15V9h15v10.5zm0-12h-15V4.5h3V6H9V4.5h6V6h1.5V4.5h3V7.5z" />
      </svg>
    ),
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Sync your Zoom meetings and enable automatic recording',
    category: 'video',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#2D8CFF">
        <path d="M4.585 7.5A2.585 2.585 0 0 0 2 10.085v3.83A2.585 2.585 0 0 0 4.585 16.5h7.83A2.585 2.585 0 0 0 15 13.915v-3.83A2.585 2.585 0 0 0 12.415 7.5h-7.83zM17 10.5l4.5-3v9l-4.5-3v-3z" />
      </svg>
    ),
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    description: 'Connect Microsoft 365 calendar and Teams meetings',
    category: 'video',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#5059C9">
        <path d="M20.625 8.5h-5.25v8.25a1.125 1.125 0 0 1-1.125 1.125H9.5v1.875A1.125 1.125 0 0 0 10.625 20.875h10A1.125 1.125 0 0 0 21.75 19.75v-10.125A1.125 1.125 0 0 0 20.625 8.5z" />
        <circle cx="18" cy="5.25" r="2.25" />
        <path d="M13.125 4.25H4.875A1.125 1.125 0 0 0 3.75 5.375v8.25A1.125 1.125 0 0 0 4.875 14.75h8.25a1.125 1.125 0 0 0 1.125-1.125v-8.25A1.125 1.125 0 0 0 13.125 4.25z" />
        <circle cx="9" cy="3" r="2.25" />
      </svg>
    ),
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Log meeting summaries and create tasks in Salesforce CRM',
    category: 'crm',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#00A1E0">
        <path d="M10.006 5.415a4.195 4.195 0 0 1 3.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.465 2.1-.465 2.73 0 4.95 2.235 4.95 4.995 0 2.76-2.22 4.995-4.95 4.995-.39 0-.78-.045-1.14-.135-.615 1.41-2.025 2.4-3.66 2.4-1.065 0-2.025-.42-2.745-1.095a4.463 4.463 0 0 1-3.39 1.545c-2.085 0-3.84-1.44-4.335-3.375A4.473 4.473 0 0 1 0 11.31c0-2.52 2.085-4.56 4.65-4.56.51 0 1.005.09 1.47.24a4.185 4.185 0 0 1 3.886-1.575z" />
      </svg>
    ),
  },
];

const CATEGORIES = {
  communication: 'Communication',
  crm: 'CRM',
  calendar: 'Calendar',
  video: 'Video Conferencing',
};

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const checkStatus = useCallback(async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/status`);
      if (response.ok) {
        const data = await response.json();
        setStatuses((prev) => ({ ...prev, [integrationId]: data }));
      }
    } catch (error) {
      console.error(`Failed to check ${integrationId} status:`, error);
    }
  }, []);

  // Load all statuses on mount
  useEffect(() => {
    const loadStatuses = async () => {
      setInitialLoading(true);
      const activeIntegrations = integrations.filter((i) => !i.comingSoon);
      await Promise.all(activeIntegrations.map((i) => checkStatus(i.id)));
      setInitialLoading(false);
    };
    loadStatuses();
  }, [checkStatus]);

  // Handle OAuth callback params
  useEffect(() => {
    const slackConnected = searchParams.get('slack');
    const hubspotConnected = searchParams.get('hubspot');
    const googleConnected = searchParams.get('google-calendar');
    const zoomConnected = searchParams.get('zoom');
    const microsoftConnected = searchParams.get('microsoft-teams');
    const salesforceConnected = searchParams.get('salesforce');
    const error = searchParams.get('error');

    if (slackConnected === 'connected') {
      setMessage({ type: 'success', text: 'Slack connected successfully!' });
      checkStatus('slack');
    }
    if (hubspotConnected === 'connected') {
      setMessage({ type: 'success', text: 'HubSpot connected successfully!' });
      checkStatus('hubspot');
    }
    if (googleConnected === 'connected') {
      setMessage({ type: 'success', text: 'Google Calendar connected successfully!' });
      checkStatus('google-calendar');
    }
    if (zoomConnected === 'connected') {
      setMessage({ type: 'success', text: 'Zoom connected successfully!' });
      checkStatus('zoom');
    }
    if (microsoftConnected === 'connected') {
      setMessage({ type: 'success', text: 'Microsoft Teams connected successfully!' });
      checkStatus('microsoft-teams');
    }
    if (salesforceConnected === 'connected') {
      setMessage({ type: 'success', text: 'Salesforce connected successfully!' });
      checkStatus('salesforce');
    }
    if (error) {
      setMessage({ type: 'error', text: decodeURIComponent(error) });
    }

    // Clear message after 5 seconds
    if (slackConnected || hubspotConnected || googleConnected || zoomConnected || microsoftConnected || salesforceConnected || error) {
      setTimeout(() => setMessage(null), 5000);
    }
  }, [searchParams, checkStatus]);

  const handleConnect = async (integrationId: string) => {
    setLoading((prev) => ({ ...prev, [integrationId]: true }));

    try {
      const response = await fetch(`/api/integrations/${integrationId}/connect`);
      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to OAuth URL
        window.location.href = data.url;
      } else if (data.error === 'not_configured') {
        setMessage({
          type: 'error',
          text: `${integrations.find((i) => i.id === integrationId)?.name} integration requires OAuth configuration. Contact your administrator.`,
        });
      } else {
        setMessage({
          type: 'error',
          text: data.message || data.error || 'Failed to connect',
        });
      }
    } catch (error) {
      console.error(`Failed to connect ${integrationId}:`, error);
      setMessage({ type: 'error', text: 'Failed to initiate connection' });
    } finally {
      setLoading((prev) => ({ ...prev, [integrationId]: false }));
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) {
      return;
    }

    setLoading((prev) => ({ ...prev, [integrationId]: true }));

    try {
      const response = await fetch(`/api/integrations/${integrationId}/disconnect`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setStatuses((prev) => ({
          ...prev,
          [integrationId]: { connected: false },
        }));
        setMessage({
          type: 'success',
          text: `${integrations.find((i) => i.id === integrationId)?.name} disconnected`,
        });
      } else {
        setMessage({ type: 'error', text: 'Failed to disconnect' });
      }
    } catch (error) {
      console.error(`Failed to disconnect ${integrationId}:`, error);
      setMessage({ type: 'error', text: 'Failed to disconnect' });
    } finally {
      setLoading((prev) => ({ ...prev, [integrationId]: false }));
    }
  };

  const activeIntegrations = integrations.filter((i) => !i.comingSoon);
  const comingSoonIntegrations = integrations.filter((i) => i.comingSoon);
  const connectedCount = Object.values(statuses).filter((s) => s.connected).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
          <p className="text-sm text-slate-500">
            Connect zigznote with your favorite tools ({connectedCount} connected)
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Browse Integrations
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
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Loading state */}
      {initialLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Loading integrations...</span>
        </div>
      )}

      {/* Active Integrations */}
      {!initialLoading && (
        <div className="grid gap-4">
          {activeIntegrations.map((integration) => {
            const status = statuses[integration.id];
            const isLoading = loading[integration.id];
            const isConnected = status?.connected;

            return (
              <Card key={integration.id}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <div className="text-slate-600">{integration.icon}</div>
                    <div>
                      <h3 className="font-medium text-slate-900">{integration.name}</h3>
                      <p className="text-sm text-slate-500">{integration.description}</p>
                      {isConnected && status?.teamName && (
                        <p className="text-xs text-green-600 mt-1">
                          Connected to {status.teamName}
                        </p>
                      )}
                      {isConnected && status?.portalId && (
                        <p className="text-xs text-green-600 mt-1">
                          Connected to portal {status.portalId}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <>
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          Connected
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(integration.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              Disconnecting...
                            </>
                          ) : (
                            'Disconnect'
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleConnect(integration.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Connecting...
                          </>
                        ) : (
                          'Connect'
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Coming Soon Section */}
      {comingSoonIntegrations.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">
            Coming Soon
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {comingSoonIntegrations.map((integration) => (
              <Card key={integration.id} className="opacity-60">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="text-slate-400">{integration.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-700">{integration.name}</h3>
                      <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{integration.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Browse Integrations Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Browse Integrations</h3>
              <p className="text-sm text-slate-500 mt-1">
                Discover integrations to connect with your tools
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {Object.entries(CATEGORIES).map(([key, label]) => {
                const categoryIntegrations = integrations.filter((i) => i.category === key);
                if (categoryIntegrations.length === 0) return null;

                return (
                  <div key={key} className="mb-6 last:mb-0">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">{label}</h4>
                    <div className="space-y-2">
                      {categoryIntegrations.map((integration) => {
                        const isConnected = statuses[integration.id]?.connected;
                        return (
                          <div
                            key={integration.id}
                            className={`flex items-center justify-between p-3 border rounded-lg ${
                              integration.comingSoon
                                ? 'border-slate-100 bg-slate-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={integration.comingSoon ? 'opacity-50' : ''}>
                                {integration.icon}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-900">
                                    {integration.name}
                                  </span>
                                  {integration.comingSoon && (
                                    <span className="px-1.5 py-0.5 text-xs bg-slate-200 text-slate-600 rounded">
                                      Soon
                                    </span>
                                  )}
                                  {isConnected && (
                                    <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                      Connected
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">{integration.description}</p>
                              </div>
                            </div>
                            {!integration.comingSoon && !isConnected && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setShowAddModal(false);
                                  handleConnect(integration.id);
                                }}
                              >
                                Connect
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Request Integration */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-medium text-slate-900">Need a different integration?</h4>
                <p className="text-sm text-slate-500 mt-1">
                  Let us know which integrations you would like to see.
                </p>
                <a
                  href="mailto:support@zigznote.com?subject=Integration%20Request"
                  className="inline-flex items-center gap-1 mt-3 text-sm text-primary-600 hover:text-primary-700"
                >
                  Request an integration
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
