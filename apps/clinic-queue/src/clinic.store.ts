import { createStore, createSyncEngine, getOrCreateDeviceId, InMemorySyncAdapter } from '@skeleton/core';
import { db } from './clinic.db';

/**
 * Singletons for the clinic app, all from @skeleton/core. The in-memory sync
 * adapter is a stand-in for a real cloud backend. `adapter` is exported so
 * "Clear all data" can empty the mock cloud copy too.
 */
export { db };
export const deviceId = getOrCreateDeviceId();
export const store = createStore(db, deviceId);
export const adapter = new InMemorySyncAdapter();
export const engine = createSyncEngine({ adapter, store });
