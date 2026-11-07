import { useEffect, useState } from 'react';

/**
 * React hook that reports whether the device is currently online.
 *
 * Subscribes to browser `online` and `offline` events and updates
 * state accordingly. Returns the initial value from `navigator.onLine`
 * at mount time. Falls back to `true` when `navigator` is unavailable
 * (e.g. during SSR).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
