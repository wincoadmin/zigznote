'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Link2,
  Mail,
  Copy,
  Check,
  Lock,
  Clock,
  Eye,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { sharingApi, MeetingShare, CreateShareOptions } from '@/lib/api';

interface ShareDialogProps {
  meetingId: string;
  meetingTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

type ShareTab = 'link' | 'email';

export function ShareDialog({ meetingId, meetingTitle, isOpen, onClose }: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>('link');
  const [shares, setShares] = useState<MeetingShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Link share form
  const [linkOptions, setLinkOptions] = useState({
    password: '',
    expiresInDays: 7,
    maxViews: 0,
    includeTranscript: true,
    includeSummary: true,
    includeActionItems: true,
    includeRecording: false,
  });

  // Email share form
  const [emailOptions, setEmailOptions] = useState({
    recipientEmail: '',
    recipientName: '',
    message: '',
    includeTranscript: true,
    includeSummary: true,
    includeActionItems: true,
    includeRecording: false,
  });

  const fetchShares = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await sharingApi.listShares(meetingId);
      if (response.success && response.data) {
        setShares(response.data);
      }
    } catch {
      setError('Failed to load shares');
    } finally {
      setIsLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (isOpen) {
      fetchShares();
    }
  }, [isOpen, fetchShares]);

  const createLinkShare = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const options: CreateShareOptions = {
        meetingId,
        shareType: 'link',
        accessLevel: 'view',
        ...linkOptions,
        password: linkOptions.password || undefined,
        maxViews: linkOptions.maxViews || undefined,
      };

      const response = await sharingApi.create(options);
      if (response.success) {
        await fetchShares();
        setLinkOptions({
          password: '',
          expiresInDays: 7,
          maxViews: 0,
          includeTranscript: true,
          includeSummary: true,
          includeActionItems: true,
          includeRecording: false,
        });
      } else {
        setError('Failed to create share link');
      }
    } catch {
      setError('Failed to create share link');
    } finally {
      setIsCreating(false);
    }
  };

  const createEmailShare = async () => {
    if (!emailOptions.recipientEmail) {
      setError('Email address is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const options: CreateShareOptions = {
        meetingId,
        shareType: 'email',
        accessLevel: 'view',
        recipientEmail: emailOptions.recipientEmail,
        recipientName: emailOptions.recipientName || undefined,
        message: emailOptions.message || undefined,
        includeTranscript: emailOptions.includeTranscript,
        includeSummary: emailOptions.includeSummary,
        includeActionItems: emailOptions.includeActionItems,
        includeRecording: emailOptions.includeRecording,
      };

      const response = await sharingApi.create(options);
      if (response.success) {
        await fetchShares();
        setEmailOptions({
          recipientEmail: '',
          recipientName: '',
          message: '',
          includeTranscript: true,
          includeSummary: true,
          includeActionItems: true,
          includeRecording: false,
        });
      } else {
        setError('Failed to send share email');
      }
    } catch {
      setError('Failed to send share email');
    } finally {
      setIsCreating(false);
    }
  };

  const revokeShare = async (shareId: string) => {
    try {
      const response = await sharingApi.revoke(shareId);
      if (response.success) {
        setShares(shares.filter((s) => s.id !== shareId));
      }
    } catch {
      setError('Failed to revoke share');
    }
  };

  const copyToClipboard = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl bg-white shadow-2xl mx-4 sm:mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">Share Meeting</h2>
            <p className="text-xs sm:text-sm text-slate-500 truncate max-w-[200px] sm:max-w-xs">{meetingTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 sm:p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab('link')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'link'
                ? 'border-b-2 border-primary-500 text-primary-600'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Link2 className="inline-block h-4 w-4 mr-2" />
            Share Link
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'email'
                ? 'border-b-2 border-primary-500 text-primary-600'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Mail className="inline-block h-4 w-4 mr-2" />
            Email
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-6">
          {activeTab === 'link' ? (
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-1.5">
                  Password protection (optional)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    value={linkOptions.password}
                    onChange={(e) => setLinkOptions({ ...linkOptions, password: e.target.value })}
                    placeholder="Leave empty for no password"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-1.5">
                    <Clock className="inline-block h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                    Expires in
                  </label>
                  <Select
                    value={String(linkOptions.expiresInDays)}
                    onChange={(e) =>
                      setLinkOptions({ ...linkOptions, expiresInDays: parseInt(e.target.value) })
                    }
                  >
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-1.5">
                    <Eye className="inline-block h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                    View limit
                  </label>
                  <Select
                    value={String(linkOptions.maxViews)}
                    onChange={(e) =>
                      setLinkOptions({ ...linkOptions, maxViews: parseInt(e.target.value) })
                    }
                  >
                    <option value="0">Unlimited</option>
                    <option value="1">1 view</option>
                    <option value="5">5 views</option>
                    <option value="10">10 views</option>
                    <option value="50">50 views</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3 pt-2">
                <p className="text-xs sm:text-sm font-medium text-slate-700">Include in share:</p>
                <Switch
                  checked={linkOptions.includeTranscript}
                  onChange={(e) =>
                    setLinkOptions({ ...linkOptions, includeTranscript: e.target.checked })
                  }
                  label="Transcript"
                  size="sm"
                />
                <Switch
                  checked={linkOptions.includeSummary}
                  onChange={(e) =>
                    setLinkOptions({ ...linkOptions, includeSummary: e.target.checked })
                  }
                  label="Summary"
                  size="sm"
                />
                <Switch
                  checked={linkOptions.includeActionItems}
                  onChange={(e) =>
                    setLinkOptions({ ...linkOptions, includeActionItems: e.target.checked })
                  }
                  label="Action Items"
                  size="sm"
                />
                <Switch
                  checked={linkOptions.includeRecording}
                  onChange={(e) =>
                    setLinkOptions({ ...linkOptions, includeRecording: e.target.checked })
                  }
                  label="Recording"
                  size="sm"
                />
              </div>

              <Button
                onClick={createLinkShare}
                isLoading={isCreating}
                className="w-full"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Create Share Link
              </Button>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-1.5">
                  Recipient email *
                </label>
                <Input
                  type="email"
                  value={emailOptions.recipientEmail}
                  onChange={(e) =>
                    setEmailOptions({ ...emailOptions, recipientEmail: e.target.value })
                  }
                  placeholder="colleague@company.com"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-1.5">
                  Recipient name (optional)
                </label>
                <Input
                  type="text"
                  value={emailOptions.recipientName}
                  onChange={(e) =>
                    setEmailOptions({ ...emailOptions, recipientName: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-1.5">
                  Personal message (optional)
                </label>
                <textarea
                  value={emailOptions.message}
                  onChange={(e) =>
                    setEmailOptions({ ...emailOptions, message: e.target.value })
                  }
                  placeholder="Hey, I wanted to share this meeting with you..."
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 transition-all duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div className="space-y-2 sm:space-y-3 pt-2">
                <p className="text-xs sm:text-sm font-medium text-slate-700">Include in share:</p>
                <Switch
                  checked={emailOptions.includeTranscript}
                  onChange={(e) =>
                    setEmailOptions({ ...emailOptions, includeTranscript: e.target.checked })
                  }
                  label="Transcript"
                  size="sm"
                />
                <Switch
                  checked={emailOptions.includeSummary}
                  onChange={(e) =>
                    setEmailOptions({ ...emailOptions, includeSummary: e.target.checked })
                  }
                  label="Summary"
                  size="sm"
                />
                <Switch
                  checked={emailOptions.includeActionItems}
                  onChange={(e) =>
                    setEmailOptions({ ...emailOptions, includeActionItems: e.target.checked })
                  }
                  label="Action Items"
                  size="sm"
                />
                <Switch
                  checked={emailOptions.includeRecording}
                  onChange={(e) =>
                    setEmailOptions({ ...emailOptions, includeRecording: e.target.checked })
                  }
                  label="Recording"
                  size="sm"
                />
              </div>

              <Button
                onClick={createEmailShare}
                isLoading={isCreating}
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Share Email
              </Button>
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
          )}

          {/* Existing shares */}
          {shares.length > 0 && (
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-100">
              <h3 className="text-xs sm:text-sm font-medium text-slate-700 mb-2 sm:mb-3">Active shares</h3>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {shares.map((share) => (
                    <Card
                      key={share.id}
                      className="p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {share.shareType === 'link' ? (
                            <Link2 className="h-4 w-4 text-slate-400 shrink-0" />
                          ) : (
                            <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {share.shareType === 'email'
                                ? share.recipientEmail
                                : 'Share link'}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              {share.hasPassword && (
                                <span className="flex items-center gap-0.5">
                                  <Lock className="h-3 w-3" />
                                  Protected
                                </span>
                              )}
                              <span>{share.viewCount} views</span>
                              {share.expiresAt && (
                                <span>
                                  Expires {new Date(share.expiresAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {share.shareUrl && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyToClipboard(share.shareUrl!)}
                                className="h-8 w-8"
                              >
                                {copied ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(share.shareUrl!, '_blank')}
                                className="h-8 w-8"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => revokeShare(share.id)}
                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
