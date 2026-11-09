export interface ScreenHeaderProps {
  title: string;
  /** If provided, a back button is shown. */
  onBack?: () => void;
  /** Accessible label for the back button (pass a translated string). */
  backLabel?: string;
}

/**
 * Screen title with an optional back button (44x44px). The chevron mirrors
 * automatically in RTL layouts.
 */
export function ScreenHeader({ title, onBack, backLabel }: ScreenHeaderProps) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-100"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 rtl:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}
