/**
 * The small amount of sync state kept outside IndexedDB (workspace code, pull
 * cursors). Defaults to localStorage, falling back to memory when it is
 * unavailable (private mode, quota), so the app never fails because of it.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A plain in-memory storage (tests, or when localStorage is unavailable). */
export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** localStorage when it works, otherwise memory. Never throws. */
export function defaultStorage(): KeyValueStorage {
  const memory = createMemoryStorage();
  const local = typeof localStorage !== 'undefined' ? localStorage : null;
  return {
    getItem(key) {
      try {
        return local?.getItem(key) ?? memory.getItem(key);
      } catch {
        return memory.getItem(key);
      }
    },
    setItem(key, value) {
      memory.setItem(key, value);
      try {
        local?.setItem(key, value);
      } catch {
        // Quota or private mode: the in-memory copy keeps this session working.
      }
    },
    removeItem(key) {
      memory.removeItem(key);
      try {
        local?.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}
