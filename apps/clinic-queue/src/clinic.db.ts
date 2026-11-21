import { createDatabase } from '@skeleton/core';
import type { ClinicCollections } from './clinic.types';

/** The clinic's local database: one table per collection (via @skeleton/core). */
export const db = createDatabase<ClinicCollections>({
  dbName: 'clinic-queue',
  collections: {
    patientRegistered: undefined,
    tokenIssued: undefined,
    tokenCalled: undefined,
    tokenCompleted: undefined,
    tokenSkipped: undefined,
    tokenRequeued: undefined,
    deviceLetterSet: undefined,
    settingsUpdated: undefined,
  },
});
