import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useI18nOverrides } from '../lib/hooks';

export function I18nOverrideLoader() {
  const { i18n } = useTranslation();
  const { data: overrides } = useI18nOverrides();

  useEffect(() => {
    if (!overrides) return;
    for (const item of overrides) {
      // Convert flat keys to nested: "nav.now" -> { nav: { now: "value" } }
      const nested: Record<string, any> = {};
      for (const [flatKey, value] of Object.entries(item.overrides)) {
        if (!value) continue;
        const parts = flatKey.split('.');
        let obj = nested;
        for (let i = 0; i < parts.length - 1; i++) {
          obj[parts[i]] = obj[parts[i]] || {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      }
      i18n.addResourceBundle(item.language, 'translation', nested, true, true);
    }
  }, [overrides, i18n]);

  return null;
}
