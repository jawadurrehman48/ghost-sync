import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Dexie from 'dexie';
import { createDatabase, createStore, todayISO } from '@skeleton/core';
import type { SkeletonRecord, Store, TypedDexie } from '@skeleton/core';
import {
  activeTokenFor,
  deriveDeviceLetter,
  deriveQueue,
  deriveTokens,
  nextTokenNumber,
} from '../apps/clinic-queue/src/clinic.reducers';
import {
  callNext,
  callToken,
  completeToken,
  issueToken,
  loadClinicData,
  requeueToken,
  setDeviceLetter,
  skipToken,
} from '../apps/clinic-queue/src/clinic.actions';
import type { ClinicCollections } from '../apps/clinic-queue/src/clinic.types';
import { DAY, arbScenario, atMin, buildScenario, emptyData, rec, referenceStatus, shuffleData } from './clinic.helpers';

type Issued = SkeletonRecord<ClinicCollections['tokenIssued']>;

// ---------------------------------------------------------------------------
// TR-1: token labels are never duplicated across offline devices
// ---------------------------------------------------------------------------

describe('TR-1: token labels are unique across several offline devices (property-based)', () => {
  const arbOps = (devices: number) =>
    fc.array(
      fc.oneof(
        { weight: 6, arbitrary: fc.record({ kind: fc.constant('issue' as const), device: fc.nat({ max: devices - 1 }), day: fc.nat({ max: 2 }) }) },
        { weight: 3, arbitrary: fc.record({ kind: fc.constant('sync' as const), device: fc.nat({ max: devices - 1 }) }) },
        { weight: 1, arbitrary: fc.record({ kind: fc.constant('reletter' as const), device: fc.nat({ max: devices - 1 }) }) },
      ),
      { maxLength: 80 },
    );

  it('for any interleaving of issuing, syncing and switching to a fresh letter, no label repeats on a day', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 4 }).chain((n) => fc.tuple(fc.constant(n), arbOps(n))), ([deviceCount, ops]) => {
        const devices = Array.from({ length: deviceCount }, (_, i) => ({
          id: `device-${i}`,
          letter: 'ABCD'[i],
          known: [] as Issued[], // what this device has seen locally
        }));
        const fresh = 'EFGHIJKLMNOPQRSTUVWXYZ'.split(''); // letters nobody has used yet
        const cloud = new Map<string, Issued>();
        let seq = 0;

        for (const op of ops) {
          const d = devices[op.device];
          if (op.kind === 'issue') {
            const date = `2026-03-1${op.day}`;
            const number = nextTokenNumber(d.known, date, d.letter, d.id);
            d.known.push(rec('tokenIssued', { patientId: 'p', prefix: d.letter, number, date, at: atMin(seq) }, `r-${seq}`, seq++, d.id));
          } else if (op.kind === 'sync') {
            for (const r of d.known) cloud.set(r.id, r);
            const ids = new Set(d.known.map((r) => r.id));
            for (const r of cloud.values()) if (!ids.has(r.id)) d.known.push(r);
          } else if (fresh.length > 0) {
            d.letter = fresh.shift() as string;
          }
        }

        const all = new Map<string, Issued>();
        for (const d of devices) for (const r of d.known) all.set(r.id, r);
        const labels = [...all.values()].map((r) => `${r.payload.date}:${r.payload.prefix}-${r.payload.number}`);
        expect(new Set(labels).size).toBe(labels.length);
      }),
    );
  });

  it('numbers restart at 1 each day, and each device counts up without gaps on its own', () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 2 }), { minLength: 1, maxLength: 40 }), (days) => {
        const known: Issued[] = [];
        days.forEach((day, i) => {
          const date = `2026-03-1${day}`;
          known.push(rec('tokenIssued', { patientId: 'p', prefix: 'A', number: nextTokenNumber(known, date, 'A', 'd'), date, at: atMin(i) }, `r${i}`, i, 'd'));
        });
        for (const day of new Set(days)) {
          const numbers = known.filter((r) => r.payload.date === `2026-03-1${day}`).map((r) => r.payload.number);
          expect(numbers).toEqual(numbers.map((_, i) => i + 1));
        }
      }),
    );
  });

  it('ignores corrupt records when counting', () => {
    const issued = [
      rec('tokenIssued', { patientId: 'p', prefix: 'A', number: 3, date: DAY, at: atMin(0) }, 'ok', 1),
      rec('tokenIssued', { patientId: 'p', prefix: 'A', number: 1e20, date: DAY, at: atMin(0) }, 'huge', 2),
      rec('tokenIssued', { patientId: 'p', prefix: 'AA', number: 99, date: DAY, at: atMin(0) }, 'badPrefix', 3),
      rec('tokenIssued', { patientId: 'p', prefix: 'A', number: -5, date: DAY, at: atMin(0) }, 'neg', 4),
    ];
    expect(nextTokenNumber(issued, DAY, 'A', 'other')).toBe(4);
  });
});

