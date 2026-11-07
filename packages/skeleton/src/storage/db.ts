import Dexie, { type Table } from 'dexie';
import type { SyncedRow } from './types';

/**
 * Configuration for creating a Dexie database.
 * Each key in `collections` becomes a Dexie table.
 * The values are ignored at runtime — only the keys matter.
 */
export interface StorageConfig<C> {
  dbName: string;
  collections: { [K in keyof C]: unknown };
}

/**
 * A Dexie database typed with one table per collection.
 */
export type TypedDexie<C> = Dexie & {
  [K in keyof C]: Table<SyncedRow<C[K]>, string>;
};

/**
 * Create a Dexie database with one table per collection.
 *
 * Each table stores `SyncedRow<P>` rows and indexes:
 * - `id` (primary key — Dexie uses `&id` for this)
 * - `createdAt` (for ordering queries)
 * - `_syncStatus` (for querying pending sync records)
 *
 * The `collection` field is also stored on each row so the sync
 * engine can route pulled records to the correct table.
 */
export function createDatabase<C>(config: StorageConfig<C>): TypedDexie<C> {
  const collectionNames = Object.keys(config.collections) as (keyof C & string)[];

  const db = new Dexie(config.dbName) as TypedDexie<C>;

  const schema: Record<string, string> = {};
  for (const name of collectionNames) {
    // &id = primary key (auto-generated UUID stored on the row)
    // createdAt, _syncStatus = secondary indexes
    schema[name] = '&id, createdAt, _syncStatus';
  }

  db.version(1).stores(schema);

  return db;
}
