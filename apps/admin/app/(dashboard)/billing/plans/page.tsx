'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Edit2,
  Archive,
  Loader2,
  CheckCircle,
  Users,
  DollarSign,
  RefreshCw,
  X,
} from 'lucide-react';
import { billingApi } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: string;
  trialDays: number;
  features: string[];
  limits: Record<string, number>;
  isActive: boolean;
  stripePriceId: string | null;
  subscriberCount: number;
  createdAt: string;
}

interface PlanForm {
  name: string;
  slug: string;
  description: string;
  amount: string;
  currency: string;
  interval: string;
  trialDays: string;
  features: string;
  limits: string;
  stripePriceId: string;
}

const defaultForm: PlanForm = {
  name: '',
  slug: '',
  description: '',
  amount: '',
  currency: 'USD',
  interval: 'month',
  trialDays: '14',
  features: '',
  limits: '',
  stripePriceId: '',
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await billingApi.plans();
      if (res.success && res.data) {
        const data = res.data as { plans: Plan[] };
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setForm(defaultForm);
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      amount: plan.amount.toString(), // amount is already in dollars from the backend
      currency: plan.currency,
      interval: plan.interval,
      trialDays: plan.trialDays.toString(),
      features: plan.features.join('\n'),
      limits: JSON.stringify(plan.limits, null, 2),
      stripePriceId: plan.stripePriceId || '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let limits: Record<string, number> = {};
      if (form.limits.trim()) {
        try {
          limits = JSON.parse(form.limits);
        } catch {
          setError('Invalid JSON in limits field');
          setSaving(false);
          return;
        }
      }

      const features = form.features
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      if (editingPlan) {
        const res = await billingApi.updatePlan(editingPlan.id, {
          name: form.name,
          description: form.description || undefined,
          features,
          limits,
          stripePriceId: form.stripePriceId || undefined,
        });

        if (!res.success) {
          setError(res.error?.message || 'Failed to update plan');
          setSaving(false);
          return;
        }
      } else {
        const res = await billingApi.createPlan({
          name: form.name,
          slug: form.slug,
          description: form.description || undefined,
          amount: Math.round(parseFloat(form.amount) * 100),
          currency: form.currency,
          interval: form.interval,
          trialDays: parseInt(form.trialDays) || 0,
          features,
          limits,
          stripePriceId: form.stripePriceId || undefined,
        });

        if (!res.success) {
          setError(res.error?.message || 'Failed to create plan');
          setSaving(false);
          return;
        }
      }

      fetchPlans();
      setShowModal(false);
    } catch (err) {
      setError('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (plan: Plan) => {
    if (!confirm(`Are you sure you want to archive "${plan.name}"? This will prevent new subscriptions to this plan.`)) {
      return;
    }

    try {
      const res = await billingApi.archivePlan(plan.id);
      if (res.success) {
        fetchPlans();
      }
    } catch (err) {
      console.error('Failed to archive plan:', err);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount); // amount is already in dollars from the backend
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pricing Plans</h1>
          <p className="text-slate-500 mt-1">Manage subscription pricing tiers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPlans}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Create Plan
          </button>
          <Link
            href="/billing"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Back to Billing
          </Link>
        </div>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No plans yet</h3>
          <p className="text-slate-500 mb-4">Create your first pricing plan to start accepting subscriptions</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Create Plan
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-lg shadow-sm border ${plan.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                    <p className="text-sm text-slate-500">{plan.slug}</p>
                  </div>
                  {!plan.isActive && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-500">
                      Archived
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-3xl font-bold text-slate-900">
                    {formatCurrency(plan.amount, plan.currency)}
                    <span className="text-base font-normal text-slate-500">/{plan.interval}</span>
                  </p>
                  {plan.trialDays > 0 && (
                    <p className="text-sm text-purple-600 mt-1">
                      {plan.trialDays}-day free trial
                    </p>
                  )}
                </div>

                {plan.description && (
                  <p className="text-sm text-slate-600 mb-4">{plan.description}</p>
                )}

                {plan.features.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {plan.features.slice(0, 5).map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                    {plan.features.length > 5 && (
                      <li className="text-sm text-slate-500">
                        +{plan.features.length - 5} more features
                      </li>
                    )}
                  </ul>
                )}

                <div className="flex items-center gap-2 text-sm text-slate-500 pt-4 border-t border-slate-100">
                  <Users className="w-4 h-4" />
                  {plan.subscriberCount} subscriber{plan.subscriberCount !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                <button
                  onClick={() => openEditModal(plan)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                {plan.isActive && (
                  <button
                    onClick={() => handleArchive(plan)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-white border border-slate-300 rounded-lg hover:bg-red-50"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingPlan ? 'Edit Plan' : 'Create Plan'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Pro Plan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Slug *
                  </label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100"
                    placeholder="pro"
                    required
                    disabled={!!editingPlan}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Best for growing teams..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100"
                    placeholder="29.00"
                    required
                    disabled={!!editingPlan}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100"
                    disabled={!!editingPlan}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Interval
                  </label>
                  <select
                    value={form.interval}
                    onChange={(e) => setForm({ ...form, interval: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100"
                    disabled={!!editingPlan}
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Trial Days
                </label>
                <input
                  type="number"
                  value={form.trialDays}
                  onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100"
                  placeholder="14"
                  disabled={!!editingPlan}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Features (one per line)
                </label>
                <textarea
                  value={form.features}
                  onChange={(e) => setForm({ ...form, features: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  placeholder={"Unlimited meetings\n100 hours of transcription\nPriority support"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Limits (JSON)
                </label>
                <textarea
                  value={form.limits}
                  onChange={(e) => setForm({ ...form, limits: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  placeholder={'{\n  "meetings": 100,\n  "transcription_hours": 50\n}'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Stripe Price ID
                </label>
                <input
                  type="text"
                  value={form.stripePriceId}
                  onChange={(e) => setForm({ ...form, stripePriceId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="price_..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  Link to an existing Stripe price for billing integration
                </p>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
