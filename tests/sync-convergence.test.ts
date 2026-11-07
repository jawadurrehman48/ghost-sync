import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Dexie from 'dexie';
import {
  createDatabase,
  createStore,
  getOrCreateDeviceId,
  createSyncEngine,
  InMemorySyncAdapter,
  type Store,
} from '@skeleton/core';

interface ConvCollections {
  items: { value: number };
  notes: { text: string };
}

type Operation =
  | { type: 'add'; device: number; collection: 'items' | 'notes' }
  | { type: 'sync'; device: number };

const NUM_DEVICES = 3;

// Generate arbitrary sequences of operations
const arbOperations = fc.array(
  fc.oneof(
    fc.record({
      type: fc.constant('add' as const),
      device: fc.nat({ max: NUM_DEVICES - 1 }),
      collection: fc.constantFrom('items' as const, 'notes' as const),
    }),
    fc.record({
      type: fc.constant('sync' as const),
      device: fc.nat({ max: NUM_DEVICES - 1 }),
    }),
  ),
  { maxLength: 40 },
);

interface DeviceContext {
  db: Dexie;
  store: Store<ConvCollections>;
  deviceId: string;
}

async function setupDevices(adapter: InMemorySyncAdapter): Promise<DeviceContext[]> {
  const devices: DeviceContext[] = [];
  for (let i = 0; i < NUM_DEVICES; i++) {
    const dbName = `conv-test-${i}-${Date.now()}-${Math.random()}`;
    const db = createDatabase<ConvCollections>({
      dbName,
      collections: { items: undefined, notes: undefined },
    });
    const deviceId = `device-${i}`;
    const store = createStore(db as any, deviceId);
    devices.push({ db, store, deviceId });
  }
  return devices;
}

async function cleanupDevices(devices: DeviceContext[]): Promise<void> {
  for (const { db, store } of devices) {
    db.close();
    await Dexie.delete(db.name);
  }
}

describe('Sync convergence (property-based)', () => {
  it('all devices converge to the same set of records after any sequence of adds and syncs', async () => {
    await fc.assert(
      fc.asyncProperty(arbOperations, async (operations) => {
        const adapter = new InMemorySyncAdapter();
        const devices = await setupDevices(adapter);

        try {
          let totalAdds = 0;

          // Execute operations in order
          for (const op of operations) {
            const ctx = devices[op.device];
            if (op.type === 'add') {
              const payload = op.collection === 'items'
                ? { value: Math.floor(Math.random() * 1000) }
                : { text: `note-${totalAdds}` };
              await ctx.store.add(op.collection, payload);
              totalAdds++;
            } else {
              const engine = createSyncEngine({ adapter, store: ctx.store });
              await engine.syncNow();
            }
          }

          // Final convergence: sync all devices in round-robin, twice
          for (let round = 0; round < 2; round++) {
            for (const ctx of devices) {
              const engine = createSyncEngine({ adapter, store: ctx.store });
              await engine.syncNow();
            }
          }

          // Collect record ids from each device
          const deviceIds: string[][] = [];
          for (const ctx of devices) {
            const itemRecords = await ctx.store.query('items');
            const noteRecords = await ctx.store.query('notes');
            const allIds = [...itemRecords, ...noteRecords].map((r) => r.id);
            deviceIds.push(allIds);
          }

          // Property 1: No duplicates within any device
          for (const ids of deviceIds) {
            expect(new Set(ids).size).toBe(ids.length);
          }

          // Property 2: All devices have the same set of record ids
          const firstSet = new Set(deviceIds[0]);
          for (let i = 1; i < deviceIds.length; i++) {
            const currentSet = new Set(deviceIds[i]);
            expect(currentSet.size).toBe(firstSet.size);
            for (const id of firstSet) {
              expect(currentSet.has(id)).toBe(true);
            }
          }

          // Property 3: No records lost — every device has all records that were added
          expect(firstSet.size).toBe(totalAdds);
        } finally {
          await cleanupDevices(devices);
        }
      }),
      { numRuns: 50 },
    );
  }, 120000);
});
