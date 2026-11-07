import type { SyncedRow } from '../storage/types';
import type { SyncEngine, SyncEngineConfig, SyncStatus, SyncStatusListener } from './types';
import { createSyncStatusStore } from './status';

/**
 * Create a sync engine that coordinates pushing pending records to
 * and pulling new records from a backend via a SyncAdapter.
 *
 * The engine is framework-agnostic — it listens to browser `online`/`offline`
 * events directly, not through the React hook. This lets it work in
 * non-React contexts (tests, service workers).
 */
export function createSyncEngine(config: SyncEngineConfig): SyncEngine {
  const {
    adapter,
    store,
    maxRetries = 5,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
  } = config;

  const statusStore = createSyncStatusStore({ state: 'pending', count: 0 });
  let isSyncing = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let onlineHandler: (() => void) | null = null;
  let offlineHandler: (() => void) | null = null;

  function isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }

  async function runSyncCycle(attempt: number = 0): Promise<void> {
    // Guard: offline
    if (!isOnline()) {
      statusStore.set({ state: 'offline' });
      return;
    }

    // Guard: already syncing
    if (isSyncing) {
      return;
    }

    isSyncing = true;
    statusStore.set({ state: 'syncing' });

    try {
      // --- Pull phase ---
      const knownIds = await store.getAllIds();
      const pulled = await adapter.pull(knownIds);
      for (const record of pulled) {
        await store.ingestPulled(record);
      }

      // --- Push phase ---
      const pending = await store.getPending();
      if (pending.length > 0) {
        // Strip _syncStatus before sending to adapter
        const cleanRecords = pending.map((row: SyncedRow<unknown>) => {
          const { _syncStatus: _, ...clean } = row;
          return clean;
        });
        const accepted = await adapter.push(cleanRecords);
        await store.markSynced(accepted);
      }

      // --- Compute final status ---
      const stillPending = await store.getPending();
      if (stillPending.length === 0) {
        statusStore.set({ state: 'synced' });
      } else {
        statusStore.set({ state: 'pending', count: stillPending.length });
      }

      isSyncing = false;
    } catch (err) {
      isSyncing = false;

      const message = err instanceof Error ? err.message : String(err);

      if (attempt < maxRetries) {
        // Schedule retry with exponential backoff
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        statusStore.set({ state: 'error', message: `${message} (retry ${attempt + 1}/${maxRetries})` });

        retryTimer = setTimeout(() => {
          runSyncCycle(attempt + 1).catch(() => {
            // If retry itself throws unexpectedly, mark as error
            statusStore.set({ state: 'error', message });
          });
        }, delay);
      } else {
        // Exhausted retries
        statusStore.set({ state: 'error', message });
      }
    }
  }

  return {
    async syncNow(): Promise<void> {
      // Cancel any pending retry
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      await runSyncCycle(0);
    },

    getStatus(): SyncStatus {
      return statusStore.get();
    },

    subscribe(fn: SyncStatusListener): () => void {
      return statusStore.subscribe(fn);
    },

    start(): void {
      // Listen to browser online/offline events
      if (typeof window !== 'undefined') {
        onlineHandler = () => {
          void this.syncNow();
        };
        offlineHandler = () => {
          statusStore.set({ state: 'offline' });
        };
        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);
      }

      // Trigger an initial sync if online
      if (isOnline()) {
        void this.syncNow();
      } else {
        statusStore.set({ state: 'offline' });
      }
    },

    stop(): void {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (typeof window !== 'undefined' && onlineHandler && offlineHandler) {
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
        onlineHandler = null;
        offlineHandler = null;
      }
      isSyncing = false;
    },
  };
}
