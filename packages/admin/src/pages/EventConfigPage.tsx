import { useState, useEffect } from 'react';
import { useEventConfig, useUpdateEventConfig } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { SUPPORTED_LANGUAGES } from '@ziggy/shared';

interface ConfigForm {
  name: string;
  timezone: string;
  languages: string[];
  defaultLanguage: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    logoUrl: string;
  };
}

const defaultForm: ConfigForm = {
  name: '',
  timezone: 'Europe/Amsterdam',
  languages: ['nl', 'en'],
  defaultLanguage: 'nl',
  branding: {
    primaryColor: '#E30613',
    secondaryColor: '#1A1A2E',
    backgroundColor: '#0F0F1A',
    textColor: '#FFFFFF',
    logoUrl: '',
  },
};

export function EventConfigPage() {
  const { toast } = useToast();
  const config = useEventConfig();
  const updateMut = useUpdateEventConfig();
  const [form, setForm] = useState<ConfigForm>(defaultForm);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (config.data && !loaded) {
      setForm({
        name: config.data.name || '',
        timezone: config.data.timezone || 'Europe/Amsterdam',
        languages: config.data.languages || ['nl', 'en'],
        defaultLanguage: config.data.defaultLanguage || 'nl',
        branding: {
          primaryColor: config.data.branding?.primaryColor || '#E30613',
          secondaryColor: config.data.branding?.secondaryColor || '#1A1A2E',
          backgroundColor: config.data.branding?.backgroundColor || '#0F0F1A',
          textColor: config.data.branding?.textColor || '#FFFFFF',
          logoUrl: config.data.branding?.logoUrl || '',
        },
      });
      setLoaded(true);
    }
  }, [config.data, loaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMut.mutateAsync(form);
      toast('success', 'Event config updated');
    } catch {
      toast('error', 'Failed to update config');
    }
  };

  const toggleLanguage = (lang: string) => {
    setForm((prev) => {
      const has = prev.languages.includes(lang);
      const languages = has
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang];
      // If default language was removed, pick the first remaining
      const defaultLanguage = languages.includes(prev.defaultLanguage)
        ? prev.defaultLanguage
        : languages[0] || 'en';
      return { ...prev, languages, defaultLanguage };
    });
  };

  const setBranding = (key: keyof ConfigForm['branding'], value: string) => {
    setForm((prev) => ({
      ...prev,
      branding: { ...prev.branding, [key]: value },
    }));
  };

  if (config.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-400">Loading config...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Event Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">General settings for the event</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* General */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-secondary">General</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Event Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Timezone</label>
              <input
                value={form.timezone}
                onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Europe/Amsterdam"
              />
            </div>
          </div>
        </section>

        {/* Languages */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-secondary">Languages</h2>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Enabled Languages</label>
            <div className="flex flex-wrap gap-3">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <label
                  key={lang}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    form.languages.includes(lang)
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.languages.includes(lang)}
                    onChange={() => toggleLanguage(lang)}
                    className="sr-only"
                  />
                  <span className="uppercase">{lang}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Default Language</label>
            <select
              value={form.defaultLanguage}
              onChange={(e) => setForm((prev) => ({ ...prev, defaultLanguage: e.target.value }))}
              className="w-full max-w-xs rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {form.languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Branding */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-secondary">Branding</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <ColorField
              label="Primary Color"
              value={form.branding.primaryColor}
              onChange={(v) => setBranding('primaryColor', v)}
            />
            <ColorField
              label="Secondary Color"
              value={form.branding.secondaryColor}
              onChange={(v) => setBranding('secondaryColor', v)}
            />
            <ColorField
              label="Background Color"
              value={form.branding.backgroundColor}
              onChange={(v) => setBranding('backgroundColor', v)}
            />
            <ColorField
              label="Text Color"
              value={form.branding.textColor}
              onChange={(v) => setBranding('textColor', v)}
            />
          </div>

          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Logo URL</label>
            <input
              type="url"
              value={form.branding.logoUrl}
              onChange={(e) => setBranding('logoUrl', e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="https://..."
            />
            {form.branding.logoUrl && (
              <div className="mt-2">
                <img
                  src={form.branding.logoUrl}
                  alt="Logo preview"
                  className="max-h-16 rounded border border-border object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">Preview</label>
            <div
              className="flex items-center justify-center rounded-lg p-8"
              style={{ backgroundColor: form.branding.backgroundColor }}
            >
              <div className="text-center">
                <div
                  className="mb-2 inline-block rounded-lg px-4 py-2 text-sm font-bold"
                  style={{ backgroundColor: form.branding.primaryColor, color: '#fff' }}
                >
                  Primary Button
                </div>
                <p style={{ color: form.branding.textColor }} className="text-sm">
                  Sample text on background
                </p>
                <p style={{ color: form.branding.secondaryColor }} className="mt-1 text-xs">
                  Secondary accent
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMut.isPending}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {updateMut.isPending ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded-lg border border-border"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
