'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  User,
  MoreVertical,
  UserX,
  UserCheck,
  Eye,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
} from 'lucide-react';
import { usersApi } from '@/lib/api';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  organization?: {
    id: string;
    name: string;
  };
  createdAt: string;
  deletedAt: string | null;
  lastLoginAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  member: 'bg-green-100 text-green-700',
  viewer: 'bg-slate-100 text-slate-700',
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [page, setPage] = useState(1);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '20',
      };
      if (searchQuery) params.search = searchQuery;
      if (selectedRole !== 'all') params.role = selectedRole;

      const response = await usersApi.list(params);
      if (response.success && response.data) {
        const responseData = response.data;
        if (Array.isArray(responseData)) {
          setUsers(responseData as UserData[]);
          setPagination(null);
        } else {
          const data = responseData as { data?: UserData[]; pagination?: Pagination };
          setUsers(data.data || []);
          setPagination(data.pagination || null);
        }
      } else {
        setError(response.error?.message || 'Failed to fetch users');
      }
    } catch {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedRole]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const handleClickOutside = () => setActionMenuOpen(null);
    if (actionMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [actionMenuOpen]);

  const handleSuspend = async (userId: string) => {
    try {
      const response = await usersApi.update(userId, { deletedAt: new Date().toISOString() });
      if (response.success) {
        fetchUsers();
      }
    } catch {
      setError('Failed to suspend user');
    }
    setActionMenuOpen(null);
  };

  const handleRestore = async (userId: string) => {
    try {
      const response = await usersApi.update(userId, { deletedAt: null });
      if (response.success) {
        fetchUsers();
      }
    } catch {
      setError('Failed to restore user');
    }
    setActionMenuOpen(null);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      const response = await usersApi.delete(userId);
      if (response.success) {
        fetchUsers();
      }
    } catch {
      setError('Failed to delete user');
    }
    setActionMenuOpen(null);
  };

  const handleImpersonate = async (userId: string) => {
    try {
      const response = await usersApi.impersonate(userId);
      if (response.success) {
        alert('Impersonation token generated. Check console for details.');
        console.log('Impersonation response:', response.data);
      }
    } catch {
      setError('Failed to impersonate user');
    }
    setActionMenuOpen(null);
  };

  const stats = {
    total: pagination?.total || users.length,
    active: users.filter((u) => !u.deletedAt).length,
    suspended: users.filter((u) => u.deletedAt).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500 mt-1">Manage user accounts across all organizations</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Users</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Suspended</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.suspended}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={selectedRole}
          onChange={(e) => {
            setSelectedRole(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          {/* Users Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.name || 'Unnamed'}</p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {user.organization?.name || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${roleColors[user.role] || 'bg-slate-100 text-slate-700'}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.deletedAt ? (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-700">
                            Suspended
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuOpen(actionMenuOpen === user.id ? null : user.id);
                            }}
                            className="p-2 hover:bg-slate-100 rounded-lg"
                          >
                            <MoreVertical className="w-4 h-4 text-slate-500" />
                          </button>
                          {actionMenuOpen === user.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                              <button
                                onClick={() => {/* View details */}}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                View Details
                              </button>
                              <button
                                onClick={() => handleImpersonate(user.id)}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <PlayCircle className="w-4 h-4" />
                                Impersonate
                              </button>
                              {user.deletedAt ? (
                                <button
                                  onClick={() => handleRestore(user.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <UserCheck className="w-4 h-4" />
                                  Restore User
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSuspend(user.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-yellow-600 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <UserX className="w-4 h-4" />
                                  Suspend User
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Permanently
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, pagination.total)} of{' '}
                {pagination.total} users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 text-sm">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
