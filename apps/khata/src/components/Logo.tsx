/**
 * The Khata logo: an open ledger book on the brand colour.
 * Decorative (the app name is always shown beside it), so it is hidden from screen readers.
 * The same drawing is used for the favicon and the PWA icons (see public/favicon.svg).
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" className="fill-brand-600" />
      <path d="M32 20C26 15 18 14 10 16V46C18 44 26 45 32 50Z" fill="#fff" />
      <path d="M32 20C38 15 46 14 54 16V46C46 44 38 45 32 50Z" fill="#fff" fillOpacity="0.88" />
      <path
        d="M32 20V50M15 24h12M15 30h12M15 36h9M37 24h12M37 30h12M37 36h9"
        className="stroke-brand-600"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
