import type { ReactNode } from 'react';

export interface FloatingActionButtonProps {
  /** Accessible name (a translated string). It is also shown as a tooltip. */
  label: string;
  onClick: () => void;
  /** Defaults to a "+" icon. */
  icon?: ReactNode;
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * A round 56px action button floating above the bottom navigation, inside the
 * phone-width column (not the far edge of a desktop window). It sits at the END
 * side, so it is on the right in English and on the left in Urdu.
 */
export function FloatingActionButton({ label, onClick, icon }: FloatingActionButtonProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[80px] z-30 mx-auto flex max-w-md justify-end pe-4">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-transform hover:bg-brand-700 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {icon ?? <PlusIcon />}
      </button>
    </div>
  );
}
