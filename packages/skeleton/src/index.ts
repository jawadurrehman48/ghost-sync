// Storage module
export { getOrCreateDeviceId, _resetMemoryDeviceId } from './storage/deviceId';
export { createDatabase } from './storage/db';
export type { TypedDexie, StorageConfig } from './storage/db';
export { createStore } from './storage/store';
export type { Store } from './storage/store';
export { deriveState } from './storage/derive';
export type { Reducer } from './storage/derive';
export type {
  BaseRecord,
  Record as SkeletonRecord,
  SyncedRow,
  Collections,
  CollectionPayload,
  CollectionRecords,
  CollectionSyncedRows,
} from './storage/types';

// Sync module
export type { SyncStatus, SyncStatusListener, SyncEngine, SyncEngineConfig } from './sync/types';
export { createSyncStatusStore } from './sync/status';
export type { SyncStatusStore } from './sync/status';
export { InMemorySyncAdapter } from './sync/adapter';
export type { SyncAdapter } from './sync/adapter';
export { createSyncEngine } from './sync/engine';

// Utils module (formatting, validation, dates: shared by all apps)
export { toAsciiDigits } from './utils/digits';
export { formatPaisa, paisaFromRupees, parseWholeRupees } from './utils/money';
export { normalizePhone, validatePakistaniPhone } from './utils/phone';
export { toISODate, todayISO, isValidISODate, formatDateDMY, monthRange } from './utils/date';

// Hooks module
export { useOnlineStatus } from './hooks/useOnlineStatus';
export { useStoreSnapshot } from './hooks/useStoreSnapshot';
export type { StoreSnapshot, UseStoreSnapshotOptions } from './hooks/useStoreSnapshot';

// i18n module
export { default as i18n } from './i18n';
export { setLanguage, registerAppTranslations, getLanguage, LANGUAGES } from './i18n';
export type { Language } from './i18n';
export { useLanguage } from './i18n/useLanguage';
// Re-exported so apps translate text without importing react-i18next directly.
export { useTranslation } from 'react-i18next';

// UI shell module
export { AppShell } from './ui/AppShell';
export type { AppShellProps } from './ui/AppShell';
export { SyncStatusBadge } from './ui/SyncStatusBadge';
export type { SyncStatusBadgeProps } from './ui/SyncStatusBadge';
export { BottomNav } from './ui/BottomNav';
export type { BottomNavItem, BottomNavProps } from './ui/BottomNav';
export { ScreenHeader } from './ui/ScreenHeader';
export type { ScreenHeaderProps } from './ui/ScreenHeader';
export { LanguageToggle } from './ui/LanguageToggle';
export type { LanguageToggleProps } from './ui/LanguageToggle';
