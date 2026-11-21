import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  SupabaseSyncAdapter,
  createMemoryStorage,
  createSyncEngine,
  readPullCursor,
  writePullCursor,
} from '@skeleton/core';
import type { KeyValueStorage, SkeletonRecord } from '@skeleton/core';
import { FakeSupabase, MemoryStore, WORKSPACE_A, WORKSPACE_B, uuidOf } from './sync.helpers';
import type { Fault } from './sync.helpers';

const APP = 'khata';

function record(n: number, prefix = 1): SkeletonRecord<unknown> {
  return { id: uuidOf(n, prefix), collection: 'items', payload: { n }, deviceId: `d-${prefix}`, createdAt: new Date(Date.UTC(2026, 0, 1) + n).toISOString() };
}

function adapterFor(server: FakeSupabase, opts: { storage?: KeyValueStorage; workspace?: () => string; push?: number; page?: number; pages?: number; app?: string } = {}) {
  return new SupabaseSyncAdapter({
    client: server,
    app: opts.app ?? APP,
    getWorkspaceId: opts.workspace ?? (() => WORKSPACE_A),
    storage: opts.storage ?? createMemoryStorage(),
    pushBatchSize: opts.push ?? 200,
    pullPageSize: opts.page ?? 500,
    maxPagesPerPull: opts.pages ?? 40,
  });
}

// ---------------------------------------------------------------------------
// Unit behaviour
// ---------------------------------------------------------------------------

