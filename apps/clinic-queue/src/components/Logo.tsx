/**
 * The Clinic Queue logo: a token ticket with a medical cross, on the brand teal.
 * Decorative (the app name is shown beside it). Same drawing as public/favicon.svg.
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" className="fill-brand-600" />
      <path
        d="M14 18h36a4 4 0 0 1 4 4v6a4 4 0 0 0 0 8v6a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4v-6a4 4 0 0 0 0-8v-6a4 4 0 0 1 4-4z"
        fill="#fff"
      />
      <path d="M29 24h6v5h5v6h-5v5h-6v-5h-5v-6h5z" className="fill-brand-600" />
    </svg>
  );
}
