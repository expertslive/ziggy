import { useState } from 'react';
import { useSponsors, useSponsorTiers, useCreateSponsor, useUpdateSponsor, useDeleteSponsor, useFloorMaps } from '../lib/hooks';
import { SlideOver } from '../components/SlideOver';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { FieldError, FormError } from '../components/FieldError';
import { I18nDot } from '../components/I18nDot';
import { SUPPORTED_LANGUAGES } from '@ziggy/shared';

interface SponsorForm {
  name: string;
  tierId: string;
  description: Record<string, string>;
  logoUrl: string;
  logoOnDark: boolean;
  website: string;
  boothNumber: string;
  floorMapHotspotId: string;
  sortOrder: number;
}

const emptyForm: SponsorForm = {
  name: '',
  tierId: '',
  description: {},
  logoUrl: '',
  logoOnDark: false,
  website: '',
  boothNumber: '',
  floorMapHotspotId: '',
  sortOrder: 0,
};

export function SponsorsPage() {
  const { toast } = useToast();
  const sponsors = useSponsors();
  const tiers = useSponsorTiers();
  const floorMaps = useFloorMaps();
  const createMut = useCreateSponsor();
  const updateMut = useUpdateSponsor();
  const deleteMut = useDeleteSponsor();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SponsorForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPanelOpen(true);
  };

  const openEdit = (sponsor: any) => {
    setEditingId(sponsor.id);
    setForm({
      name: sponsor.name || '',
      tierId: sponsor.tierId || '',
      description: sponsor.description || {},
      logoUrl: sponsor.logoUrl || '',
      logoOnDark: sponsor.logoOnDark ?? false,
      website: sponsor.website || '',
      boothNumber: sponsor.boothNumber || '',
      floorMapHotspotId: sponsor.floorMapHotspotId || '',
      sortOrder: sponsor.sortOrder ?? 0,
    });
    setPanelOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    // Empty strings on optional fields would fail zod min(1) / url(); send undefined.
    const payload = {
      ...form,
      website: form.website || undefined,
      boothNumber: form.boothNumber || undefined,
      floorMapHotspotId: form.floorMapHotspotId || undefined,
    };
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: payload });
        toast('success', 'Sponsor updated');
      } else {
        await createMut.mutateAsync(payload);
        toast('success', 'Sponsor created');
      }
      setPanelOpen(false);
    } catch (err) {
      setSubmitError(err);
      toast('error', 'Failed to save sponsor');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast('success', 'Sponsor deleted');
    } catch {
      toast('error', 'Failed to delete sponsor');
    }
    setDeleteTarget(null);
  };

  const tierMap = new Map((tiers.data || []).map((t: any) => [t.id, t.name]));

  const setField = <K extends keyof SponsorForm>(key: K, value: SponsorForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setDescription = (lang: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      description: { ...prev.description, [lang]: value },
    }));
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Sponsors</h1>
            <p className="mt-1 text-sm text-gray-500">Manage event sponsors</p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            + Add Sponsor
          </button>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden">
        {sponsors.isLoading && (
          <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
            Loading...
          </div>
        )}
        {sponsors.data?.length === 0 && (
          <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
            No sponsors yet. Add one to get started.
          </div>
        )}
        <ul className="space-y-3">
          {sponsors.data?.map((sponsor: any) => (
            <li key={sponsor.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                {sponsor.logoUrl ? (
                  <img
                    src={sponsor.logoUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg border border-border object-contain"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-sm font-bold text-gray-400">
                    {sponsor.name?.[0] || '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-secondary">{sponsor.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500">
                    <span>{tierMap.get(sponsor.tierId) || '-'}</span>
                    {sponsor.boothNumber && <span>Booth {sponsor.boothNumber}</span>}
                    <span>Sort: {sponsor.sortOrder}</span>
                  </div>
                </div>
                <I18nDot record={sponsor.description} />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => openEdit(sponsor)}
                  className="min-h-11 flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-surface-alt"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: sponsor.id, name: sponsor.name })}
                  className="min-h-11 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-white shadow-sm md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Tier</th>
              <th className="px-6 py-3">Booth</th>
              <th className="px-6 py-3">i18n</th>
              <th className="px-6 py-3">Sort Order</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sponsors.isLoading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {sponsors.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  No sponsors yet. Add one to get started.
                </td>
              </tr>
            )}
            {sponsors.data?.map((sponsor: any) => (
              <tr key={sponsor.id} className="hover:bg-surface-alt/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {sponsor.logoUrl ? (
                      <img
                        src={sponsor.logoUrl}
                        alt=""
                        className="h-8 w-8 rounded-lg border border-border object-contain"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-alt text-xs font-bold text-gray-400">
                        {sponsor.name?.[0] || '?'}
                      </div>
                    )}
                    <span className="text-sm font-medium text-secondary">{sponsor.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {tierMap.get(sponsor.tierId) || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{sponsor.boothNumber || '-'}</td>
                <td className="px-6 py-4">
                  <I18nDot record={sponsor.description} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{sponsor.sortOrder}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => openEdit(sponsor)}
                    className="mr-2 text-sm font-medium text-primary hover:text-primary-dark"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: sponsor.id, name: sponsor.name })}
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
        title={editingId ? 'Edit Sponsor' : 'Add Sponsor'}
        onClose={() => setPanelOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormError error={submitError} />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <FieldError error={submitError} path="name" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Tier *</label>
            <select
              required
              value={form.tierId}
              onChange={(e) => setField('tierId', e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select a tier</option>
              {(tiers.data || []).map((tier: any) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
            <FieldError error={submitError} path="tierId" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Logo URL</label>
            <input
              type="url"
              value={form.logoUrl}
              onChange={(e) => setField('logoUrl', e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="https://..."
            />
            <FieldError error={submitError} path="logoUrl" />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={form.logoOnDark ?? false}
                onChange={(e) => setField('logoOnDark', e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
              />
              <span>Logo op donkere achtergrond (voor witte logo's)</span>
            </label>
            <p className="mt-1 text-xs text-gray-400">
              Toon deze sponsor op een donkere kaart i.p.v. wit — handig voor logo's die wit op transparant zijn.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Website</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setField('website', e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="https://..."
            />
            <FieldError error={submitError} path="website" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Booth Number</label>
            <input
              value={form.boothNumber}
              onChange={(e) => setField('boothNumber', e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. A12"
            />
            <FieldError error={submitError} path="boothNumber" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Floor map hotspot (optional)
            </label>
            <select
              value={form.floorMapHotspotId}
              onChange={(e) => setField('floorMapHotspotId', e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">— None —</option>
              {(floorMaps.data || []).flatMap((map: any) =>
                (map.hotspots || []).map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {map.name} — {h.roomName}
                  </option>
                )),
              )}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Links this sponsor to a floor-map room for the kiosk's "Show on map" button.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setField('sortOrder', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <FieldError error={submitError} path="sortOrder" />
          </div>

          {/* Description per language */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Description (per language)</label>
            <div className="space-y-3">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <div key={lang}>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-400">{lang}</label>
                  <textarea
                    rows={2}
                    value={form.description[lang] || ''}
                    onChange={(e) => setDescription(lang, e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder={`Description in ${lang}`}
                  />
                  <FieldError error={submitError} path={['description', lang]} />
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
              {saving ? 'Saving...' : editingId ? 'Update Sponsor' : 'Create Sponsor'}
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
        title="Delete Sponsor"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
