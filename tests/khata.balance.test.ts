import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { deriveBalance, deriveBalanceMap } from '../apps/khata/src/khata.reducers';
import { arbEntrySpec, buildLedger, dayISO, expectedBalance, rec, shuffle } from './khata.helpers';
import type { EntrySpec } from './khata.helpers';

const arbSpecs = fc.array(arbEntrySpec(3), { maxLength: 40 });

describe('TR-1: balance invariant (property-based)', () => {
  it('balance = sum of non-reversed credit − sum of non-reversed payments, for every customer', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const l = buildLedger(specs, 3);
        for (let c = 0; c < 3; c++) {
          const state = deriveBalance(l.credit, l.payment, l.reversal, `cust-${c}`);
          expect(BigInt(state.balancePaisa)).toBe(expectedBalance(specs, c));
        }
      }),
    );
  });

  it('deriveBalanceMap agrees with deriveBalance for every customer', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const l = buildLedger(specs, 3);
        const map = deriveBalanceMap(l.credit, l.payment, l.reversal);
        for (let c = 0; c < 3; c++) {
          const fromMap = map.get(`cust-${c}`) ?? 0;
          expect(fromMap).toBe(deriveBalance(l.credit, l.payment, l.reversal, `cust-${c}`).balancePaisa);
        }
      }),
    );
  });

  it('the running balance on each live entry is the sum of live entries up to it', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const l = buildLedger(specs, 3);
        const { entries } = deriveBalance(l.credit, l.payment, l.reversal, 'cust-1');
        let running = 0;
        for (const e of entries) {
          if (!e.reversed) {
            running += e.type === 'credit' ? e.amountPaisa : -e.amountPaisa;
            expect(e.runningBalancePaisa).toBe(running);
          }
        }
      }),
    );
  });

  it('keeps reversed entries in the ledger, marked reversed with their reason', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const l = buildLedger(specs, 3);
        const state = deriveBalance(l.credit, l.payment, l.reversal, 'cust-0');
        const mine = specs.filter((s) => s.customer === 0);
        expect(state.entries).toHaveLength(mine.length);
        expect(state.entries.filter((e) => e.reversed)).toHaveLength(mine.filter((s) => s.reversed).length);
        for (const e of state.entries.filter((x) => x.reversed)) expect(e.reverseReason).toBe('mistake');
      }),
    );
  });

  it('ignores reversal records that point at unknown entries', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const l = buildLedger(specs, 3);
        const withGhosts = [
          ...l.reversal,
          rec('entryReversed', { entryId: 'does-not-exist', reason: 'x' }, 'ghost-1', 9_000),
        ];
        expect(deriveBalance(l.credit, l.payment, withGhosts, 'cust-0').balancePaisa).toBe(
          deriveBalance(l.credit, l.payment, l.reversal, 'cust-0').balancePaisa,
        );
      }),
    );
  });
});

describe('TR-2: result does not depend on the order records arrive in (property-based)', () => {
  it('shuffling every record list gives identical balance, entries and reversed set', () => {
    fc.assert(
      fc.property(arbSpecs, fc.integer(), (specs, seed) => {
        const l = buildLedger(specs, 3);
        for (let c = 0; c < 3; c++) {
          const id = `cust-${c}`;
          const inOrder = deriveBalance(l.credit, l.payment, l.reversal, id);
          const shuffled = deriveBalance(
            shuffle(l.credit, seed),
            shuffle(l.payment, seed + 1),
            shuffle(l.reversal, seed + 2),
            id,
          );
          expect(shuffled.balancePaisa).toBe(inOrder.balancePaisa);
          expect(shuffled.entries).toEqual(inOrder.entries);
          expect(shuffled.reversedEntryIds).toEqual(inOrder.reversedEntryIds);
        }
      }),
    );
  });

  it('is stable even when many records share the same timestamp', () => {
    fc.assert(
      fc.property(arbSpecs, fc.integer(), (specs, seed) => {
        const l = buildLedger(specs, 3);
        const sameTime = (r: { createdAt: string }) => ({ ...r, createdAt: '2026-03-01T00:00:00.000Z' });
        const credit = l.credit.map(sameTime);
        const payment = l.payment.map(sameTime);
        const a = deriveBalance(credit, payment, l.reversal, 'cust-2');
        const b = deriveBalance(shuffle(credit, seed), shuffle(payment, seed + 1), l.reversal, 'cust-2');
        expect(b.entries).toEqual(a.entries);
        expect(b.balancePaisa).toBe(a.balancePaisa);
      }),
    );
  });

  it('a reversal that carries an EARLIER timestamp than its entry (clock skew between devices) still applies', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000_000 }), (amountPaisa) => {
        const credit = [rec('creditGiven', { customerId: 'c', amountPaisa, date: dayISO(1) }, 'e1', 500)];
        const reversal = [rec('entryReversed', { entryId: 'e1', reason: 'clock skew' }, 'r1', 100)];
        const state = deriveBalance(credit, [], reversal, 'c');
        expect(state.balancePaisa).toBe(0);
        expect(state.entries[0].reversed).toBe(true);
      }),
    );
  });
});

