import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every `intervalMs` (default 30 seconds).
 * Use it for live labels such as "waiting 12 min" or a clock.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
