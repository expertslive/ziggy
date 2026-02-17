import { useState } from 'react';
import { useSponsorTiers, useCreateSponsorTier, useUpdateSponsorTier, useDeleteSponsorTier } from '../lib/hooks';
import { SlideOver } from '../components/SlideOver';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { SUPPORTED_LANGUAGES } from '@ziggy/shared';

interface TierForm {
  name: string;
  label: Record<string, string>;
  displaySize: 'large' | 'medium' | 'small';
  sortOrder: number;
}

const emptyForm: TierForm = {
  name: '',
  label: {},
  displaySize: 'medium',
  sortOrder: 0,
};

export function SponsorTiersPage() {
  const { toast } = useToast();
  const tiers = useSponsorTiers();
  const createMut = useCreateSponsorTier();
  const updateMut = useUpdateSponsorTier();
  const deleteMut = useDeleteSponsorTier();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TierForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPanelOpen(true);
  };

  const openEdit = (tier: any) => {
    setEditingId(tier.id);
    setForm({
      name: tier.name || '',
      label: tier.label || {},
      displaySize: tier.displaySize || 'medium',
      sortOrder: tier.sortOrder ?? 0,
    });
    setPanelOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: form });
        toast('success', 'Tier updated');
      } else {
        await createMut.mutateAsync(form);
        toast('success', 'Tier created');
      }
      setPanelOpen(false);
    } catch {
      toast('error', 'Failed to save tier');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast('success', 'Tier deleted');
    } catch {
      toast('error', 'Failed to delete tier');
    }
    setDeleteTarget(null);
  };

  const setField = <K extends keyof TierForm>(key: K, value: TierForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setLabel = (lang: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      label: { ...prev.label, [lang]: value },
    }));
  };

  const saving = createMut.isPending || updateMut.isPending;

  const sizeLabel = (size: string) => {
    switch (size) {
      case 'large': return 'Large';
      case 'medium': return 'Medium';
      case 'small': return 'Small';
      default: return size;
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Sponsor Tiers</h1>
          <p className="mt-1 text-sm text-gray-500">Manage sponsor tier levels</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          + Add Tier
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Display Size</th>
              <th className="px-6 py-3">Sort Order</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tiers.isLoading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {tiers.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                  No tiers yet. Add one to get started.
                </td>
              </tr>
            )}
            {tiers.data?.map((tier: any) => (
              <tr key={tier.id} className="hover:bg-surface-alt/50">
                <td className="px-6 py-4 text-sm font-medium text-secondary">{tier.name}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      tier.displaySize === 'large'
                        ? 'bg-amber-100 text-amber-800'
                        : tier.displaySize === 'medium'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {sizeLabel(tier.displaySize)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{tier.sortOrder}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => openEdit(tier)}
                    className="mr-2 text-sm font-medium text-primary hover:text-primary-dark"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: tier.id, name: tier.name })}
                    className="text-sm font-medium text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Panel */}
      <SlideOver
        open={panelOpen}
        title={editingId ? 'Edit Tier' : 'Add Tier'}
        onClose={() => setPanelOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Gold, Silver, Bronze"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Display Size *</label>
            <select
              required
              value={form.displaySize}
              onChange={(e) => setField('displaySize', e.target.value as TierForm['displaySize'])}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="large">Large</option>
              <option value="medium">Medium</option>
              <option value="small">Small</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setField('sortOrder', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Label per language */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Label (per language)</label>
            <div className="space-y-3">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <div key={lang}>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-400">{lang}</label>
                  <input
                    value={form.label[lang] || ''}
                    onChange={(e) => setLabel(lang, e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder={`Label in ${lang}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 border-t border-border pt-5">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update Tier' : 'Create Tier'}
            </button>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-surface-alt"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideOver>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Tier"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Sponsors using this tier may be affected.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