describe('TR-3: reversing an entry restores the exact previous balance (property-based)', () => {
  const arbExtra = fc.record({
    type: fc.constantFrom('credit' as const, 'payment' as const),
    amountPaisa: fc.integer({ min: 1, max: 1_000_000_000_000 }),
    day: fc.nat({ max: 27 }),
  });

  function balanceOf(specs: EntrySpec[]): number {
    const l = buildLedger(specs, 1);
    return deriveBalance(l.credit, l.payment, l.reversal, 'cust-0').balancePaisa;
  }

  it('adding an entry then reversing it leaves the balance exactly as before, wherever it sits in the history', () => {
    fc.assert(
      fc.property(fc.array(arbEntrySpec(1), { maxLength: 30 }), arbExtra, fc.nat(), (prior, extra, where) => {
        const index = where % (prior.length + 1);
        const entry = { customer: 0, day: extra.day, type: extra.type, amountPaisa: extra.amountPaisa };

        const before = balanceOf(prior);
        const withEntry = [...prior.slice(0, index), { ...entry, reversed: false }, ...prior.slice(index)];
        const withReversal = [...prior.slice(0, index), { ...entry, reversed: true }, ...prior.slice(index)];

        const signed = (entry.type === 'credit' ? 1 : -1) * entry.amountPaisa;
        expect(balanceOf(withEntry)).toBe(before + signed);
        expect(balanceOf(withReversal)).toBe(before);
      }),
    );
  });

  it('TR-9: a reversed entry has no effect, as if it had never been added', () => {
    fc.assert(
      fc.property(fc.array(arbEntrySpec(1), { maxLength: 30 }), (specs) => {
        const withoutReversed = specs.filter((s) => !s.reversed);
        expect(balanceOf(specs)).toBe(balanceOf(withoutReversed));
      }),
    );
  });
});

describe('TR-5: no rounding errors for any integer paisa amounts (property-based)', () => {
  it('the balance is an exact integer equal to the BigInt sum', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom('credit' as const, 'payment' as const),
            amountPaisa: fc.integer({ min: 1, max: 1_000_000_000_000 }),
          }),
          { maxLength: 60 },
        ),
        (items) => {
          const specs: EntrySpec[] = items.map((i) => ({ ...i, customer: 0, reversed: false, day: 0 }));
          const l = buildLedger(specs, 1);
          const { balancePaisa } = deriveBalance(l.credit, l.payment, l.reversal, 'cust-0');
          expect(Number.isSafeInteger(balancePaisa)).toBe(true);
          expect(BigInt(balancePaisa)).toBe(expectedBalance(specs, 0));
        },
      ),
    );
  });

  it('avoids the classic 0.1 + 0.2 floating-point trap (10 paisa + 20 paisa is exactly 30)', () => {
    const credit = [
      rec('creditGiven', { customerId: 'c', amountPaisa: 10, date: dayISO(0) }, 'a', 1),
      rec('creditGiven', { customerId: 'c', amountPaisa: 20, date: dayISO(0) }, 'b', 2),
    ];
    expect(deriveBalance(credit, [], [], 'c').balancePaisa).toBe(30);
  });

  it('credit followed by an equal payment always settles to exactly zero', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000_000_000 }), (amountPaisa) => {
        const credit = [rec('creditGiven', { customerId: 'c', amountPaisa, date: dayISO(0) }, 'a', 1)];
        const payment = [rec('paymentReceived', { customerId: 'c', amountPaisa, date: dayISO(0) }, 'b', 2)];
        expect(deriveBalance(credit, payment, [], 'c').balancePaisa).toBe(0);
      }),
    );
  });
});
