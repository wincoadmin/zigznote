'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Shield, Building2, Globe, Clock } from 'lucide-react';

interface OrganizationSettings {
  organizationName: string;
  timezone: string;
  industry: string;
  companySize: string;
  website: string;
  autoJoinMeetings: boolean;
  autoGenerateSummaries: boolean;
  extractActionItems: boolean;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

const INDUSTRIES = [
  { value: '', label: 'Select industry' },
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'education', label: 'Education' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'legal', label: 'Legal' },
  { value: 'media', label: 'Media & Entertainment' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
];

const COMPANY_SIZES = [
  { value: '', label: 'Select size' },
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
];

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { addToast } = useToast();

  // Check if user is admin
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [settings, setSettings] = useState<OrganizationSettings>({
    organizationName: '',
    timezone: 'UTC',
    industry: '',
    companySize: '',
    website: '',
    autoJoinMeetings: true,
    autoGenerateSummaries: true,
    extractActionItems: true,
  });

  // Track original values
  const [originalSettings, setOriginalSettings] = useState<OrganizationSettings>(settings);

  // Redirect non-admins to profile page
  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) {
      router.replace('/settings/profile');
    }
  }, [status, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
    }
  }, [isAdmin]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/organization');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const newSettings = {
            organizationName: data.data.organizationName || '',
            timezone: data.data.timezone || 'UTC',
            industry: data.data.industry || '',
            companySize: data.data.companySize || '',
            website: data.data.website || '',
            autoJoinMeetings: data.data.autoJoinMeetings ?? true,
            autoGenerateSummaries: data.data.autoGenerateSummaries ?? true,
            extractActionItems: data.data.extractActionItems ?? true,
          };
          setSettings(newSettings);
          setOriginalSettings(newSettings);
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

  const hasOrgDetailsChanged = () => {
    return (
      settings.organizationName !== originalSettings.organizationName ||
      settings.timezone !== originalSettings.timezone ||
      settings.industry !== originalSettings.industry ||
      settings.companySize !== originalSettings.companySize ||
      settings.website !== originalSettings.website
    );
  };

  const handleSaveDetails = async () => {
    if (!settings.organizationName.trim()) {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Organization name cannot be empty',
      });
      return;
    }

    setSavingDetails(true);
    try {
      const response = await fetch('/api/settings/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.organizationName,
          timezone: settings.timezone,
          industry: settings.industry || null,
          companySize: settings.companySize || null,
          website: settings.website || null,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setOriginalSettings({
          ...originalSettings,
          organizationName: settings.organizationName,
          timezone: settings.timezone,
          industry: settings.industry,
          companySize: settings.companySize,
          website: settings.website,
        });
        addToast({
          type: 'success',
          title: 'Success',
          description: 'Organization settings saved successfully',
        });
      } else {
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : data.message || data.error?.message || 'Failed to save settings';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
      });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleToggle = async (key: keyof Pick<OrganizationSettings, 'autoJoinMeetings' | 'autoGenerateSummaries' | 'extractActionItems'>, value: boolean) => {
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

      setOriginalSettings(prev => ({ ...prev, [key]: value }));
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

  // Show loading while checking auth
  if (status === 'loading' || (status === 'authenticated' && !isAdmin)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Organization Settings</h2>
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
        <h2 className="text-lg font-semibold text-slate-900">Organization Settings</h2>
        <p className="text-sm text-slate-500">Manage your organization settings and preferences</p>
      </div>

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary-600" />
            Organization Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Organization Name *
            </label>
            <input
              type="text"
              value={settings.organizationName}
              onChange={(e) => setSettings(prev => ({ ...prev, organizationName: e.target.value }))}
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter organization name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <Clock className="h-4 w-4 inline mr-1" />
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Industry
              </label>
              <select
                value={settings.industry}
                onChange={(e) => setSettings(prev => ({ ...prev, industry: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Company Size
              </label>
              <select
                value={settings.companySize}
                onChange={(e) => setSettings(prev => ({ ...prev, companySize: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {COMPANY_SIZES.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <Globe className="h-4 w-4 inline mr-1" />
                Website
              </label>
              <input
                type="url"
                value={settings.website}
                onChange={(e) => setSettings(prev => ({ ...prev, website: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="https://yourcompany.com"
              />
            </div>
          </div>

          <Button
            onClick={handleSaveDetails}
            disabled={savingDetails || !hasOrgDetailsChanged()}
          >
            {savingDetails ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Meeting Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
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
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Auto-generate summaries</p>
              <p className="text-sm text-slate-500">
                Automatically generate AI summaries after meetings end
              </p>
            </div>
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
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Extract action items</p>
              <p className="text-sm text-slate-500">
                Automatically identify and extract action items from meetings
              </p>
            </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
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
    </div>
  );
}
