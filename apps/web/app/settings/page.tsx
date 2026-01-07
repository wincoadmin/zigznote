'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Shield } from 'lucide-react';

interface OrganizationSettings {
  organizationName: string;
  autoJoinMeetings: boolean;
  autoGenerateSummaries: boolean;
  extractActionItems: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Check if user is admin
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [settings, setSettings] = useState<OrganizationSettings>({
    organizationName: '',
    autoJoinMeetings: true,
    autoGenerateSummaries: true,
    extractActionItems: true,
  });

  // Track if name has changed
  const [originalName, setOriginalName] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/organization');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings({
            organizationName: data.data.organizationName || '',
            autoJoinMeetings: data.data.autoJoinMeetings ?? true,
            autoGenerateSummaries: data.data.autoGenerateSummaries ?? true,
            extractActionItems: data.data.extractActionItems ?? true,
          });
          setOriginalName(data.data.organizationName || '');
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Failed to load settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!settings.organizationName.trim()) {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Organization name cannot be empty',
      });
      return;
    }

    setSavingName(true);
    try {
      const response = await fetch('/api/settings/organization/name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: settings.organizationName }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setOriginalName(settings.organizationName);
        addToast({
          type: 'success',
          title: 'Success',
          description: 'Organization name updated successfully',
        });
      } else {
        // Handle different error formats
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : data.message || data.error?.message || 'Failed to update organization name';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to save name:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save organization name',
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleToggle = async (key: keyof Omit<OrganizationSettings, 'organizationName'>, value: boolean) => {
    // Optimistically update UI
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaving(true);

    try {
      const response = await fetch('/api/settings/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Revert on failure
        setSettings(prev => ({ ...prev, [key]: !value }));
        throw new Error(data.error || 'Failed to update setting');
      }

      addToast({
        type: 'success',
        title: 'Success',
        description: 'Setting updated successfully',
      });
    } catch (error) {
      console.error('Failed to save setting:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save setting',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (deleteConfirmText !== settings.organizationName) {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Please type the organization name exactly to confirm',
      });
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch('/api/settings/organization', {
        method: 'DELETE',
      });

      if (response.ok) {
        addToast({
          type: 'success',
          title: 'Organization Deleted',
          description: 'Your organization has been permanently deleted',
        });
        // Redirect to home or login
        window.location.href = '/';
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete organization');
      }
    } catch (error) {
      console.error('Failed to delete organization:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete organization',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">General Settings</h2>
          <p className="text-sm text-slate-500">Manage your organization settings</p>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">General Settings</h2>
        <p className="text-sm text-slate-500">Manage your organization settings</p>
      </div>

      {/* Organization Info - Admin Only */}
      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary-600" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                value={settings.organizationName}
                onChange={(e) => setSettings(prev => ({ ...prev, organizationName: e.target.value }))}
                className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter organization name"
              />
            </div>
            <Button
              onClick={handleSaveName}
              disabled={savingName || settings.organizationName === originalName}
            >
              {savingName ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">
              <strong>{settings.organizationName || 'Your Organization'}</strong>
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Contact your organization admin to change organization settings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Meeting Defaults - Admin Only can modify */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isAdmin && <Shield className="h-5 w-5 text-primary-600" />}
            Meeting Defaults
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Auto-join scheduled meetings</p>
              <p className="text-sm text-slate-500">
                Automatically send bot to join meetings from connected calendars
              </p>
            </div>
            {isAdmin ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.autoJoinMeetings}
                  onChange={(e) => handleToggle('autoJoinMeetings', e.target.checked)}
                  disabled={saving}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            ) : (
              <span className={`px-2 py-1 text-xs rounded ${settings.autoJoinMeetings ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {settings.autoJoinMeetings ? 'Enabled' : 'Disabled'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Auto-generate summaries</p>
              <p className="text-sm text-slate-500">
                Automatically generate AI summaries after meetings end
              </p>
            </div>
            {isAdmin ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.autoGenerateSummaries}
                  onChange={(e) => handleToggle('autoGenerateSummaries', e.target.checked)}
                  disabled={saving}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            ) : (
              <span className={`px-2 py-1 text-xs rounded ${settings.autoGenerateSummaries ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {settings.autoGenerateSummaries ? 'Enabled' : 'Disabled'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Extract action items</p>
              <p className="text-sm text-slate-500">
                Automatically identify and extract action items from meetings
              </p>
            </div>
            {isAdmin ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.extractActionItems}
                  onChange={(e) => handleToggle('extractActionItems', e.target.checked)}
                  disabled={saving}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            ) : (
              <span className={`px-2 py-1 text-xs rounded ${settings.extractActionItems ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {settings.extractActionItems ? 'Enabled' : 'Disabled'}
              </span>
            )}
          </div>

          {!isAdmin && (
            <p className="text-sm text-slate-500 pt-2 border-t">
              Contact your organization admin to change these settings.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone - Admin Only */}
      {isAdmin && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Delete Organization</p>
                  <p className="text-sm text-slate-500">
                    Permanently delete your organization and all associated data
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete Organization
                </Button>
              </div>
            ) : (
              <div className="space-y-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <p className="font-medium text-red-800">Are you absolutely sure?</p>
                  <p className="text-sm text-red-600 mt-1">
                    This action cannot be undone. This will permanently delete the organization
                    <strong> {settings.organizationName}</strong> and all associated data including
                    meetings, transcripts, summaries, and team members.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-800 mb-1">
                    Type <strong>{settings.organizationName}</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full max-w-md px-3 py-2 border border-red-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Type organization name"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-500 bg-red-600 text-white hover:bg-red-700"
                    onClick={handleDeleteOrganization}
                    disabled={deleting || deleteConfirmText !== settings.organizationName}
                  >
                    {deleting ? 'Deleting...' : 'Delete Organization'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
