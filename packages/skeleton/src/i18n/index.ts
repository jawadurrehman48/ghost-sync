import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ur from './locales/ur.json';

const LANG_KEY = 'ghost-sync-lang';

export const LANGUAGES = ['en', 'ur'] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * Read the persisted language from localStorage, defaulting to 'en'.
 * Returns 'en' if localStorage is unavailable or the stored value is invalid.
 */
function getInitialLanguage(): Language {
  if (typeof localStorage === 'undefined') return 'en';
  const stored = localStorage.getItem(LANG_KEY) as Language | null;
  return stored && LANGUAGES.includes(stored) ? stored : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

// Update document direction and persist language on change
i18n.on('languageChanged', (lng: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = lng === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LANG_KEY, lng);
    } catch {
      // localStorage write failed (private mode / quota) — non-fatal
    }
  }
});

/**
 * Switch the active language at runtime.
 * Triggers the 'languageChanged' event which updates document dir/lang
 * and persists the selection.
 */
export function setLanguage(lng: Language): void {
  void i18n.changeLanguage(lng);
}

/**
 * Allow an app to register additional translation keys per language,
 * merged on top of the shared skeleton keys.
 *
 * Skeleton keys take precedence — app keys with the same name will NOT
 * overwrite existing skeleton keys (addResourceBundle with overwrite: false).
 *
 * @example
 * registerAppTranslations({
 *   en: { 'khata.title': 'Khata Ledger', 'khata.addCustomer': 'Add Customer' },
 *   ur: { 'khata.title': 'کھاتہ', 'khata.addCustomer': 'گاہک شامل کریں' },
 * });
 */
export function registerAppTranslations(
  translations: Partial<Record<Language, Record<string, string>>>,
): void {
  for (const [lng, keys] of Object.entries(translations)) {
    if (keys) {
      i18n.addResourceBundle(lng, 'translation', keys, true, false);
    }
  }
}

/**
 * Get the current language code.
 */
export function getLanguage(): Language {
  return (i18n.language as Language) || 'en';
}

export default i18n;
