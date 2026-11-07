const STORAGE_KEY = 'ghost-sync-device-id';

// In-memory fallback for when localStorage is unavailable (e.g. private mode).
let memoryDeviceId: string | null = null;

/**
 * Generate a UUID v4. Uses `crypto.randomUUID()` when available,
 * otherwise falls back to a manual RFC 4122 v4 generator.
 */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Manual RFC 4122 v4 fallback
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Last-resort fallback using Math.random
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set version (4) and variant (10xx) bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

/**
 * Get the persistent device id, or generate and persist one if it doesn't exist.
 *
 * Tries localStorage first. If localStorage is unavailable, falls back to
 * an in-memory UUID that persists for the session.
 */
export function getOrCreateDeviceId(): string {
  // Try localStorage
  if (typeof localStorage !== 'undefined') {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const id = generateUuid();
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage write failed (quota / private mode) — fall back to memory
      memoryDeviceId = id;
    }
    return id;
  }

  // No localStorage at all — use in-memory fallback
  if (!memoryDeviceId) {
    memoryDeviceId = generateUuid();
  }
  return memoryDeviceId;
}

/**
 * Reset the in-memory device id. Intended for testing only.
 */
export function _resetMemoryDeviceId(): void {
  memoryDeviceId = null;
}
