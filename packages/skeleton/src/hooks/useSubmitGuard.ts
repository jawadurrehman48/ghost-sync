import { useCallback, useRef, useState } from 'react';

export interface SubmitGuard {
  /** True while a guarded task is running (use it to disable buttons). */
  busy: boolean;
  /**
   * Run `task` unless another guarded task is already running, in which case
   * the call is ignored and resolves to undefined. The check uses a ref, so
   * it holds even for two taps in the same frame, before React re-renders.
   */
  run: <T>(task: () => Promise<T>) => Promise<T | undefined>;
}

/**
 * Protects "save" actions against double taps. In an append-only ledger a
 * duplicated submit would record a second, real entry and corrupt the balance.
 */
export function useSubmitGuard(): SubmitGuard {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await task();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
