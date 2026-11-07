import type { Language } from '../i18n';

export interface LanguageToggleProps {
  language: Language;
  onToggle: () => void;
}

/**
 * Button that toggles between English and Urdu.
 * Shows the label of the *other* language (the one you'd switch to):
 * - When `en` is active, shows "اردو"
 * - When `ur` is active, shows "English"
 *
 * Minimum touch target: 44x44px.
 */
export function LanguageToggle({ language, onToggle }: LanguageToggleProps) {
  const label = language === 'en' ? 'اردو' : 'English';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Switch language"
      className="inline-flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 min-h-[44px] min-w-[44px] transition-colors"
    >
      {label}
    </button>
  );
}