describe('SupabaseSyncAdapter', () => {
  it('pushes in batches and returns every id the server holds', async () => {
    const server = new FakeSupabase();
    const adapter = adapterFor(server, { push: 2 });
    const records = [1, 2, 3, 4, 5].map((n) => record(n));
    expect((await adapter.push(records)).sort()).toEqual(records.map((r) => r.id).sort());
    expect(server.calls.filter((c) => c === 'push_records')).toHaveLength(3);
    // Pushing again (e.g. the first response was lost) confirms them without duplicating.
    expect((await adapter.push(records)).sort()).toEqual(records.map((r) => r.id).sort());
    expect(server.rows).toHaveLength(5);
  });

  it('never sends records the server would refuse (non-UUID id, non-object payload)', async () => {
    const server = new FakeSupabase();
    const adapter = adapterFor(server);
    const bad = [{ ...record(1), id: 'not-a-uuid' }, { ...record(2), payload: [1, 2] }, { ...record(3), payload: null }];
    expect(await adapter.push([...bad, record(4)])).toEqual([uuidOf(4, 1)]);
    expect(server.rows.map((r) => r.id)).toEqual([uuidOf(4, 1)]);
  });

  it('pulls everything the first time, then only new records', async () => {
    const server = new FakeSupabase();
    const storage = createMemoryStorage();
    await adapterFor(server).push([record(1), record(2)]);
    const adapter = adapterFor(server, { storage });
    expect((await adapter.pull([])).map((r) => r.id)).toEqual([uuidOf(1, 1), uuidOf(2, 1)]);
    await adapter.commitPull();
    expect(readPullCursor(storage, APP, WORKSPACE_A)).not.toBeNull();

    server.advance(5000);
    await adapterFor(server).push([record(3)]);
    const second = await adapter.pull([uuidOf(1, 1), uuidOf(2, 1)]);
    expect(second.map((r) => r.id)).toEqual([uuidOf(3, 1)]);
  });

  it('maps server rows back to records exactly', async () => {
    const server = new FakeSupabase();
    const original = record(7);
    await adapterFor(server).push([original]);
    expect(await adapterFor(server).pull([])).toEqual([original]);
  });

  it('pages through many rows that share one received_at without skipping any', async () => {
    const server = new FakeSupabase();
    const records = Array.from({ length: 23 }, (_, i) => record(i + 1));
    await adapterFor(server).push(records); // one batch: all rows get the same received_at
    expect(new Set(server.rows.map((r) => r.receivedMs)).size).toBe(1);
    const pulled = await adapterFor(server, { page: 5 }).pull([]);
    expect(pulled.map((r) => r.id).sort()).toEqual(records.map((r) => r.id).sort());
  });

  it('does not move the cursor until commitPull (an interrupted save pulls again)', async () => {
    const server = new FakeSupabase();
    const storage = createMemoryStorage();
    await adapterFor(server).push([record(1)]);
    const adapter = adapterFor(server, { storage });
    await adapter.pull([]);
    expect(readPullCursor(storage, APP, WORKSPACE_A)).toBeNull(); // not committed
    expect(await adapter.pull([])).toHaveLength(1); // so the record comes again
  });

  it('re-reads an overlap window, so a late-committed record behind the cursor is not missed', async () => {
    const server = new FakeSupabase();
    const storage = createMemoryStorage();
    await adapterFor(server).push([record(1)]);
    server.advance(10_000);
    await adapterFor(server).push([record(2)]);
    const adapter = adapterFor(server, { storage });
    await adapter.pull([]);
    await adapter.commitPull();
    // A push that started earlier commits now, stamped 30 s before the latest row.
    server.nextLagMs = () => 30_000;
    await adapterFor(server).push([record(3)]);
    expect((await adapter.pull([uuidOf(1, 1), uuidOf(2, 1)])).map((r) => r.id)).toEqual([uuidOf(3, 1)]);
  });

  it('resumes exactly where a capped pull stopped, so a busy overlap window can never stall it', async () => {
    const server = new FakeSupabase();
    const storage = createMemoryStorage();
    const old = Array.from({ length: 10 }, (_, i) => record(i + 1));
    await adapterFor(server).push(old);
    const adapter = adapterFor(server, { storage, page: 2, pages: 2 }); // at most 4 rows per pull
    const known = new Set<string>();
    const pullOnce = async () => {
      const got = await adapter.pull([...known]);
      got.forEach((r) => known.add(r.id));
      await adapter.commitPull();
      return got;
    };
    while (known.size < 10) await pullOnce();
    // New records arrive while all 10 old ones are still inside the overlap window.
    await adapterFor(server).push([record(11), record(12)]);
    for (let i = 0; i < 6 && known.size < 12; i++) await pullOnce();
    expect(known.has(uuidOf(11, 1)) && known.has(uuidOf(12, 1))).toBe(true);
  });

  it('keeps workspaces and apps apart, with a cursor per workspace and app', async () => {
    const server = new FakeSupabase();
    const storage = createMemoryStorage();
    await adapterFor(server, { workspace: () => WORKSPACE_A }).push([record(1)]);
    await adapterFor(server, { workspace: () => WORKSPACE_B }).push([record(2)]);
    await adapterFor(server, { workspace: () => WORKSPACE_A, app: 'clinic-queue' }).push([record(3)]);
    expect((await adapterFor(server, { workspace: () => WORKSPACE_A }).pull([])).map((r) => r.id)).toEqual([uuidOf(1, 1)]);
    expect((await adapterFor(server, { workspace: () => WORKSPACE_B }).pull([])).map((r) => r.id)).toEqual([uuidOf(2, 1)]);
    expect((await adapterFor(server, { workspace: () => WORKSPACE_A, app: 'clinic-queue' }).pull([])).map((r) => r.id)).toEqual([uuidOf(3, 1)]);

    writePullCursor(storage, APP, WORKSPACE_A, '2026-11-07T10:00:00.000Z');
    expect(readPullCursor(storage, APP, WORKSPACE_B)).toBeNull();
    expect(readPullCursor(storage, 'clinic-queue', WORKSPACE_A)).toBeNull();
  });

  it('turns a server or network error into a thrown error (the engine retries it)', async () => {
    const server = new FakeSupabase();
    server.nextFault = () => 'failBefore';
    await expect(adapterFor(server).push([record(1)])).rejects.toThrow(/push_records failed: TypeError: Failed to fetch/);
    await expect(adapterFor(server).pull([])).rejects.toThrow(/pull_records failed/);
  });

  it('times out a request that never answers', async () => {
    const hanging = { rpc: () => new Promise<never>(() => {}) };
    const adapter = new SupabaseSyncAdapter({ client: hanging, app: APP, getWorkspaceId: () => WORKSPACE_A, storage: createMemoryStorage(), requestTimeoutMs: 20 });
    await expect(adapter.pull([])).rejects.toThrow(/timed out/);
  });

  it('loads the client lazily and retries a failed load', async () => {
    const server = new FakeSupabase();
    let loads = 0;
    const adapter = new SupabaseSyncAdapter({
      client: async () => {
        loads++;
        if (loads === 1) throw new Error('chunk failed to load (offline)');
        return server;
      },
      app: APP,
      getWorkspaceId: () => WORKSPACE_A,
      storage: createMemoryStorage(),
    });
    expect(loads).toBe(0);
    await expect(adapter.pull([])).rejects.toThrow(/offline/);
    expect(await adapter.pull([])).toEqual([]);
    expect(loads).toBe(2);
  });

  it('through the engine: network errors become an error status and are retried with backoff', async () => {
    const server = new FakeSupabase();
    let failures = 2;
    server.nextFault = () => (failures-- > 0 ? 'failBefore' : 'none');
    const store = new MemoryStore('d1', 1);
    store.add('items', { a: 1 });
    const engine = createSyncEngine({ adapter: adapterFor(server), store, maxRetries: 3, baseDelayMs: 5, maxDelayMs: 10 });
    await engine.syncNow();
    expect(engine.getStatus().state).toBe('error');
    await new Promise((r) => setTimeout(r, 80));
    expect(engine.getStatus().state).toBe('synced');
    expect(server.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('properties (fast-check, fake Supabase)', () => {
  it('pushing the same records any number of times, in any order and batch size, never creates duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 30 }),
        fc.array(fc.array(fc.nat({ max: 29 }), { maxLength: 40 }), { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 1, max: 7 }),
        async (count, pushes, batch) => {
          const server = new FakeSupabase();
          const adapter = adapterFor(server, { push: batch });
          const records = Array.from({ length: count }, (_, i) => record(i + 1));
          const pushed = new Set<string>();
          for (const picks of pushes) {
            const subset = picks.map((p) => records[p % count]); // repeats inside a call too
            const returned = await adapter.push(subset);
            subset.forEach((r) => pushed.add(r.id));
            expect(new Set(returned)).toEqual(new Set(subset.map((r) => r.id)));
            server.advance(picks.length % 3); // sometimes the clock stands still
          }
          const ids = server.rows.map((r) => r.id);
          expect(new Set(ids).size).toBe(ids.length);
          expect(new Set(ids)).toEqual(pushed);
        },
      ),
      { numRuns: 150 },
    );
  });

  const arbOps = (devices: number) =>
    fc.array(
      fc.oneof(
        { weight: 5, arbitrary: fc.record({ kind: fc.constant('add' as const), device: fc.nat({ max: devices - 1 }) }) },
        { weight: 4, arbitrary: fc.record({ kind: fc.constant('sync' as const), device: fc.nat({ max: devices - 1 }) }) },
        { weight: 1, arbitrary: fc.record({ kind: fc.constant('tick' as const), ms: fc.integer({ min: 0, max: 5000 }) }) },
      ),
      { maxLength: 60 },
    );

  /** Devices in one workspace, each with its own store, cursor storage and adapter. */
  function setup(deviceCount: number, server: FakeSupabase, page: number) {
    return Array.from({ length: deviceCount }, (_, i) => {
      const store = new MemoryStore(`device-${i}`, i + 1);
      const adapter = adapterFor(server, { storage: createMemoryStorage(), page, pages: 2, push: 4 });
      // maxRetries 0: a failed cycle just ends; the next sync tries again (no timers in tests).
      const engine = createSyncEngine({ adapter, store, maxRetries: 0 });
      return { store, engine };
    });
  }

  /**
   * Without faults, keep syncing round-robin until every device holds exactly
   * the server's records with nothing pending. Pulls are capped (tiny pages,
   * 2 pages per cycle) so this can take many rounds; the bound is generous and
   * the assertions afterwards fail if it was not reached.
   */
  async function settle(devices: ReturnType<typeof setup>, server: FakeSupabase) {
    for (let round = 0; round < 300; round++) {
      for (const d of devices) await d.engine.syncNow();
      const serverIds = [...new Set(server.idsFor(WORKSPACE_A, APP))].sort().join();
      const pending = (await Promise.all(devices.map((d) => d.store.getPending()))).some((p) => p.length > 0);
      if (!pending && devices.every((d) => [...d.store.rows.keys()].sort().join() === serverIds)) return;
    }
  }

  it('interrupted syncs (lost requests, lost responses, interrupted saves) never lose a record', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 3 }).chain((n) => fc.tuple(fc.constant(n), arbOps(n))),
        fc.array(fc.constantFrom<Fault>('none', 'none', 'failBefore', 'failAfter'), { minLength: 1, maxLength: 20 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 6 }),
        async ([deviceCount, ops], faults, ingestFaults, page) => {
          const server = new FakeSupabase();
          let f = 0;
          server.nextFault = () => faults[f++ % faults.length];
          const devices = setup(deviceCount, server, page);
          let g = 0;
          for (const d of devices) d.store.failIngest = () => ingestFaults[g++ % ingestFaults.length] && g % 3 === 0;

          const created: SkeletonRecord<unknown>[] = [];
          for (const op of ops) {
            if (op.kind === 'add') created.push(devices[op.device].store.add('items', { by: op.device, n: created.length }));
            else if (op.kind === 'sync') await devices[op.device].engine.syncNow();
            else server.advance(op.ms);
          }

          // The network heals.
          server.nextFault = () => 'none';
          for (const d of devices) d.store.failIngest = () => false;
          await settle(devices, server);

          const serverIds = server.idsFor(WORKSPACE_A, APP);
          expect(new Set(serverIds).size).toBe(serverIds.length); // no duplicates
          expect(new Set(serverIds)).toEqual(new Set(created.map((r) => r.id))); // nothing lost
          for (const d of devices) {
            expect(new Set(d.store.rows.keys())).toEqual(new Set(created.map((r) => r.id)));
          }
        },
      ),
      { numRuns: 120 },
    );
  });

  it('several devices in one workspace converge to the same record set (with equal and late received_at values)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 4 }).chain((n) => fc.tuple(fc.constant(n), arbOps(n))),
        fc.array(fc.integer({ min: 0, max: 60_000 }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 6 }),
        async ([deviceCount, ops], lags, page) => {
          const server = new FakeSupabase();
          let l = 0;
          server.nextLagMs = () => lags[l++ % lags.length]; // late commits within the overlap window
          const devices = setup(deviceCount, server, page);
          for (const op of ops) {
            if (op.kind === 'add') devices[op.device].store.add('items', { by: op.device });
            else if (op.kind === 'sync') await devices[op.device].engine.syncNow();
            else server.advance(op.ms);
          }
          server.advance(61_000);
          await settle(devices, server);

          const reference = devices[0].store.snapshot();
          for (const d of devices) expect(d.store.snapshot()).toEqual(reference);
          expect(new Set(reference.map((r) => r.id))).toEqual(new Set(server.idsFor(WORKSPACE_A, APP)));
          for (const d of devices) expect(await d.store.getPending()).toEqual([]);
        },
      ),
      { numRuns: 120 },
    );
  });
});
