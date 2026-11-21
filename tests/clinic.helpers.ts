import * as fc from 'fast-check';
import type { SkeletonRecord } from '@skeleton/core';
import type { ClinicCollections, ClinicData } from '../apps/clinic-queue/src/clinic.types';

const BASE = Date.UTC(2026, 2, 10, 4, 0, 0); // 10 March 2026, 09:00 in Pakistan
export const DAY = '2026-03-10';

/** A timestamp `minutes` after the base time. */
export const atMin = (minutes: number): string => new Date(BASE + minutes * 60_000).toISOString();

export function rec<K extends keyof ClinicCollections>(
  collection: K,
  payload: ClinicCollections[K],
  id: string,
  tick: number,
  deviceId = 'device-1',
): SkeletonRecord<ClinicCollections[K]> {
  return { id, createdAt: new Date(BASE + tick * 1000).toISOString(), deviceId, collection, payload };
}

export function emptyData(): ClinicData {
  return {
    patientRegistered: [],
    tokenIssued: [],
    tokenCalled: [],
    tokenCompleted: [],
    tokenSkipped: [],
    tokenRequeued: [],
    deviceLetterSet: [],
    settingsUpdated: [],
  };
}

export type EventKind = 'called' | 'completed' | 'skipped' | 'requeued';

export type Scenario = {
  tokens: { patient: number; at: number }[];
  events: { kind: EventKind; token: number; at: number; notes: string | null }[];
};

/** Random tokens on one day and random events aimed at them (many of them not allowed). */
export const arbScenario: fc.Arbitrary<Scenario> = fc.record({
  tokens: fc.array(fc.record({ patient: fc.nat({ max: 5 }), at: fc.nat({ max: 300 }) }), { minLength: 1, maxLength: 12 }),
  events: fc.array(
    fc.record({
      kind: fc.constantFrom<EventKind>('called', 'completed', 'skipped', 'requeued'),
      token: fc.nat({ max: 11 }),
      at: fc.nat({ max: 600 }),
      notes: fc.option(fc.string({ maxLength: 12 }), { nil: null }),
    }),
    { maxLength: 60 },
  ),
});

/** Records for a scenario: tokens t-0..t-n (A-1..A-n+1), events e-0..e-m. */
export function buildScenario(s: Scenario): ClinicData {
  const data = emptyData();
  s.tokens.forEach((tk, i) => {
    data.tokenIssued.push(
      rec('tokenIssued', { patientId: `p-${tk.patient}`, prefix: 'A', number: i + 1, date: DAY, at: atMin(tk.at) }, `t-${i}`, i),
    );
  });
  s.events.forEach((e, j) => {
    const tokenId = `t-${e.token % s.tokens.length}`;
    const at = atMin(e.at);
    const tick = 1000 + j;
    if (e.kind === 'called') data.tokenCalled.push(rec('tokenCalled', { tokenId, at }, `e-${j}`, tick));
    if (e.kind === 'completed')
      data.tokenCompleted.push(rec('tokenCompleted', { tokenId, at, ...(e.notes ? { notes: e.notes } : {}) }, `e-${j}`, tick));
    if (e.kind === 'skipped') data.tokenSkipped.push(rec('tokenSkipped', { tokenId, at }, `e-${j}`, tick));
    if (e.kind === 'requeued') data.tokenRequeued.push(rec('tokenRequeued', { tokenId, at }, `e-${j}`, tick));
  });
  return data;
}

/** Deterministic shuffle (mulberry32 + Fisher-Yates), so failures replay. */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function shuffleData(data: ClinicData, seed: number): ClinicData {
  const out = emptyData();
  let k = 0;
  for (const key of Object.keys(data) as Array<keyof ClinicData>) {
    (out[key] as unknown[]) = shuffle(data[key] as unknown[], seed + k++);
  }
  return out;
}

/**
 * Independent reference for the token life cycle, written straight from the
 * spec (FR-2.1) as a transition table. The real reducer must agree with it.
 */
const ALLOWED: Record<string, Partial<Record<EventKind, string>>> = {
  waiting: { called: 'serving', skipped: 'skipped' },
  serving: { completed: 'completed', skipped: 'skipped' },
  skipped: { requeued: 'waiting' },
  completed: {},
};

export function referenceStatus(events: { kind: EventKind; ms: number; createdAt: string; id: string }[]): string {
  const sorted = [...events].sort(
    (a, b) => a.ms - b.ms || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) || (a.id < b.id ? -1 : 1),
  );
  let status = 'waiting';
  for (const e of sorted) status = ALLOWED[status][e.kind] ?? status;
  return status;
}
