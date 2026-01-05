'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  MoreVertical,
  UserPlus,
  Eye,
  Edit,
  Ban,
  PlayCircle,
  Trash2,
} from 'lucide-react';

// Placeholder data
const users = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    organization: 'Acme Corp',
    status: 'active',
    createdAt: '2024-01-15',
    lastActive: '2 hours ago',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'member',
    organization: 'Acme Corp',
    status: 'active',
    createdAt: '2024-02-10',
    lastActive: '5 minutes ago',
  },
  {
    id: '3',
    name: 'Bob Wilson',
    email: 'bob@techstart.io',
    role: 'owner',
    organization: 'TechStart',
    status: 'suspended',
    createdAt: '2024-01-20',
    lastActive: '3 days ago',
  },
];

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500 mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  User
                </th>
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  Organization
                </th>
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  Role
                </th>
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  Status
                </th>
                <th className="text-left text-sm font-medium text-slate-500 px-6 py-3">
                  Last Active
                </th>
                <th className="text-right text-sm font-medium text-slate-500 px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-600 font-medium">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {user.organization}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-700">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        user.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {user.lastActive}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-slate-100 rounded-lg" title="View">
                        <Eye className="w-4 h-4 text-slate-500" />
                      </button>
                      <button className="p-2 hover:bg-slate-100 rounded-lg" title="Edit">
                        <Edit className="w-4 h-4 text-slate-500" />
                      </button>
                      <button className="p-2 hover:bg-slate-100 rounded-lg" title="Impersonate">
                        <PlayCircle className="w-4 h-4 text-slate-500" />
                      </button>
                      <button className="p-2 hover:bg-slate-100 rounded-lg" title="Suspend">
                        <Ban className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing 1 to {users.length} of {users.length} users
          </p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border border-slate-200 rounded text-sm hover:bg-slate-50 disabled:opacity-50" disabled>
              Previous
            </button>
            <button className="px-3 py-1 border border-slate-200 rounded text-sm hover:bg-slate-50 disabled:opacity-50" disabled>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
