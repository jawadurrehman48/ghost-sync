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
  | { state: 'error'; message: string }
  /** No cloud is configured: data stays on this device and nothing is sent anywhere. */
  | { state: 'local' };

/**
 * Listener function called when sync status changes.
 */
export type SyncStatusListener = (status: SyncStatus) => void;

/**
 * Configuration for the sync engine.
 * Any store works, because the engine only needs the sync-internal methods.
 */
export interface SyncEngineConfig {
  /** `null` means local-only mode: the engine never syncs and reports `{ state: 'local' }`. */
  adapter: SyncAdapter | null;
  store: SyncableStore;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /**
   * After `start()`, also sync every this many ms while the page is visible
   * and online, so a device that only watches (e.g. a waiting-room display)
   * still receives other devices' records. 0 or undefined = off.
   */
  pollIntervalMs?: number;
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
