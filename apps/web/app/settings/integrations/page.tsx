'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface IntegrationStatus {
  connected: boolean;
  status?: string;
  teamName?: string;
  portalId?: string;
  connectedAt?: string;
}

const integrations = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send meeting summaries and action items to Slack channels',
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
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.981c0-1.218-.988-2.206-2.206-2.206a2.207 2.207 0 0 0-2.206 2.206c0 .894.534 1.662 1.3 2.006v2.811a5.159 5.159 0 0 0-2.48 1.05l-6.543-5.158a2.596 2.596 0 0 0 .066-.521A2.591 2.591 0 0 0 4.774.698 2.591 2.591 0 0 0 2.18 3.29c0 1.178.79 2.172 1.87 2.483v6.109a2.591 2.591 0 0 0-1.87 2.483 2.592 2.592 0 0 0 2.594 2.593c1.122 0 2.078-.718 2.437-1.72l5.163.666a5.119 5.119 0 0 0 4.852 3.499 5.136 5.136 0 0 0 5.128-5.127c0-2.4-1.655-4.413-3.883-4.974l-.307-.872zm-8.607 4.982l-5.095-.657a2.558 2.558 0 0 0-.28-.658V5.794c.22-.086.426-.2.611-.34l6.426 5.067a5.073 5.073 0 0 0-.463 2.065c0 .115.005.228.015.341a5.04 5.04 0 0 0-.2 0l-1.014-.015zm7.669 4.056a2.588 2.588 0 0 1-2.585-2.586 2.588 2.588 0 0 1 2.585-2.585 2.588 2.588 0 0 1 2.585 2.585 2.588 2.588 0 0 1-2.585 2.586z" />
      </svg>
    ),
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync meetings from your Google Calendar',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3zm0 16.5h-15V9h15v10.5zm0-12h-15V4.5h3V6H9V4.5h6V6h1.5V4.5h3V7.5z" />
      </svg>
    ),
  },
];

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Check for success/error params
  useEffect(() => {
    const slackConnected = searchParams.get('slack');
    const hubspotConnected = searchParams.get('hubspot');
    const error = searchParams.get('error');

    if (slackConnected === 'connected') {
      // Refresh Slack status
      checkStatus('slack');
    }
    if (hubspotConnected === 'connected') {
      // Refresh HubSpot status
      checkStatus('hubspot');
    }
    if (error) {
      console.error('Integration error:', error);
    }
  }, [searchParams]);

  const checkStatus = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/status`);
      if (response.ok) {
        const data = await response.json();
        setStatuses((prev) => ({ ...prev, [integrationId]: data }));
      }
    } catch (error) {
      console.error(`Failed to check ${integrationId} status:`, error);
    }
  };

  const handleConnect = async (integrationId: string) => {
    setLoading((prev) => ({ ...prev, [integrationId]: true }));

    try {
      const response = await fetch(`/api/integrations/${integrationId}/connect`);
      if (response.ok) {
        const data = await response.json();
        // Redirect to OAuth URL
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(`Failed to connect ${integrationId}:`, error);
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
      }
    } catch (error) {
      console.error(`Failed to disconnect ${integrationId}:`, error);
    } finally {
      setLoading((prev) => ({ ...prev, [integrationId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        <p className="text-sm text-slate-500">
          Connect zigznote with your favorite tools
        </p>
      </div>

      <div className="grid gap-4">
        {integrations.map((integration) => {
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
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Connected
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(integration.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Disconnecting...' : 'Disconnect'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleConnect(integration.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Connecting...' : 'Connect'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
