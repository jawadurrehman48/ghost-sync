import type { SyncableStore } from '../storage/store';
import type { SyncAdapter } from './adapter';

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
 * Any store works, because the engine only needs the sync-internal methods.
 */
export interface SyncEngineConfig {
  adapter: SyncAdapter;
  store: SyncableStore;
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
