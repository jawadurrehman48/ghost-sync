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
 *
 * With `adapter: null` the engine runs in local-only mode: it never syncs,
 * never touches the network, and always reports `{ state: 'local' }`.
 *
 * Errors of any kind (network down, server error, timeouts) never escape:
 * they are reported as an `error` status and retried with exponential backoff.
 */
export function createSyncEngine(config: SyncEngineConfig): SyncEngine {
  const {
    adapter,
    store,
    maxRetries = 5,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    pollIntervalMs = 0,
  } = config;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let visibilityHandler: (() => void) | null = null;
  const isVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

  const statusStore = createSyncStatusStore(adapter ? { state: 'pending', count: 0 } : { state: 'local' });
  let current: Promise<void> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let onlineHandler: (() => void) | null = null;
  let offlineHandler: (() => void) | null = null;

  /** Offline only when the browser says so (some runtimes have no `onLine` at all). */
  function isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
  }

  async function cycle(attempt: number): Promise<void> {
    if (!adapter) return;
    statusStore.set({ state: 'syncing' });

    try {
      // --- Pull phase ---
      const knownIds = await store.getAllIds();
      const pulled = await adapter.pull(knownIds);
      for (const record of pulled) {
        await store.ingestPulled(record);
      }
      // Only now that everything is saved may the adapter move its cursor on.
      if (adapter.commitPull) await adapter.commitPull();

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (!isOnline()) {
        // The connection dropped during the cycle: the `online` event resumes sync.
        statusStore.set({ state: 'offline' });
      } else if (attempt < maxRetries) {
        // Schedule retry with exponential backoff
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        statusStore.set({ state: 'error', message: `${message} (retry ${attempt + 1}/${maxRetries})` });

        retryTimer = setTimeout(() => {
          retryTimer = null;
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

  /** Run one cycle. A call while a cycle is running waits for that cycle instead of starting another. */
  function runSyncCycle(attempt: number = 0): Promise<void> {
    if (!adapter) {
      statusStore.set({ state: 'local' });
      return Promise.resolve();
    }
    if (!isOnline()) {
      statusStore.set({ state: 'offline' });
      return Promise.resolve();
    }
    if (current) return current;
    current = cycle(attempt).finally(() => {
      current = null;
    });
    return current;
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
      if (!adapter) {
        statusStore.set({ state: 'local' });
        return;
      }

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

      // Background pull for devices that only watch. Skipped while a cycle or a retry is pending.
      if (pollIntervalMs > 0 && !pollTimer) {
        pollTimer = setInterval(() => {
          if (!current && !retryTimer && isOnline() && isVisible()) void runSyncCycle(0);
        }, pollIntervalMs);
      }
      // Coming back to the app (unlocking the phone, switching tabs): catch up at once.
      if (typeof document !== 'undefined' && !visibilityHandler) {
        visibilityHandler = () => {
          if (isVisible()) void this.syncNow();
        };
        document.addEventListener('visibilitychange', visibilityHandler);
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
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (typeof document !== 'undefined' && visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }
    },
  };
}
