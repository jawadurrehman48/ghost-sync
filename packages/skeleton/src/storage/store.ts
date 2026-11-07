import type { Table } from 'dexie';
import type { TypedDexie } from './db';
import type {
  Record as RecordType,
  SyncedRow,
} from './types';

/**
 * The public, append-only storage API.
 *
 * `add` and `query` are for app use. The sync-internal methods
 * (`getAllIds`, `getPending`, `markSynced`, `ingestPulled`) are used
 * by the SyncEngine and are exposed on the same object but are not
 * part of the app-facing surface.
 */
export interface Store<C> {
  /**
   * Append a new record to the given collection.
   * Generates id, createdAt, deviceId, and collection automatically.
   * The record is marked `_syncStatus: 'pending'`.
   * Returns the clean Record<P> (without internal fields).
   */
  add<K extends keyof C>(collection: K, payload: C[K]): Promise<RecordType<C[K]>>;

  /**
   * Query all records in a collection, ordered by `createdAt` ascending.
   * Returns clean Record<P>[] (strips `_syncStatus`).
   */
  query<K extends keyof C>(collection: K): Promise<RecordType<C[K]>[]>;

  // --- Sync-internal methods (used by SyncEngine) ---

  /** Returns all record ids known locally, across all collections. */
  getAllIds(): Promise<string[]>;

  /** Returns all rows with _syncStatus 'pending', across all collections. */
  getPending(): Promise<SyncedRow<unknown>[]>;

  /** Marks the given ids as 'synced' in Dexie across all tables. */
  markSynced(ids: string[]): Promise<void>;

  /**
   * Inserts a clean record from sync pull into the table matching its `collection` field.
   * The record is stored with `_syncStatus: 'synced'` (it came from the cloud).
   * Idempotent: if the id already exists, the row is skipped.
   */
  ingestPulled(record: RecordType<unknown>): Promise<void>;
}

/**
 * Strip the internal `_syncStatus` field from a Dexie row, returning a clean Record.
 */
function stripSyncStatus<P>(row: SyncedRow<P>): RecordType<P> {
  const { _syncStatus: _, ...clean } = row;
  return clean as RecordType<P>;
}

/**
 * Create a Store wrapping a Dexie database.
 *
 * @param db - The Dexie database created by `createDatabase()`
 * @param deviceId - The device id from `getOrCreateDeviceId()`
 */
export function createStore<C>(
  db: TypedDexie<C>,
  deviceId: string,
): Store<C> {
  const collectionNames = db.tables
    .map((t) => t.name)
    .filter((name) => name !== '_placeholder');

  function getTable<K extends keyof C>(name: K): Table<SyncedRow<C[K]>, string> {
    return db[name] as unknown as Table<SyncedRow<C[K]>, string>;
  }

  function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback — same as deviceId generator
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').replace(
      /^(.{8})(.{4})(.{4})(.{4})(.+)$/,
      '$1-$2-$3-$4-$5',
    );
  }

  return {
    async add<K extends keyof C>(collection: K, payload: C[K]): Promise<RecordType<C[K]>> {
      const table = getTable(collection);
      const id = generateId();
      const createdAt = new Date().toISOString();
      const row: SyncedRow<C[K]> = {
        id,
        createdAt,
        deviceId,
        collection: collection as string,
        payload,
        _syncStatus: 'pending',
      };
      await table.add(row);
      return stripSyncStatus(row);
    },

    async query<K extends keyof C>(collection: K): Promise<RecordType<C[K]>[]> {
      const table = getTable(collection);
      const rows = await table.orderBy('createdAt').toArray();
      return rows.map(stripSyncStatus);
    },

    async getAllIds(): Promise<string[]> {
      const allIds: string[] = [];
      for (const name of collectionNames) {
        const table = db.table(name);
        const ids = await table.toCollection().primaryKeys();
        allIds.push(...(ids as string[]));
      }
      return allIds;
    },

    async getPending(): Promise<SyncedRow<unknown>[]> {
      const pending: SyncedRow<unknown>[] = [];
      for (const name of collectionNames) {
        const table = db.table(name);
        const rows = await table.where('_syncStatus').equals('pending').toArray();
        pending.push(...(rows as SyncedRow<unknown>[]));
      }
      return pending;
    },

    async markSynced(ids: string[]): Promise<void> {
      const idSet = new Set(ids);
      for (const name of collectionNames) {
        const table = db.table(name);
        const rows = await table.where('id').anyOf(ids).toArray();
        for (const row of rows) {
          if (idSet.has((row as SyncedRow<unknown>).id)) {
            await table.update((row as SyncedRow<unknown>).id, { _syncStatus: 'synced' });
          }
        }
      }
    },

    async ingestPulled(record: RecordType<unknown>): Promise<void> {
      const table = db.table(record.collection);
      const existing = await table.get(record.id);
      if (existing) {
        // Idempotent: already have this record, skip
        return;
      }
      // Insert as already-synced (it came from the cloud)
      await table.put({ ...record, _syncStatus: 'synced' } as SyncedRow<unknown>);
    },
  };
}
