import { useRef, useState } from 'react';
import {
  useShopItems,
  useCreateShopItem,
  useUpdateShopItem,
  useDeleteShopItem,
} from '../lib/hooks';
import { uploadImage } from '../lib/api';
import { SlideOver } from '../components/SlideOver';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { SUPPORTED_LANGUAGES } from '@ziggy/shared';

interface ShopItemForm {
  name: string;
  description: Record<string, string>;
  imageUrl: string;
  priceLabel: string;
  isHighlighted: boolean;
  sortOrder: number;
}

const emptyForm: ShopItemForm = {
  name: '',
  description: {},
  imageUrl: '',
  priceLabel: '',
  isHighlighted: false,
  sortOrder: 0,
};

export function ShopItemsPage() {
  const { toast } = useToast();
  const items = useShopItems();
  const createMut = useCreateShopItem();
  const updateMut = useUpdateShopItem();
  const deleteMut = useDeleteShopItem();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ShopItemForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageMode('upload');
    setPanelOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      description: item.description || {},
      imageUrl: item.imageUrl || '',
      priceLabel: item.priceLabel || '',
      isHighlighted: !!item.isHighlighted,
      sortOrder: item.sortOrder ?? 0,
    });
    setImageMode(item.imageUrl ? 'url' : 'upload');
    setPanelOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form };
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: payload });
        toast('success', 'Shop item updated');
      } else {
        await createMut.mutateAsync(payload);
        toast('success', 'Shop item created');
      }
      setPanelOpen(false);
    } catch {
      toast('error', 'Failed to save shop item');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast('success', 'Shop item deleted');
    } catch {
      toast('error', 'Failed to delete shop item');
    }
    setDeleteTarget(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast('success', 'Image uploaded');
    } catch {
      toast('error', 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setField = <K extends keyof ShopItemForm>(key: K, value: ShopItemForm[K]) => {
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Shop Items</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage merchandise sold at the event for charity
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          + Add Shop Item
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Image</th>
              <th className="px-6 py-3">Price</th>
              <th className="px-6 py-3">Featured</th>
              <th className="px-6 py-3">Sort Order</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.isLoading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {items.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  No shop items yet. Add one to get started.
                </td>
              </tr>
            )}
            {items.data?.map((item: any) => (
              <tr key={item.id} className="hover:bg-surface-alt/50">
                <td className="px-6 py-4 text-sm font-medium text-secondary">{item.name}</td>
                <td className="px-6 py-4">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded border border-border object-cover"
                    />
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.priceLabel}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {item.isHighlighted ? 'Yes' : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.sortOrder}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => openEdit(item)}
                    className="mr-2 text-sm font-medium text-primary hover:text-primary-dark"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
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
        title={editingId ? 'Edit Shop Item' : 'Add Shop Item'}
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
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Price label *</label>
            <input
              required
              value={form.priceLabel}
              onChange={(e) => setField('priceLabel', e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder='e.g. €25 or "Veiling — bied bij de balie"'
            />
            <p className="mt-1 text-xs text-gray-400">
              Free-form text. Use any currency or wording (e.g. auction).
            </p>
          </div>

          {/* Image upload / URL */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Image *</label>
              <button
                type="button"
                onClick={() => setImageMode(imageMode === 'upload' ? 'url' : 'upload')}
                className="text-xs font-medium text-primary hover:text-primary-dark"
              >
                {imageMode === 'upload' ? 'Paste URL instead' : 'Upload file instead'}
              </button>
            </div>

            {imageMode === 'upload' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-4 text-sm font-medium text-gray-500 hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      {form.imageUrl ? 'Replace image' : 'Upload image'}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setField('imageUrl', e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="https://..."
              />
            )}

            {form.imageUrl && (
              <div className="mt-2">
                <img
                  src={form.imageUrl}
                  alt="Preview"
                  className="h-24 w-24 rounded border border-border object-cover"
                />
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={form.isHighlighted}
                onChange={(e) => setField('isHighlighted', e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
              />
              Highlighted (featured)
            </label>
            <p className="mt-1 text-xs text-gray-400">
              Featured items get ring styling on the kiosk and appear in a "Featured" section
              (e.g. unique octocat auction).
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
          </div>

          {/* Description per language */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description (per language)
            </label>
            <div className="space-y-3">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <div key={lang}>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-400">
                    {lang}
                  </label>
                  <textarea
                    rows={2}
                    value={form.description[lang] || ''}
                    onChange={(e) => setDescription(lang, e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder={`Description in ${lang}`}
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
              {saving ? 'Saving...' : editingId ? 'Update Shop Item' : 'Create Shop Item'}
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
        title="Delete Shop Item"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
