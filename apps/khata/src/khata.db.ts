import { createDatabase } from '@skeleton/core';
import type { KhataCollections } from './khata.types';

/**
 * Singleton Dexie database for Khata.
 * Created via @skeleton/core's createDatabase factory.
 * One table per collection, indexed on id, createdAt, and _syncStatus.
 */
export const db = createDatabase<KhataCollections>({
  dbName: 'khata',
  collections: {
    customerCreated: undefined,
    customerUpdated: undefined,
    creditGiven: undefined,
    paymentReceived: undefined,
    entryReversed: undefined,
    settingsUpdated: undefined,
  },
});
