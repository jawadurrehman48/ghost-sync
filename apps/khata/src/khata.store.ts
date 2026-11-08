import {
  createStore,
  getOrCreateDeviceId,
  createSyncEngine,
  InMemorySyncAdapter,
} from '@skeleton/core';
import { db } from './khata.db';

/**
 * Singleton store and sync engine for Khata.
 *
 * All data access goes through @skeleton/core — no direct Dexie or
 * network calls. The store is append-only. The engine uses an
 * in-memory mock adapter (a real Supabase adapter will be added later).
 */

const deviceId = getOrCreateDeviceId();

export const store = createStore(db, deviceId);

const adapter = new InMemorySyncAdapter();

export const engine = createSyncEngine({ adapter, store });
