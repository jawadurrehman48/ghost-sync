import type { ReactNode } from 'react';

export type StatTone = 'default' | 'brand' | 'success' | 'warning' | 'danger';

const VALUE_COLOR: Record<StatTone, string> = {
  default: 'text-gray-900',
  brand: 'text-brand-700',
  success: 'text-green-700',
  warning: 'text-amber-700',
  danger: 'text-red-600',
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  /** Small text under the value, e.g. a unit or explanation. */
  hint?: string;
}

/**
 * A small card with a big number and a label, for dashboards.
 * The label is always shown, so colour is never the only signal.
 * Numbers stay left-to-right inside Urdu text.
 */
export function StatCard({ label, value, tone = 'default', hint }: StatCardProps) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <span className="text-sm text-gray-600">{label}</span>
      <span dir="ltr" className={`text-start font-sans text-2xl font-bold tabular-nums ${VALUE_COLOR[tone]}`}>
        {value}
      </span>
      {hint ? <span className="text-xs text-gray-600">{hint}</span> : null}
    </div>
  );
}
