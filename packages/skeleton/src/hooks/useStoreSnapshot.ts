import { useCallback, useEffect, useRef, useState } from 'react';
import type { SyncEngine } from '../sync/types';

export interface UseStoreSnapshotOptions {
  /** If given, the snapshot reloads whenever the sync engine status changes
   *  (e.g. after records from another device were pulled in). */
  engine?: SyncEngine;
}

export interface StoreSnapshot<T> {
  /** Latest loaded value; undefined until the first load finishes. */
  data: T | undefined;
  /** Set if the latest load failed. */
  error: unknown;
  /** Re-run `load`. Call it after writing to the store. */
  reload: () => Promise<void>;
}

/**
 * Load a snapshot of local data (e.g. all records from the store) and keep it
 * fresh. Apps call `reload()` after `store.add(...)`; passing the sync engine
 * also reloads after sync activity.
 *
 * Stale results are dropped: if `reload` is called twice quickly, only the
 * latest call updates state. Safe under React StrictMode.
 */
export function useStoreSnapshot<T>(
  load: () => Promise<T>,
  options: UseStoreSnapshotOptions = {},
): StoreSnapshot<T> {
  const { engine } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const latestCall = useRef(0);
  const mounted = useRef(true);

  const reload = useCallback(async (): Promise<void> => {
    const call = ++latestCall.current;
    try {
      const next = await loadRef.current();
      if (mounted.current && call === latestCall.current) {
        setData(next);
        setError(undefined);
      }
    } catch (err) {
      if (mounted.current && call === latestCall.current) {
        setError(err);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  useEffect(() => {
    if (!engine) return undefined;
    let first = true; // subscribe() calls back immediately with the current status
    const unsubscribe = engine.subscribe(() => {
      if (first) {
        first = false;
        return;
      }
      void reload();
    });
    return unsubscribe;
  }, [engine, reload]);

  return { data, error, reload };
}
