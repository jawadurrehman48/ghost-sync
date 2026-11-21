const inFlight = new WeakMap<object, Promise<unknown>>();

/**
 * Run `task` for `key`, but if a run for the same key is still in progress,
 * return that run instead of starting another. Use it for actions that must
 * not overlap, such as loading demo data, where a double tap would otherwise
 * insert everything twice. Once the run settles, the next call runs again.
 */
export function singleFlight<T>(key: object, task: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const run = task().finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}
