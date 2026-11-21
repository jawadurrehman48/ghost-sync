import { createCloudSync, createStore, getOrCreateDeviceId, syncSetupFromEnv } from '@skeleton/core';
import { db } from './clinic.db';

/**
 * Singletons for the clinic app, all from @skeleton/core. Sync uses Supabase
 * when VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set, an
 * in-memory stand-in under tests, and otherwise runs local-only (fully offline).
 */
export { db };
export const deviceId = getOrCreateDeviceId();
export const store = createStore(db, deviceId);
export const sync = createCloudSync({ app: 'clinic-queue', store, ...syncSetupFromEnv(import.meta.env) });
export const engine = sync.engine;
