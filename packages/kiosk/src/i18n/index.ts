import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import nl from './nl.json';
import en from './en.json';
import de from './de.json';
import fr from './fr.json';

i18n.use(initReactI18next).init({
  resources: {
    nl: { translation: nl },
    en: { translation: en },
    de: { translation: de },
    fr: { translation: fr },
  },
  lng: 'nl',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
