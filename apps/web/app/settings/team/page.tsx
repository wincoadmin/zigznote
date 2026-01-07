'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Users, UserPlus, Shield, Mail, MoreVertical, Clock, Trash2, RefreshCw } from 'lucide-react';

interface Member {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
  invitedBy: {
    name: string | null;
    email: string;
  };
}

export default function TeamMembersPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  const [actionMemberId, setActionMemberId] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = (session?.user as any)?.role === 'admin';
  const currentUserId = session?.user?.id;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch('/api/members'),
        isAdmin ? fetch('/api/members/invitations') : Promise.resolve(null),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        if (data.success) {
          setMembers(data.data);
        }
      }

      if (invitationsRes?.ok) {
        const data = await invitationsRes.json();
        if (data.success) {
          setInvitations(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Failed to load team members',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Please enter an email address',
      });
      return;
    }

    setInviting(true);
    try {
      const response = await fetch('/api/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        addToast({
          type: 'success',
          title: 'Invitation Sent',
          description: `Invitation sent to ${inviteEmail}`,
        });
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteRole('member');
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Failed to invite:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invitation',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: 'member' | 'admin') => {
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        addToast({
          type: 'success',
          title: 'Role Updated',
          description: `Member role updated to ${newRole}`,
        });
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Failed to update role:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
      });
    }
    setActionMemberId(null);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        addToast({
          type: 'success',
          title: 'Member Removed',
          description: 'Member has been removed from the organization',
        });
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
      });
    }
    setActionMemberId(null);
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/members/invitations/${invitationId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        addToast({
          type: 'success',
          title: 'Invitation Cancelled',
          description: 'The invitation has been cancelled',
        });
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to cancel invitation');
      }
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel invitation',
      });
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/members/resend-invite/${invitationId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        addToast({
          type: 'success',
          title: 'Invitation Resent',
          description: 'A new invitation email has been sent',
        });
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to resend invitation');
      }
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      addToast({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resend invitation',
      });
    }
  };

  const getInitials = (member: Member) => {
    if (member.firstName && member.lastName) {
      return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
    }
    if (member.name) {
      const parts = member.name.split(' ');
      return parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : member.name.substring(0, 2).toUpperCase();
    }
    return member.email.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Team Members</h2>
          <p className="text-sm text-slate-500">Manage your organization's team members</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Team Members</h2>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? 'Manage your organization\'s team members and invitations'
              : 'View your organization\'s team members'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-600" />
            Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {members.map((member) => (
              <div key={member.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name || member.email}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium text-sm">
                      {getInitials(member)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">
                        {member.name || member.firstName
                          ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
                          : member.email}
                      </p>
                      {member.id === currentUserId && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 text-xs rounded font-medium ${
                      member.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {member.role === 'admin' && <Shield className="h-3 w-3 inline mr-1" />}
                    {member.role}
                  </span>
                  {isAdmin && member.id !== currentUserId && (
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActionMemberId(actionMemberId === member.id ? null : member.id)
                        }
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        <MoreVertical className="h-5 w-5 text-slate-400" />
                      </button>
                      {actionMemberId === member.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-10">
                          <div className="py-1">
                            <button
                              onClick={() =>
                                handleUpdateRole(
                                  member.id,
                                  member.role === 'admin' ? 'member' : 'admin'
                                )
                              }
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Make {member.role === 'admin' ? 'Member' : 'Admin'}
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              Remove from Organization
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <p className="py-8 text-center text-slate-500">No team members found</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations (Admin Only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary-600" />
              Pending Invitations ({invitations.filter((i) => !i.isExpired).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{invitation.email}</p>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Clock className="h-3 w-3" />
                        {invitation.isExpired ? (
                          <span className="text-red-500">Expired</span>
                        ) : (
                          <span>Expires {formatDate(invitation.expiresAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 text-xs rounded font-medium ${
                        invitation.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {invitation.role}
                    </span>
                    <button
                      onClick={() => handleResendInvitation(invitation.id)}
                      className="p-2 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700"
                      title="Resend invitation"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="p-2 hover:bg-red-50 rounded text-slate-500 hover:text-red-600"
                      title="Cancel invitation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {invitations.length === 0 && (
                <p className="py-8 text-center text-slate-500">No pending invitations</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Invite Team Member</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Admins can manage team members, settings, and billing.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 rounded-b-lg flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteRole('member');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {actionMemberId && (
        <div className="fixed inset-0 z-0" onClick={() => setActionMemberId(null)} />
      )}
    </div>
  );
}
