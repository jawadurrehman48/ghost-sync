import { useTranslation } from 'react-i18next';
import { setLanguage as setLang, LANGUAGES, type Language } from './index';

/**
 * React hook for language management.
 *
 * Returns the current language, a setter function, and the list of
 * available languages. Re-renders automatically when the language changes.
 *
 * @example
 * const { language, setLanguage, languages } = useLanguage();
 * // language === 'en' | 'ur'
 * // setLanguage('ur')
 */
export function useLanguage(): {
  language: Language;
  setLanguage: (lng: Language) => void;
  languages: readonly Language[];
} {
  const { i18n: i18nInstance } = useTranslation();
  return {
    language: (i18nInstance.language as Language) || 'en',
    setLanguage: setLang,
    languages: LANGUAGES,
  };
}
