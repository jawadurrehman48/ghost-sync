import type { SyncStatus, SyncStatusListener } from './types';

/**
 * A lightweight observable store for sync status.
 * No external dependency — just a value + listeners.
 */
export interface SyncStatusStore {
  get: () => SyncStatus;
  set: (status: SyncStatus) => void;
  subscribe: (fn: SyncStatusListener) => () => void;
}

export function createSyncStatusStore(initial: SyncStatus): SyncStatusStore {
  let current: SyncStatus = initial;
  const listeners = new Set<SyncStatusListener>();

  return {
    get: () => current,

    set: (status: SyncStatus) => {
      current = status;
      for (const listener of listeners) {
        listener(status);
      }
    },

    subscribe: (fn: SyncStatusListener): (() => void) => {
      listeners.add(fn);
      // Immediately call with current value so subscriber gets initial state
      fn(current);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
