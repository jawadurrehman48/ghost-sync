// Storage module
export { getOrCreateDeviceId, _resetMemoryDeviceId } from './storage/deviceId';
export { createDatabase, clearAllData } from './storage/db';
export type { TypedDexie, StorageConfig } from './storage/db';
export { createStore } from './storage/store';
export type { Store, SyncableStore } from './storage/store';
export { deriveState } from './storage/derive';
export type { Reducer } from './storage/derive';
export type {
  BaseRecord,
  Record as SkeletonRecord,
  SyncedRow,
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
export { normalizePhone, validatePakistaniPhone, formatPhone } from './utils/phone';
export { csvField, csvSafeText, csvLine, csvDocument, createCsvBlob, downloadBlob } from './utils/csv';
export { toInternationalPk, whatsAppLink, smsLink } from './utils/share';
export { singleFlight } from './utils/once';
export { collapseSpaces, nameKey } from './utils/text';
export { formatTime, minutesBetween, localHour, isValidTimestamp } from './utils/time';
export {
  toISODate,
  todayISO,
  isValidISODate,
  formatDateDMY,
  monthRange,
  weekRange,
  addDays,
  daysBetween,
} from './utils/date';

// Hooks module
export { useOnlineStatus } from './hooks/useOnlineStatus';
export { useSubmitGuard } from './hooks/useSubmitGuard';
export type { SubmitGuard } from './hooks/useSubmitGuard';
export { useStoreSnapshot } from './hooks/useStoreSnapshot';
export { useNow } from './hooks/useNow';
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
export { Button } from './ui/Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './ui/Button';
export { Card } from './ui/Card';
export type { CardProps } from './ui/Card';
export { TextField, TextAreaField, FieldShell } from './ui/TextField';
export type { FieldShellProps, TextFieldProps, TextAreaFieldProps } from './ui/TextField';
export { ConfirmDialog } from './ui/ConfirmDialog';
export type { ConfirmDialogProps } from './ui/ConfirmDialog';
export { EmptyState } from './ui/EmptyState';
export type { EmptyStateProps } from './ui/EmptyState';
export { FloatingActionButton } from './ui/FloatingActionButton';
export type { FloatingActionButtonProps } from './ui/FloatingActionButton';
export { Notice } from './ui/Notice';
export type { NoticeProps, NoticeTone } from './ui/Notice';
export { LoadingState } from './ui/LoadingState';
export type { LoadingStateProps } from './ui/LoadingState';
export { Spinner } from './ui/Spinner';
export type { SpinnerProps } from './ui/Spinner';
export { ErrorBoundary } from './ui/ErrorBoundary';
export type { ErrorBoundaryProps } from './ui/ErrorBoundary';
export { GroupedBarChart } from './ui/GroupedBarChart';
export type { BarGroup, BarSeries, GroupedBarChartProps } from './ui/GroupedBarChart';
export { StatCard } from './ui/StatCard';
export type { StatCardProps, StatTone } from './ui/StatCard';
export { ChoiceGroup } from './ui/ChoiceGroup';
export type { Choice, ChoiceGroupProps } from './ui/ChoiceGroup';
export { BottomNav } from './ui/BottomNav';
export type { BottomNavItem, BottomNavProps } from './ui/BottomNav';
export { ScreenHeader } from './ui/ScreenHeader';
export type { ScreenHeaderProps } from './ui/ScreenHeader';
export { LanguageToggle } from './ui/LanguageToggle';
export type { LanguageToggleProps } from './ui/LanguageToggle';
