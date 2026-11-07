/**
 * Sync status states reported by the sync engine.
 */
export type SyncStatus =
  | { state: 'synced' }
  | { state: 'pending'; count: number }
  | { state: 'syncing' }
  | { state: 'offline' }
  | { state: 'error'; message: string };

/**
 * Listener function called when sync status changes.
 */
export type SyncStatusListener = (status: SyncStatus) => void;

/**
 * Configuration for the sync engine.
 */
export interface SyncEngineConfig {
  adapter: import('../sync/adapter').SyncAdapter;
  store: import('../storage/store').Store<any>;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * The sync engine public API.
 */
export interface SyncEngine {
  /** Trigger a sync cycle manually. */
  syncNow: () => Promise<void>;
  /** Get the current sync status. */
  getStatus: () => SyncStatus;
  /** Subscribe to status changes. Returns an unsubscribe function. */
  subscribe: (fn: SyncStatusListener) => () => void;
  /** Start listening to online/offline events for auto-sync. */
  start: () => void;
  /** Stop listening and clean up. */
  stop: () => void;
}
