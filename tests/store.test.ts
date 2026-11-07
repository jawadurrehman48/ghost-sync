import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import {
  createDatabase,
  createStore,
  getOrCreateDeviceId,
  type Store,
  type SyncedRow,
} from '@skeleton/core';

// Test collection types
interface TestCollections {
  items: { name: string; value: number };
  notes: { text: string };
}

let db: Dexie;
let store: Store<TestCollections>;

function setup(dbName: string): void {
  db = createDatabase<TestCollections>({
    dbName,
    collections: { items: undefined, notes: undefined },
  });
  store = createStore(db as any, getOrCreateDeviceId());
}

describe('Store', () => {
  beforeEach(async () => {
    // Close any existing connection, then delete and recreate
    if (db) {
      db.close();
    }
    await Dexie.delete('test-store-db');
    setup('test-store-db');
  });

  describe('add', () => {
    it('should return a record with all base fields', async () => {
      const record = await store.add('items', { name: 'Widget', value: 100 });

      expect(record.id).toBeTruthy();
      expect(record.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(record.createdAt).toBeTruthy();
      expect(record.deviceId).toBeTruthy();
      expect(record.collection).toBe('items');
      expect(record.payload).toEqual({ name: 'Widget', value: 100 });
    });

    it('should not expose _syncStatus in the returned record', async () => {
      const record = await store.add('items', { name: 'Widget', value: 100 });
      expect('_syncStatus' in record).toBe(false);
    });

    it('should generate unique ids for each record', async () => {
      const r1 = await store.add('items', { name: 'A', value: 1 });
      const r2 = await store.add('items', { name: 'B', value: 2 });
      expect(r1.id).not.toBe(r2.id);
    });

    it('should set the collection field from the collection key', async () => {
      const itemRecord = await store.add('items', { name: 'X', value: 0 });
      const noteRecord = await store.add('notes', { text: 'hello' });

      expect(itemRecord.collection).toBe('items');
      expect(noteRecord.collection).toBe('notes');
    });
  });

  describe('query', () => {
    it('should return all records in a collection ordered by createdAt ascending', async () => {
      // Add with slight delays to ensure different timestamps
      await store.add('items', { name: 'First', value: 1 });
      await new Promise((r) => setTimeout(r, 10));
      await store.add('items', { name: 'Second', value: 2 });
      await new Promise((r) => setTimeout(r, 10));
      await store.add('items', { name: 'Third', value: 3 });

      const records = await store.query('items');
      expect(records).toHaveLength(3);
      expect(records[0].payload.name).toBe('First');
      expect(records[1].payload.name).toBe('Second');
      expect(records[2].payload.name).toBe('Third');
    });

    it('should return only records from the specified collection', async () => {
      await store.add('items', { name: 'Item', value: 1 });
      await store.add('notes', { text: 'Note' });
      await store.add('items', { name: 'Item2', value: 2 });

      const items = await store.query('items');
      const notes = await store.query('notes');

      expect(items).toHaveLength(2);
      expect(notes).toHaveLength(1);
      expect(items.every((r) => r.collection === 'items')).toBe(true);
      expect(notes.every((r) => r.collection === 'notes')).toBe(true);
    });

    it('should return an empty array for a collection with no records', async () => {
      const records = await store.query('items');
      expect(records).toEqual([]);
    });

    it('should strip _syncStatus from returned records', async () => {
      await store.add('items', { name: 'X', value: 0 });
      const records = await store.query('items');
      expect(records.every((r) => !('_syncStatus' in r))).toBe(true);
    });
  });

  describe('getAllIds', () => {
    it('should return ids across all collections', async () => {
      await store.add('items', { name: 'A', value: 1 });
      await store.add('items', { name: 'B', value: 2 });
      await store.add('notes', { text: 'hello' });

      const ids = await store.getAllIds();
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3); // all unique
    });
  });

  describe('getPending', () => {
    it('should return all rows with _syncStatus pending', async () => {
      await store.add('items', { name: 'A', value: 1 });
      await store.add('notes', { text: 'note' });

      const pending = await store.getPending();
      expect(pending).toHaveLength(2);
      expect(pending.every((r) => r._syncStatus === 'pending')).toBe(true);
    });
  });

  describe('markSynced', () => {
    it('should update _syncStatus to synced for the given ids', async () => {
      const r1 = await store.add('items', { name: 'A', value: 1 });
      const r2 = await store.add('items', { name: 'B', value: 2 });

      await store.markSynced([r1.id]);

      const pending = await store.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(r2.id);
    });
  });

  describe('ingestPulled', () => {
    it('should insert a record routed by its collection field', async () => {
      const pulledRow: SyncedRow<unknown> = {
        id: 'pulled-id-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        deviceId: 'other-device',
        collection: 'items',
        payload: { name: 'Pulled Item', value: 42 },
        _syncStatus: 'pending',
      };

      await store.ingestPulled(pulledRow);

      const records = await store.query('items');
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('pulled-id-1');
      expect(records[0].payload).toEqual({ name: 'Pulled Item', value: 42 });
    });

    it('should be idempotent — inserting the same id twice does not duplicate', async () => {
      const pulledRow: SyncedRow<unknown> = {
        id: 'pulled-id-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        deviceId: 'other-device',
        collection: 'notes',
        payload: { text: 'pulled note' },
        _syncStatus: 'pending',
      };

      await store.ingestPulled(pulledRow);
      await store.ingestPulled(pulledRow); // should skip

      const records = await store.query('notes');
      expect(records).toHaveLength(1);
    });

    it('should mark ingested records as synced', async () => {
      const pulledRow: SyncedRow<unknown> = {
        id: 'pulled-id-3',
        createdAt: '2026-01-01T00:00:00.000Z',
        deviceId: 'other-device',
        collection: 'items',
        payload: { name: 'Synced', value: 0 },
        _syncStatus: 'pending',
      };

      await store.ingestPulled(pulledRow);

      const pending = await store.getPending();
      expect(pending).toHaveLength(0); // ingested record is already synced
    });
  });

  describe('append-only enforcement', () => {
    it('should not expose update or delete methods on the Store interface', () => {
      const storeKeys = Object.keys(store);
      expect(storeKeys).not.toContain('update');
      expect(storeKeys).not.toContain('delete');
      expect(storeKeys).not.toContain('put');
      expect(storeKeys).not.toContain('remove');
    });
  });
});
