'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  ToggleLeft,
  ToggleRight,
  Edit,
  Trash2,
  Percent,
  Loader2,
  X,
} from 'lucide-react';
import { featureFlagsApi } from '@/lib/api';

interface TargetRule {
  type: 'org' | 'user' | 'plan';
  ids?: string[];
  value?: string;
}

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  percentage: number;
  category: string;
  targetRules: TargetRule[];
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FlagStats {
  total: number;
  enabled: number;
  disabled: number;
  gradualRollout: number;
}

const defaultCategories = ['all', 'general', 'ui', 'ai', 'transcription', 'integrations', 'billing'];

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [stats, setStats] = useState<FlagStats>({ total: 0, enabled: 0, disabled: 0, gradualRollout: 0 });
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '20',
      };
      if (searchQuery) params.search = searchQuery;
      if (selectedCategory !== 'all') params.category = selectedCategory;

      const response = await featureFlagsApi.list(params);
      if (response.success && response.data) {
        const responseData = response.data;
        if (Array.isArray(responseData)) {
          setFlags(responseData as FeatureFlag[]);
          setPagination(null);
        } else {
          const data = responseData as { data?: FeatureFlag[]; pagination?: Pagination };
          setFlags(data.data || []);
          setPagination(data.pagination || null);
        }
      } else {
        setError(response.error?.message || 'Failed to fetch feature flags');
      }
    } catch {
      setError('Failed to fetch feature flags');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedCategory]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await featureFlagsApi.stats();
      if (response.success && response.data) {
        setStats(response.data as FlagStats);
      }
    } catch {
      // Stats are optional, don't show error
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await featureFlagsApi.categories();
      if (response.success && response.data) {
        const cats = response.data as string[];
        setCategories(['all', ...cats]);
      }
    } catch {
      // Use default categories
    }
  }, []);

  useEffect(() => {
    fetchFlags();
    fetchStats();
    fetchCategories();
  }, [fetchFlags, fetchStats, fetchCategories]);

  const handleToggle = async (flagId: string) => {
    try {
      const response = await featureFlagsApi.toggle(flagId);
      if (response.success) {
        fetchFlags();
        fetchStats();
      } else {
        setError(response.error?.message || 'Failed to toggle flag');
      }
    } catch {
      setError('Failed to toggle flag');
    }
  };

  const handleDelete = async (flagId: string) => {
    if (!confirm('Are you sure you want to delete this feature flag?')) return;
    try {
      const response = await featureFlagsApi.delete(flagId);
      if (response.success) {
        fetchFlags();
        fetchStats();
      } else {
        setError(response.error?.message || 'Failed to delete flag');
      }
    } catch {
      setError('Failed to delete flag');
    }
  };

  const handleCreate = async (data: { key: string; name: string; description?: string; enabled?: boolean; percentage?: number; category?: string }) => {
    try {
      const response = await featureFlagsApi.create(data);
      if (response.success) {
        setShowAddModal(false);
        fetchFlags();
        fetchStats();
        fetchCategories();
      } else {
        setError(response.error?.message || 'Failed to create flag');
      }
    } catch {
      setError('Failed to create flag');
    }
  };

  const handleUpdate = async (flagId: string, data: unknown) => {
    try {
      const response = await featureFlagsApi.update(flagId, data);
      if (response.success) {
        setEditingFlag(null);
        fetchFlags();
        fetchStats();
      } else {
        setError(response.error?.message || 'Failed to update flag');
      }
    } catch {
      setError('Failed to update flag');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feature Flags</h1>
          <p className="text-slate-500 mt-1">
            Control feature rollouts and A/B tests
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          New Flag
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Flags</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Enabled</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.enabled}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Disabled</p>
          <p className="text-2xl font-bold text-slate-600 mt-1">{stats.disabled}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Gradual Rollout</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.gradualRollout}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search flags..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                selectedCategory === cat
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
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
          {/* Flags List */}
          <div className="space-y-4">
            {flags.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                No feature flags found
              </div>
            ) : (
              flags.map((flag) => (
                <div
                  key={flag.id}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">{flag.name}</h3>
                        <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {flag.key}
                        </code>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded capitalize">
                          {flag.category}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{flag.description || 'No description'}</p>
                      {flag.targetRules && flag.targetRules.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-slate-500">Targeting:</span>
                          {flag.targetRules.map((rule, i) => (
                            <span
                              key={i}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                            >
                              {rule.type}: {rule.value || (rule.ids?.join(', '))}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {flag.percentage < 100 && flag.enabled && (
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Percent className="w-4 h-4" />
                          {flag.percentage}%
                        </div>
                      )}
                      <button
                        onClick={() => handleToggle(flag.id)}
                        className={`p-2 rounded-lg ${
                          flag.enabled
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-slate-400 hover:bg-slate-50'
                        }`}
                        title={flag.enabled ? 'Disable' : 'Enable'}
                      >
                        {flag.enabled ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingFlag(flag)}
                        className="p-2 hover:bg-slate-100 rounded-lg"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(flag.id)}
                        className="p-2 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, pagination.total)} of{' '}
                {pagination.total} flags
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 border border-slate-200 rounded text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="px-3 py-1 border border-slate-200 rounded text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Flag Modal */}
      {showAddModal && (
        <AddFlagModal
          onClose={() => setShowAddModal(false)}
          onSave={handleCreate}
          categories={categories.filter((c) => c !== 'all')}
        />
      )}

      {/* Edit Flag Modal */}
      {editingFlag && (
        <EditFlagModal
          flag={editingFlag}
          onClose={() => setEditingFlag(null)}
          onSave={(data) => handleUpdate(editingFlag.id, data)}
          categories={categories.filter((c) => c !== 'all')}
        />
      )}
    </div>
  );
}

function AddFlagModal({
  onClose,
  onSave,
  categories,
}: {
  onClose: () => void;
  onSave: (data: { key: string; name: string; description?: string; enabled?: boolean; percentage?: number; category?: string }) => void;
  categories: string[];
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [percentage, setPercentage] = useState(100);
  const [category, setCategory] = useState('general');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ key, name, description, enabled, percentage, category });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Create Feature Flag</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Key</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
              placeholder="my_feature_flag"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-500 mt-1">Lowercase alphanumeric with dots, underscores, or hyphens</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Feature Flag"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this flag control?"
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rollout Percentage</label>
            <input
              type="number"
              value={percentage}
              onChange={(e) => setPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              min={0}
              max={100}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="enabled" className="text-sm text-slate-700">
              Enable flag immediately
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Create Flag
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditFlagModal({
  flag,
  onClose,
  onSave,
  categories,
}: {
  flag: FeatureFlag;
  onClose: () => void;
  onSave: (data: { name?: string; description?: string; percentage?: number; category?: string }) => void;
  categories: string[];
}) {
  const [name, setName] = useState(flag.name);
  const [description, setDescription] = useState(flag.description || '');
  const [percentage, setPercentage] = useState(flag.percentage);
  const [category, setCategory] = useState(flag.category);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, description, percentage, category });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Edit Feature Flag</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Key</label>
            <input
              type="text"
              value={flag.key}
              disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rollout Percentage</label>
            <input
              type="number"
              value={percentage}
              onChange={(e) => setPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              min={0}
              max={100}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
