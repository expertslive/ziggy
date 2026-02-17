import { useState, useEffect } from 'react';
import { fetchI18nOverrides, updateI18nOverrides, fetchEventConfig } from '../lib/api';
import { useToast } from '../components/Toast';

const OVERRIDE_KEYS = [
  'nav.now',
  'nav.agenda',
  'nav.speakers',
  'nav.map',
  'nav.sponsors',
  'nav.search',
  'now.title',
  'now.subtitle',
  'now.upNext',
  'now.noSessions',
  'now.timeRemaining',
  'agenda.title',
  'speakers.title',
  'map.title',
  'sponsors.title',
  'search.title',
  'search.placeholder',
];

// Built-in default translations for placeholder display
const DEFAULTS: Record<string, Record<string, string>> = {
  en: {
    'nav.now': 'Now',
    'nav.agenda': 'Agenda',
    'nav.speakers': 'Speakers',
    'nav.map': 'Map',
    'nav.sponsors': 'Sponsors',
    'nav.search': 'Search',
    'now.title': "What's Happening Now",
    'now.subtitle': 'View the sessions currently taking place.',
    'now.upNext': 'Up Next',
    'now.noSessions': 'There are no sessions right now.',
    'now.timeRemaining': '{{minutes}} remaining',
    'agenda.title': 'Agenda',
    'speakers.title': 'Speakers',
    'map.title': 'Floor Map',
    'sponsors.title': 'Sponsors',
    'search.title': 'Search',
    'search.placeholder': 'Search sessions, speakers, or booths...',
  },
  nl: {
    'nav.now': 'Nu',
    'nav.agenda': 'Agenda',
    'nav.speakers': 'Sprekers',
    'nav.map': 'Plattegrond',
    'nav.sponsors': 'Sponsors',
    'nav.search': 'Zoeken',
    'now.title': 'Wat is er nu?',
    'now.subtitle': 'Bekijk de sessies die nu plaatsvinden.',
    'now.upNext': 'Binnenkort',
    'now.noSessions': 'Er zijn momenteel geen sessies.',
    'now.timeRemaining': 'Nog {{minutes}}',
    'agenda.title': 'Agenda',
    'speakers.title': 'Sprekers',
    'map.title': 'Plattegrond',
    'sponsors.title': 'Sponsors',
    'search.title': 'Zoeken',
    'search.placeholder': 'Zoek sessies, sprekers of stands...',
  },
};

export function I18nOverridesPage() {
  const { toast } = useToast();
  const [languages, setLanguages] = useState<string[]>(['nl', 'en']);
  const [activeLang, setActiveLang] = useState('nl');
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Load event config to get languages
        const config = await fetchEventConfig();
        if (config?.languages?.length) {
          setLanguages(config.languages);
          setActiveLang(config.languages[0] || 'nl');
        }

        // Load existing overrides
        const items = await fetchI18nOverrides();
        const map: Record<string, Record<string, string>> = {};
        for (const item of items) {
          map[item.language] = item.overrides || {};
        }
        setOverrides(map);
      } catch {
        // Ignore — use defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getOverrideValue = (lang: string, key: string): string => {
    return overrides[lang]?.[key] || '';
  };

  const setOverrideValue = (lang: string, key: string, value: string) => {
    setOverrides((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const langOverrides = overrides[activeLang] || {};
      // Only send non-empty values
      const filtered: Record<string, string> = {};
      for (const [key, value] of Object.entries(langOverrides)) {
        if (value.trim()) {
          filtered[key] = value;
        }
      }
      await updateI18nOverrides(activeLang, filtered);
      toast('success', `Translation overrides for "${activeLang.toUpperCase()}" saved`);
    } catch {
      toast('error', 'Failed to save overrides');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-400">Loading translations...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Translation Overrides</h1>
        <p className="mt-1 text-sm text-gray-500">
          Override the default kiosk translation strings per language. Leave empty to use the built-in default.
        </p>
      </div>

      {/* Language tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-white p-1 shadow-sm w-fit">
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => setActiveLang(lang)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeLang === lang
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-surface-alt hover:text-secondary'
            }`}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Overrides table */}
      <section className="rounded-xl border border-border bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-0 border-b border-border bg-surface-alt px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <div>Key</div>
          <div>Default Value</div>
          <div>Override</div>
        </div>
        <div className="divide-y divide-border">
          {OVERRIDE_KEYS.map((key) => {
            const defaultValue = DEFAULTS[activeLang]?.[key] || DEFAULTS['en']?.[key] || '';
            const overrideValue = getOverrideValue(activeLang, key);

            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_1fr_1fr] items-center gap-4 px-6 py-3"
              >
                <div className="font-mono text-sm text-gray-700">{key}</div>
                <div className="text-sm text-gray-500">{defaultValue}</div>
                <input
                  type="text"
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(activeLang, key, e.target.value)}
                  placeholder={defaultValue}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Save button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Overrides'}
        </button>
      </div>
    </div>
  );
}
