import { useTranslation } from 'react-i18next';
import type { SyncStatus } from '../sync/types';

export interface SyncStatusBadgeProps {
  status: SyncStatus;
  onClick?: () => void;
}

/**
 * Compact pill showing the current sync status.
 *
 * States: offline (gray), pending count (amber), syncing (blue spinner),
 * synced (green), error (red). Clickable when `onClick` is provided
 * and not currently syncing.
 *
 * Uses Tailwind logical properties for RTL support.
 * Minimum touch target: 44x44px.
 */
export function SyncStatusBadge({ status, onClick }: SyncStatusBadgeProps) {
  const { t } = useTranslation();

  const config = getStatusConfig(status, t);
  const clickable = onClick !== undefined && status.state !== 'syncing';

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      aria-label={config.label}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium min-h-[44px] min-w-[44px] ${config.bg} ${config.text} ${clickable ? 'cursor-pointer hover:opacity-80 active:opacity-60' : 'cursor-default'}`}
    >
      {config.spinner ? (
        <span
          className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      ) : (
        <span
          className={`inline-block h-3 w-3 rounded-full ${config.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{config.label}</span>
    </button>
  );
}

function getStatusConfig(
  status: SyncStatus,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  switch (status.state) {
    case 'synced':
      return {
        label: t('sync.synced'),
        bg: 'bg-green-100',
        text: 'text-green-800',
        dot: 'bg-green-500',
        spinner: false,
      };
    case 'pending':
      return {
        label: t('sync.pending', { count: status.count }),
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        dot: 'bg-amber-500',
        spinner: false,
      };
    case 'syncing':
      return {
        label: t('sync.syncing'),
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        dot: 'bg-blue-500',
        spinner: true,
      };
    case 'offline':
      return {
        label: t('sync.offline'),
        bg: 'bg-gray-200',
        text: 'text-gray-700',
        dot: 'bg-gray-500',
        spinner: false,
      };
    case 'error':
      return {
        label: t('sync.error'),
        bg: 'bg-red-100',
        text: 'text-red-800',
        dot: 'bg-red-500',
        spinner: false,
      };
  }
}