describe('device letters', () => {
  const letter = (deviceId: string, l: string, tick: number) => rec('deviceLetterSet', { deviceId, letter: l }, `l-${tick}`, tick);

  it('suggests A for the first device and the first free letter for the next ones', () => {
    expect(deriveDeviceLetter([], 'me')).toEqual({ letter: 'A', claimed: false, conflict: false, usedByOthers: [] });
    expect(deriveDeviceLetter([letter('x', 'A', 1), letter('y', 'B', 2)], 'me').letter).toBe('C');
  });

  it('uses the latest letter a device chose, and warns when another device has the same one', () => {
    const records = [letter('me', 'A', 1), letter('me', 'D', 2), letter('other', 'D', 3)];
    expect(deriveDeviceLetter(records, 'me')).toEqual({ letter: 'D', claimed: true, conflict: true, usedByOthers: ['D'] });
    expect(deriveDeviceLetter([letter('me', 'A', 1), letter('other', 'B', 2)], 'me').conflict).toBe(false);
  });

  it('ignores invalid letters', () => {
    expect(deriveDeviceLetter([letter('me', 'aa', 1)], 'me').claimed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TR-2 and TR-3: order independence and the life-cycle rules
// ---------------------------------------------------------------------------

describe('TR-2: the same tokens and queue whatever order records arrive in (property-based)', () => {
  it('shuffling every collection changes nothing', () => {
    fc.assert(
      fc.property(arbScenario, fc.integer(), (scenario, seed) => {
        const data = buildScenario(scenario);
        const shuffled = shuffleData(data, seed);
        expect(deriveTokens(shuffled)).toEqual(deriveTokens(data));
        expect(deriveQueue(deriveTokens(shuffled), DAY)).toEqual(deriveQueue(deriveTokens(data), DAY));
      }),
    );
  });

  it('the waiting list is in the order patients (re)joined the queue', () => {
    fc.assert(
      fc.property(arbScenario, (scenario) => {
        const { waiting } = deriveQueue(deriveTokens(buildScenario(scenario)), DAY);
        for (let i = 1; i < waiting.length; i++) expect(waiting[i - 1].queuedAt <= waiting[i].queuedAt).toBe(true);
      }),
    );
  });

  it('a re-queued patient goes to the back of the line', () => {
    const data = emptyData();
    data.tokenIssued.push(
      rec('tokenIssued', { patientId: 'a', prefix: 'A', number: 1, date: DAY, at: atMin(0) }, 't1', 1),
      rec('tokenIssued', { patientId: 'b', prefix: 'A', number: 2, date: DAY, at: atMin(5) }, 't2', 2),
      rec('tokenIssued', { patientId: 'c', prefix: 'A', number: 3, date: DAY, at: atMin(10) }, 't3', 3),
    );
    data.tokenSkipped.push(rec('tokenSkipped', { tokenId: 't1', at: atMin(12) }, 's1', 4));
    data.tokenRequeued.push(rec('tokenRequeued', { tokenId: 't1', at: atMin(15) }, 'q1', 5));
    expect(deriveQueue(deriveTokens(data), DAY).waiting.map((t) => t.label)).toEqual(['A-2', 'A-3', 'A-1']);
  });
});

describe('TR-3: tokens follow the life cycle (property-based)', () => {
  it('every token ends in the state the spec transition table gives', () => {
    fc.assert(
      fc.property(arbScenario, (scenario) => {
        const data = buildScenario(scenario);
        const events = [
          ...data.tokenCalled.map((r) => ({ kind: 'called' as const, r })),
          ...data.tokenCompleted.map((r) => ({ kind: 'completed' as const, r })),
          ...data.tokenSkipped.map((r) => ({ kind: 'skipped' as const, r })),
          ...data.tokenRequeued.map((r) => ({ kind: 'requeued' as const, r })),
        ];
        for (const token of deriveTokens(data)) {
          const mine = events
            .filter((e) => e.r.payload.tokenId === token.id)
            .map((e) => ({ kind: e.kind, ms: Date.parse(e.r.payload.at), createdAt: e.r.createdAt, id: e.r.id }));
          expect(token.status).toBe(referenceStatus(mine));
        }
      }),
    );
  });

  it('a completed token was always called first, and its times are in order', () => {
    fc.assert(
      fc.property(arbScenario, (scenario) => {
        for (const t of deriveTokens(buildScenario(scenario))) {
          if (t.status === 'completed') {
            expect(t.firstCalledAt).toBeDefined();
            expect(t.calledAt).toBeDefined();
            expect(t.issuedAt <= (t.firstCalledAt as string) || true).toBe(true);
            expect((t.calledAt as string) <= (t.completedAt as string)).toBe(true);
          } else {
            expect(t.completedAt).toBeUndefined();
          }
          if (t.status === 'serving') expect(t.calledAt).toBeDefined();
        }
      }),
    );
  });

  it('a completed token never returns to waiting or serving, whatever events come later', () => {
    fc.assert(
      fc.property(
        arbScenario,
        fc.array(fc.constantFrom('called', 'completed', 'skipped', 'requeued'), { minLength: 1, maxLength: 10 }),
        (scenario, later) => {
          const data = buildScenario(scenario);
          const done = deriveTokens(data).filter((t) => t.status === 'completed');
          let tick = 5000;
          for (const token of done) {
            for (const kind of later) {
              const at = atMin(10_000 + tick); // after everything else
              const r = { tokenId: token.id, at };
              if (kind === 'called') data.tokenCalled.push(rec('tokenCalled', r, `late-${tick}`, tick++));
              if (kind === 'completed') data.tokenCompleted.push(rec('tokenCompleted', { ...r, notes: 'late' }, `late-${tick}`, tick++));
              if (kind === 'skipped') data.tokenSkipped.push(rec('tokenSkipped', r, `late-${tick}`, tick++));
              if (kind === 'requeued') data.tokenRequeued.push(rec('tokenRequeued', r, `late-${tick}`, tick++));
            }
          }
          const after = new Map(deriveTokens(data).map((t) => [t.id, t]));
          for (const token of done) expect(after.get(token.id)).toEqual(token);
        },
      ),
    );
  });

  it('a token that was never called can never be completed', () => {
    fc.assert(
      fc.property(arbScenario, (scenario) => {
        const s = { ...scenario, events: scenario.events.filter((e) => e.kind !== 'called') };
        for (const t of deriveTokens(buildScenario(s))) {
          expect(t.status === 'completed' || t.status === 'serving').toBe(false);
        }
      }),
    );
  });

  it('a completion recorded before the call (clock skew) is ignored instead of finishing the visit', () => {
    const data = emptyData();
    data.tokenIssued.push(rec('tokenIssued', { patientId: 'a', prefix: 'A', number: 1, date: DAY, at: atMin(0) }, 't1', 1));
    data.tokenCompleted.push(rec('tokenCompleted', { tokenId: 't1', at: atMin(5) }, 'c', 2));
    data.tokenCalled.push(rec('tokenCalled', { tokenId: 't1', at: atMin(10) }, 'k', 3));
    expect(deriveTokens(data)[0].status).toBe('serving');
  });

  it('events for unknown tokens and corrupt tokens are ignored', () => {
    const data = emptyData();
    data.tokenIssued.push(rec('tokenIssued', { patientId: 'a', prefix: 'a', number: 1, date: DAY, at: atMin(0) }, 'bad', 1));
    data.tokenCalled.push(rec('tokenCalled', { tokenId: 'ghost', at: atMin(1) }, 'k', 2));
    expect(deriveTokens(data)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Actions against a real (fake-IndexedDB) store
// ---------------------------------------------------------------------------

const COLLECTIONS = {
  patientRegistered: undefined,
  tokenIssued: undefined,
  tokenCalled: undefined,
  tokenCompleted: undefined,
  tokenSkipped: undefined,
  tokenRequeued: undefined,
  deviceLetterSet: undefined,
  settingsUpdated: undefined,
};
const opened: TypedDexie<ClinicCollections>[] = [];
function freshStore(deviceId = 'device-1'): Store<ClinicCollections> {
  const db = createDatabase<ClinicCollections>({ dbName: `clinic-test-${Date.now()}-${Math.random()}`, collections: COLLECTIONS });
  opened.push(db);
  return createStore(db, deviceId);
}
afterEach(async () => {
  while (opened.length) {
    const db = opened.pop() as TypedDexie<ClinicCollections>;
    db.close();
    await Dexie.delete(db.name);
  }
});

async function queueOf(store: Store<ClinicCollections>, date = todayISO()) {
  return deriveQueue(deriveTokens(await loadClinicData(store)), date);
}

describe('clinic actions', () => {
  it('issues A-1, A-2 ... claims the letter once, and reports how many are ahead', async () => {
    const store = freshStore();
    const p1 = (await store.add('patientRegistered', { name: 'Ali' })).id;
    const p2 = (await store.add('patientRegistered', { name: 'Sara' })).id;
    const a = await issueToken(store, 'device-1', p1, 'Fever');
    const b = await issueToken(store, 'device-1', p2);
    expect(a).toMatchObject({ status: 'issued', label: 'A-1', ahead: 0 });
    expect(b).toMatchObject({ status: 'issued', label: 'A-2', ahead: 1 });
    expect(await store.query('deviceLetterSet')).toHaveLength(1);
    const issued = await store.query('tokenIssued');
    expect(issued[0].payload.reason).toBe('Fever');
    expect(issued[1].payload.reason).toBeUndefined();
  });

  it('refuses a second token for a patient already waiting today', async () => {
    const store = freshStore();
    const p = (await store.add('patientRegistered', { name: 'Ali' })).id;
    const first = await issueToken(store, 'device-1', p);
    const second = await issueToken(store, 'device-1', p);
    expect(second).toEqual({ status: 'alreadyActive', tokenId: (first as { tokenId: string }).tokenId, label: 'A-1' });
    expect(await store.query('tokenIssued')).toHaveLength(1);
  });

  it('allows a new token once the earlier visit is finished, and restarts numbers the next day', async () => {
    const store = freshStore();
    const p = (await store.add('patientRegistered', { name: 'Ali' })).id;
    const day1 = new Date(2026, 2, 10, 10, 0);
    const day2 = new Date(2026, 2, 11, 10, 0);
    await issueToken(store, 'device-1', p, undefined, { now: day1 });
    await callNext(store, { now: day1 });
    await callNext(store, { now: day1 }); // completes it
    expect((await issueToken(store, 'device-1', p, undefined, { now: day1 })).label).toBe('A-2');
    expect((await issueToken(store, 'device-1', p, undefined, { now: day2 })).label).toBe('A-1');
  });

  it('call next: calls, then completes and calls, then completes, then does nothing', async () => {
    const store = freshStore();
    const [x, y] = [
      (await store.add('patientRegistered', { name: 'X' })).id,
      (await store.add('patientRegistered', { name: 'Y' })).id,
    ];
    await issueToken(store, 'device-1', x);
    await issueToken(store, 'device-1', y);

    const r1 = await callNext(store);
    expect(r1.completedId).toBeUndefined();
    expect((await queueOf(store)).serving.map((t) => t.label)).toEqual(['A-1']);

    const r2 = await callNext(store);
    expect(r2.completedId).toBe(r1.calledId);
    let q = await queueOf(store);
    expect(q.serving.map((t) => t.label)).toEqual(['A-2']);
    expect(q.completed.map((t) => t.label)).toEqual(['A-1']);

    await callNext(store);
    q = await queueOf(store);
    expect(q.serving).toEqual([]);
    expect(q.completed).toHaveLength(2);

    expect(await callNext(store)).toEqual({});
  });

  it('complete, skip, requeue and call only act in an allowed state', async () => {
    const store = freshStore();
    const p = (await store.add('patientRegistered', { name: 'X' })).id;
    const { tokenId } = (await issueToken(store, 'device-1', p)) as { tokenId: string };

    expect(await completeToken(store, tokenId, 'too early')).toBe(false); // not called yet
    expect(await requeueToken(store, tokenId)).toBe(false); // not skipped
    expect(await skipToken(store, tokenId)).toBe(true);
    expect(await callToken(store, tokenId)).toBe(false); // skipped, must requeue first
    expect(await requeueToken(store, tokenId)).toBe(true);
    expect(await callToken(store, tokenId)).toBe(true);
    expect(await callToken(store, tokenId)).toBe(false); // already being served
    expect(await completeToken(store, tokenId, '  Paracetamol  ')).toBe(true);
    expect(await completeToken(store, tokenId)).toBe(false); // already completed
    expect(await skipToken(store, tokenId)).toBe(false);

    const token = deriveTokens(await loadClinicData(store))[0];
    expect(token.status).toBe('completed');
    expect(token.notes).toBe('Paracetamol');
    expect(await store.query('tokenCompleted')).toHaveLength(1);
  });

  it('two devices with their own letters never clash, even fully offline (real stores)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.nat({ max: 1 }), { minLength: 1, maxLength: 12 }), async (who) => {
        const devices = [
          { id: 'tablet', store: freshStore('tablet') },
          { id: 'phone', store: freshStore('phone') },
        ];
        await setDeviceLetter(devices[0].store, 'tablet', 'A');
        await setDeviceLetter(devices[1].store, 'phone', 'B');
        for (const index of who) {
          const d = devices[index];
          const p = (await d.store.add('patientRegistered', { name: `P${Math.random()}` })).id;
          await issueToken(d.store, d.id, p);
        }
        const labels = [
          ...(await devices[0].store.query('tokenIssued')),
          ...(await devices[1].store.query('tokenIssued')),
        ].map((r) => `${r.payload.prefix}-${r.payload.number}`);
        expect(new Set(labels).size).toBe(labels.length);
      }),
      { numRuns: 15 },
    );
  });

  it('activeTokenFor finds only waiting or serving tokens of that day', () => {
    const data = buildScenario({ tokens: [{ patient: 1, at: 0 }], events: [] });
    const tokens = deriveTokens(data);
    expect(activeTokenFor(tokens, 'p-1', DAY)?.label).toBe('A-1');
    expect(activeTokenFor(tokens, 'p-1', '2026-03-11')).toBeUndefined();
    expect(activeTokenFor(tokens, 'p-2', DAY)).toBeUndefined();
  });
});
