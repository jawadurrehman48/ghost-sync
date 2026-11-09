import type { ReactNode } from 'react';

export type NoticeTone = 'error' | 'success' | 'info';

const TONE: Record<NoticeTone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-brand-200 bg-brand-50 text-brand-800',
};

const ICON_PATH: Record<NoticeTone, string> = {
  error: 'M12 8v5M12 16.5v.5M12 3l10 18H2L12 3z',
  success: 'M5 13l4 4L19 7',
  info: 'M12 11v6M12 7.5v.5',
};

export interface NoticeProps {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}

/**
 * An inline message. Errors use role="alert" (announced at once); the rest use
 * role="status". The icon means colour is never the only signal.
 */
export function Notice({ tone = 'info', children, className = '' }: NoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex animate-fade-in items-start gap-3 rounded-xl border p-3 text-sm font-medium ${TONE[tone]} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICON_PATH[tone]} />
      </svg>
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}
