import type { ReactNode } from 'react';
import type { SyncStatus } from '../sync/types';
import type { Language } from '../i18n';
import { SyncStatusBadge } from './SyncStatusBadge';
import { LanguageToggle } from './LanguageToggle';

export interface AppShellProps {
  appName: string;
  children: ReactNode;
  /** Shown before the app name, e.g. the app's SVG logo (about 32px). */
  logo?: ReactNode;
  syncStatus?: SyncStatus;
  onSyncNow?: () => void;
  language?: Language;
  onToggleLanguage?: () => void;
}

/**
 * App shell with a sticky header (logo, app name, sync status badge, language
 * toggle) and a content area, in a phone-width column centred on wide screens.
 *
 * Mobile-first, targeting screens as small as 360px.
 * Uses Tailwind logical properties (ps, pe, ms, me) for RTL support.
 */
export function AppShell({
  appName,
  children,
  logo,
  syncStatus,
  onSyncNow,
  language,
  onToggleLanguage,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-200">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50 shadow-lg">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 bg-white ps-4 pe-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-2">
            {logo ? <span className="shrink-0">{logo}</span> : null}
            <h1 className="truncate text-lg font-bold text-gray-900">{appName}</h1>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {syncStatus && <SyncStatusBadge status={syncStatus} onClick={onSyncNow} />}
            {language && onToggleLanguage && <LanguageToggle language={language} onToggle={onToggleLanguage} />}
          </div>
        </header>

        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
