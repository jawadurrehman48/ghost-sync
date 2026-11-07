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

// Hooks module
export { useOnlineStatus } from './hooks/useOnlineStatus';

// i18n module
export { default as i18n } from './i18n';
export { setLanguage, registerAppTranslations, getLanguage, LANGUAGES } from './i18n';
export type { Language } from './i18n';
export { useLanguage } from './i18n/useLanguage';

// UI shell module
export { AppShell } from './ui/AppShell';
export type { AppShellProps } from './ui/AppShell';
export { SyncStatusBadge } from './ui/SyncStatusBadge';
export type { SyncStatusBadgeProps } from './ui/SyncStatusBadge';
export { LanguageToggle } from './ui/LanguageToggle';
export type { LanguageToggleProps } from './ui/LanguageToggle';
