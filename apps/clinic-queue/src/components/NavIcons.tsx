import type { ReactNode } from 'react';

function Icon({ children, className = 'h-6 w-6' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const QueueIcon = () => (
  <Icon>
    <circle cx="6" cy="8" r="2.5" />
    <circle cx="12" cy="8" r="2.5" />
    <circle cx="18" cy="8" r="2.5" />
    <path d="M2 19c0-3 2-5 4-5s4 2 4 5M8 19c0-3 2-5 4-5s4 2 4 5M14 19c0-3 2-5 4-5s4 2 4 5" />
  </Icon>
);

export const PatientsIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </Icon>
);

export const SummaryIcon = () => (
  <Icon>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);

export const SettingsIcon = () => (
  <Icon>
    <path d="M4 6h16M4 12h16M4 18h16" />
    <circle cx="9" cy="6" r="2" fill="white" />
    <circle cx="15" cy="12" r="2" fill="white" />
    <circle cx="8" cy="18" r="2" fill="white" />
  </Icon>
);

export const TicketIcon = () => (
  <Icon>
    <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" />
    <path d="M12 9v6M9 12h6" />
  </Icon>
);

export const ScreenIcon = () => (
  <Icon className="h-5 w-5">
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
);
