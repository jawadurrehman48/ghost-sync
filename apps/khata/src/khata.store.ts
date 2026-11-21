import { createCloudSync, createStore, getOrCreateDeviceId, syncSetupFromEnv } from '@skeleton/core';
import { db } from './khata.db';

/**
 * Singleton database, store and sync for Khata.
 *
 * All data access goes through @skeleton/core: no direct Dexie or network
 * calls. The store is append-only. Sync uses Supabase when
 * VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set, an in-memory
 * stand-in under tests, and otherwise runs local-only (fully offline).
 */

const deviceId = getOrCreateDeviceId();

export { db };

export const store = createStore(db, deviceId);

export const sync = createCloudSync({ app: 'khata', store, ...syncSetupFromEnv(import.meta.env) });

export const engine = sync.engine;
