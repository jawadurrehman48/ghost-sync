import type { ReactNode } from 'react';
import type { SyncStatus } from '../sync/types';
import type { Language } from '../i18n';
import { SyncStatusBadge } from './SyncStatusBadge';
import { LanguageToggle } from './LanguageToggle';

export interface AppShellProps {
  appName: string;
  children: ReactNode;
  syncStatus?: SyncStatus;
  onSyncNow?: () => void;
  language?: Language;
  onToggleLanguage?: () => void;
}

/**
 * App shell with a sticky header containing the app name,
 * sync status badge, and language toggle, plus a scrollable
 * content area for the app's screens.
 *
 * Mobile-first, targeting screens as small as 360px.
 * On desktop, the content is constrained to a phone-width column
 * (max-w-md) centered on the page with a neutral background.
 * Uses Tailwind logical properties (ps, pe, ms, me) for RTL support.
 */
export function AppShell({
  appName,
  children,
  syncStatus,
  onSyncNow,
  language,
  onToggleLanguage,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-200">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50 shadow-lg">
        {/* Sticky header */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between bg-white ps-4 pe-4 shadow-sm">
          {/* App name */}
          <h1 className="truncate text-lg font-semibold text-gray-900">
            {appName}
          </h1>

          {/* Right cluster: sync badge + language toggle */}
          <div className="flex items-center gap-2">
            {syncStatus && (
              <SyncStatusBadge status={syncStatus} onClick={onSyncNow} />
            )}
            {language && onToggleLanguage && (
              <LanguageToggle language={language} onToggle={onToggleLanguage} />
            )}
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
