'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Key, History, Loader2, Copy, Check, X, AlertTriangle } from 'lucide-react';

interface LoginEntry {
  id: string;
  browser: string;
  device: string;
  ipAddress: string;
  location: string | null;
  success: boolean;
  reason: string | null;
  createdAt: string;
}

export default function SecurityPage() {
  const { data: session, update } = useSession();
  const user = session?.user;

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // 2FA state
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [twoFactorMessage, setTwoFactorMessage] = useState('');
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Login history state
  const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load login history on mount
  useEffect(() => {
    loadLoginHistory();
  }, []);

  const loadLoginHistory = async () => {
    try {
      const res = await fetch('/api/user/sessions');
      const data = await res.json();
      if (data.success) {
        setLoginHistory(data.data);
      }
    } catch (error) {
      console.error('Error loading login history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMessage('');
    setPasswordError(false);

    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match');
      setPasswordError(true);
      setPasswordSaving(false);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage('Password must be at least 8 characters');
      setPasswordError(true);
      setPasswordSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setPasswordMessage('Password changed successfully!');
        setPasswordError(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordMessage(''), 3000);
      } else {
        setPasswordMessage(data.error || 'Failed to change password');
        setPasswordError(true);
      }
    } catch {
      setPasswordMessage('An error occurred');
      setPasswordError(true);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSetup2FA = async () => {
    setTwoFactorLoading(true);
    setTwoFactorMessage('');

    try {
      const res = await fetch('/api/user/two-factor');
      const data = await res.json();

      if (data.success && data.data.secret) {
        setTwoFactorSecret(data.data.secret);
        setShowTwoFactorSetup(true);
      } else if (data.data.enabled) {
        setTwoFactorMessage('2FA is already enabled');
      }
    } catch (error) {
      console.error('Error setting up 2FA:', error);
      setTwoFactorMessage('Failed to set up 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    if (twoFactorCode.length !== 6) {
      setTwoFactorMessage('Please enter a 6-digit code');
      return;
    }

    setTwoFactorLoading(true);
    setTwoFactorMessage('');

    try {
      const res = await fetch('/api/user/two-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFactorCode }),
      });

      const data = await res.json();

      if (data.success) {
        setBackupCodes(data.data.backupCodes);
        setShowBackupCodes(true);
        setShowTwoFactorSetup(false);
        setTwoFactorCode('');
        await update(); // Refresh session
      } else {
        setTwoFactorMessage(data.error || 'Failed to enable 2FA');
      }
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      setTwoFactorMessage('Failed to enable 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      setTwoFactorMessage('Password is required');
      return;
    }

    setTwoFactorLoading(true);
    setTwoFactorMessage('');

    try {
      const res = await fetch('/api/user/two-factor', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword }),
      });

      const data = await res.json();

      if (data.success) {
        setShowDisable2FA(false);
        setDisablePassword('');
        setTwoFactorMessage('2FA has been disabled');
        await update(); // Refresh session
        setTimeout(() => setTwoFactorMessage(''), 3000);
      } else {
        setTwoFactorMessage(data.error || 'Failed to disable 2FA');
      }
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      setTwoFactorMessage('Failed to disable 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(twoFactorSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Security</h2>
        <p className="text-sm text-slate-500">Manage your account security settings</p>
      </div>

      {/* Password Change */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Key className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900">Change Password</h3>
            <p className="text-sm text-slate-500">Update your password regularly for security</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Current Password
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              New Password
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 8 characters)"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Confirm New Password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>

          {passwordMessage && (
            <p className={`text-sm ${passwordError ? 'text-red-600' : 'text-green-600'}`}>
              {passwordMessage}
            </p>
          )}

          <Button type="submit" disabled={passwordSaving}>
            {passwordSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Changing...
              </>
            ) : (
              'Change Password'
            )}
          </Button>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Shield className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Two-Factor Authentication</h3>
              <p className="text-sm text-slate-500">
                {user?.twoFactorEnabled
                  ? 'Two-factor authentication is enabled'
                  : 'Add an extra layer of security to your account'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              user?.twoFactorEnabled
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </span>
            {user?.twoFactorEnabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDisable2FA(true)}
                disabled={twoFactorLoading}
              >
                Disable
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetup2FA}
                disabled={twoFactorLoading}
              >
                {twoFactorLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Enable'
                )}
              </Button>
            )}
          </div>
        </div>

        {twoFactorMessage && (
          <p className={`mt-4 text-sm ${twoFactorMessage.includes('disabled') || twoFactorMessage.includes('enabled') ? 'text-green-600' : 'text-red-600'}`}>
            {twoFactorMessage}
          </p>
        )}
      </div>

      {/* 2FA Setup Modal */}
      {showTwoFactorSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Set Up Two-Factor Authentication</h3>
              <button onClick={() => setShowTwoFactorSetup(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Scan this QR code with your authenticator app, or enter the secret key manually.
              </p>

              {/* QR Code placeholder - in production, generate actual QR code */}
              <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <p className="text-sm text-slate-500">QR Code</p>
                <p className="text-xs text-slate-400 mt-1">
                  Use Google Authenticator or Authy
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Secret Key
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={twoFactorSecret}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={copySecret}>
                    {copiedSecret ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Verification Code
                </label>
                <Input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
              </div>

              {twoFactorMessage && (
                <p className="text-sm text-red-600">{twoFactorMessage}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowTwoFactorSetup(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEnable2FA} disabled={twoFactorLoading || twoFactorCode.length !== 6}>
                  {twoFactorLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Enable 2FA'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Codes Modal */}
      {showBackupCodes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold">Save Your Backup Codes</h3>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Save these backup codes in a secure location. You can use them to access your account if you lose your authenticator device.
            </p>

            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <code key={index} className="font-mono text-sm bg-white px-2 py-1 rounded border">
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Each code can only be used once. Generate new codes if you run out.
            </p>

            <Button onClick={() => setShowBackupCodes(false)} className="w-full">
              I&apos;ve Saved My Codes
            </Button>
          </div>
        </div>
      )}

      {/* Disable 2FA Modal */}
      {showDisable2FA && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-600">Disable Two-Factor Authentication</h3>
              <button onClick={() => setShowDisable2FA(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              This will remove 2FA from your account. Enter your password to confirm.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {twoFactorMessage && (
              <p className="text-sm text-red-600 mb-4">{twoFactorMessage}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDisable2FA(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisable2FA}
                disabled={twoFactorLoading || !disablePassword}
              >
                {twoFactorLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Disable 2FA'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Login History */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 rounded-lg">
            <History className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900">Recent Login Activity</h3>
            <p className="text-sm text-slate-500">Monitor your account access</p>
          </div>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : loginHistory.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No login history available</p>
        ) : (
          <div className="space-y-3">
            {loginHistory.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between py-3 ${
                  index < loginHistory.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {entry.browser} on {entry.device}
                  </p>
                  <p className="text-xs text-slate-500">
                    {entry.ipAddress} • {formatDate(entry.createdAt)}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  entry.success
                    ? index === 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {entry.success ? (index === 0 ? 'Current' : 'Success') : 'Failed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
