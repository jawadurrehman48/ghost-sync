import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  /** muted = greyed (for reversed / inactive items) */
  tone?: 'default' | 'muted';
  className?: string;
  /** Makes the whole card a button (min 56px tall, full width). */
  onClick?: () => void;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}

const BASE = 'rounded-xl border p-4 shadow-sm';
const TONE = {
  default: 'border-gray-100 bg-white',
  muted: 'border-gray-200 bg-gray-50',
} as const;

/** The one card style for every screen. Put only inline content (spans) inside a clickable card. */
export function Card({ children, tone = 'default', className = '', onClick, ...aria }: CardProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${BASE} ${TONE[tone]} block min-h-[56px] w-full text-start transition-colors hover:bg-gray-50 active:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${className}`}
        {...aria}
      >
        {children}
      </button>
    );
  }
  return (
    <div className={`${BASE} ${TONE[tone]} ${className}`} {...aria}>
      {children}
    </div>
  );
}
