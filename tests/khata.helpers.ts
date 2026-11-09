import * as fc from 'fast-check';
import type { SkeletonRecord } from '@skeleton/core';
import type { KhataCollections, KhataData } from '../apps/khata/src/khata.types';

const BASE_TIME = 1_700_000_000_000;

/** A deterministic timestamp: `tick` seconds after a fixed start. */
export const at = (tick: number): string => new Date(BASE_TIME + tick * 1000).toISOString();

/** A date in March 2026 (day 0..27 → "2026-03-01".."2026-03-28"). */
export const dayISO = (n: number): string => `2026-03-${String((n % 28) + 1).padStart(2, '0')}`;

export function rec<K extends keyof KhataCollections>(
  collection: K,
  payload: KhataCollections[K],
  id: string,
  tick: number,
): SkeletonRecord<KhataCollections[K]> {
  return { id, createdAt: at(tick), deviceId: 'test-device', collection, payload };
}

/** One generated ledger entry (a credit or a payment, maybe reversed later). */
export type EntrySpec = {
  customer: number;
  type: 'credit' | 'payment';
  amountPaisa: number;
  reversed: boolean;
  day: number;
};

export const arbEntrySpec = (customerCount: number, maxPaisa = 1_000_000_000_000): fc.Arbitrary<EntrySpec> =>
  fc.record({
    customer: fc.nat({ max: customerCount - 1 }),
    type: fc.constantFrom('credit' as const, 'payment' as const),
    amountPaisa: fc.integer({ min: 1, max: maxPaisa }),
    reversed: fc.boolean(),
    day: fc.nat({ max: 27 }),
  });

export type Ledger = {
  customers: SkeletonRecord<KhataCollections['customerCreated']>[];
  credit: SkeletonRecord<KhataCollections['creditGiven']>[];
  payment: SkeletonRecord<KhataCollections['paymentReceived']>[];
  reversal: SkeletonRecord<KhataCollections['entryReversed']>[];
};

/** Customer ids are `cust-0..n-1`; entry ids `e-<index>`; a reversal is created right after its entry. */
export function buildLedger(specs: EntrySpec[], customerCount: number): Ledger {
  const ledger: Ledger = { customers: [], credit: [], payment: [], reversal: [] };

  for (let c = 0; c < customerCount; c++) {
    ledger.customers.push(rec('customerCreated', { name: `Customer ${c}` }, `cust-${c}`, c));
  }

  specs.forEach((s, i) => {
    const id = `e-${i}`;
    const payload = { customerId: `cust-${s.customer}`, amountPaisa: s.amountPaisa, date: dayISO(s.day) };
    if (s.type === 'credit') ledger.credit.push(rec('creditGiven', payload, id, 100 + i * 2));
    else ledger.payment.push(rec('paymentReceived', payload, id, 100 + i * 2));
    if (s.reversed) ledger.reversal.push(rec('entryReversed', { entryId: id, reason: 'mistake' }, `r-${i}`, 101 + i * 2));
  });

  return ledger;
}

/** Independent expected balance (BigInt, so no float or overflow questions). */
export function expectedBalance(specs: EntrySpec[], customer: number): bigint {
  let total = 0n;
  for (const s of specs) {
    if (s.customer === customer && !s.reversed) {
      total += (s.type === 'credit' ? 1n : -1n) * BigInt(s.amountPaisa);
    }
  }
  return total;
}

/** Deterministic shuffle (mulberry32 PRNG + Fisher-Yates), so failures can be replayed. */
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

export function toData(l: Ledger): KhataData {
  return {
    customerCreated: l.customers,
    customerUpdated: [],
    creditGiven: l.credit,
    paymentReceived: l.payment,
    entryReversed: l.reversal,
    settingsUpdated: [],
  };
}
