import { createStore, getOrCreateDeviceId, createSyncEngine, InMemorySyncAdapter } from '@skeleton/core';
import { db } from './khata.db';

/**
 * Singleton database, store and sync engine for Khata.
 *
 * All data access goes through @skeleton/core: no direct Dexie or network
 * calls. The store is append-only. The engine uses an in-memory mock adapter
 * (a real cloud adapter will replace it later); `adapter` is exported so
 * "Clear all data" can empty the mock cloud copy as well.
 */

const deviceId = getOrCreateDeviceId();

export { db };

export const store = createStore(db, deviceId);

export const adapter = new InMemorySyncAdapter();

export const engine = createSyncEngine({ adapter, store });
