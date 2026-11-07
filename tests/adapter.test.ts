import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySyncAdapter, type SkeletonRecord } from '@skeleton/core';

function makeRecord(id: string, collection = 'items'): SkeletonRecord<unknown> {
  return {
    id,
    createdAt: `2026-01-01T00:00:0${id.length}.000Z`,
    deviceId: 'device-1',
    collection,
    payload: { value: 42 },
  };
}

describe('InMemorySyncAdapter', () => {
  let adapter: InMemorySyncAdapter;

  beforeEach(() => {
    adapter = new InMemorySyncAdapter();
  });

  describe('push', () => {
    it('should accept new records and return their ids', async () => {
      const r1 = makeRecord('r1');
      const r2 = makeRecord('r2');
      const accepted = await adapter.push([r1, r2]);
      expect(accepted).toEqual(['r1', 'r2']);
      expect(adapter.size()).toBe(2);
    });

    it('should dedup — pushing the same id twice does not duplicate', async () => {
      const r1 = makeRecord('r1');
      await adapter.push([r1]);
      const accepted = await adapter.push([r1]);
      expect(accepted).toEqual([]);
      expect(adapter.size()).toBe(1);
    });

    it('should only return newly accepted ids in a mixed batch', async () => {
      const r1 = makeRecord('r1');
      const r2 = makeRecord('r2');
      await adapter.push([r1]);
      const accepted = await adapter.push([r1, r2]);
      expect(accepted).toEqual(['r2']);
      expect(adapter.size()).toBe(2);
    });

    it('should handle an empty array', async () => {
      const accepted = await adapter.push([]);
      expect(accepted).toEqual([]);
    });
  });

  describe('pull', () => {
    it('should return all records when knownIds is empty', async () => {
      const r1 = makeRecord('r1');
      const r2 = makeRecord('r2');
      await adapter.push([r1, r2]);
      const pulled = await adapter.pull([]);
      expect(pulled).toHaveLength(2);
    });

    it('should exclude records with known ids', async () => {
      const r1 = makeRecord('r1');
      const r2 = makeRecord('r2');
      const r3 = makeRecord('r3');
      await adapter.push([r1, r2, r3]);
      const pulled = await adapter.pull(['r1', 'r3']);
      expect(pulled).toHaveLength(1);
      expect(pulled[0].id).toBe('r2');
    });

    it('should return empty array when all ids are known', async () => {
      const r1 = makeRecord('r1');
      await adapter.push([r1]);
      const pulled = await adapter.pull(['r1']);
      expect(pulled).toEqual([]);
    });

    it('should return empty array when adapter has no records', async () => {
      const pulled = await adapter.pull([]);
      expect(pulled).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should clear all stored records', async () => {
      await adapter.push([makeRecord('r1'), makeRecord('r2')]);
      expect(adapter.size()).toBe(2);
      adapter.reset();
      expect(adapter.size()).toBe(0);
    });
  });

  describe('cross-collection storage', () => {
    it('should store records from different collections in one flat store', async () => {
      const item = makeRecord('item-1', 'items');
      const note = makeRecord('note-1', 'notes');
      await adapter.push([item, note]);
      expect(adapter.size()).toBe(2);
      const pulled = await adapter.pull([]);
      expect(pulled).toHaveLength(2);
      expect(pulled.find((r) => r.collection === 'items')).toBeTruthy();
      expect(pulled.find((r) => r.collection === 'notes')).toBeTruthy();
    });
  });
});
