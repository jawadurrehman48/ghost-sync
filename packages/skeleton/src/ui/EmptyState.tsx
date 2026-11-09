import type { ReactNode } from 'react';
import { Button } from './Button';
import { Card } from './Card';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Both must be given to show the action button. */
  actionLabel?: string;
  onAction?: () => void;
}

/** A friendly "nothing here yet" card that tells people what to do next. */
export function EmptyState({ title, description, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Card className="flex animate-fade-in flex-col items-center gap-3 py-8 text-center">
      {icon ? (
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700"
        >
          {icon}
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description ? <p className="max-w-xs text-sm text-gray-600">{description}</p> : null}
      {actionLabel && onAction ? (
        <div className="w-full pt-2">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </Card>
  );
}
