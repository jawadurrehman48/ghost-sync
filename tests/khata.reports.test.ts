import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { addDays, daysBetween } from '@skeleton/core';
import {
  deriveCustomerBreakdown,
  deriveCustomerList,
  deriveDailyTotals,
  deriveDashboard,
  deriveReport,
} from '../apps/khata/src/khata.reducers';
import { arbEntrySpec, buildLedger, dayISO, expectedBalance, rec, shuffle } from './khata.helpers';

const CUSTOMERS = 5;
const arbSpecs = fc.array(arbEntrySpec(CUSTOMERS), { maxLength: 60 });
const arbRange = fc
  .tuple(fc.nat({ max: 27 }), fc.nat({ max: 27 }))
  .map(([a, b]) => ({ from: dayISO(Math.min(a, b)), to: dayISO(Math.max(a, b)) }));

describe('report chart buckets (property-based)', () => {
  it('the buckets add up exactly to the report totals', () => {
    fc.assert(
      fc.property(arbSpecs, arbRange, (specs, range) => {
        const l = buildLedger(specs, CUSTOMERS);
        const totals = deriveReport(l.credit, l.payment, l.reversal, range.from, range.to);
        const buckets = deriveDailyTotals(l.credit, l.payment, l.reversal, range.from, range.to);
        expect(buckets.reduce((s, b) => s + b.creditPaisa, 0)).toBe(totals.creditPaisa);
        expect(buckets.reduce((s, b) => s + b.paymentsPaisa, 0)).toBe(totals.paymentsPaisa);
      }),
    );
  });

  it('are contiguous, in order, and cover the whole range with no gaps or overlaps', () => {
    fc.assert(
      fc.property(arbRange, fc.integer({ min: 1, max: 40 }), (range, maxBuckets) => {
        const buckets = deriveDailyTotals([], [], [], range.from, range.to, maxBuckets);
        expect(buckets.length).toBeGreaterThan(0);
        expect(buckets.length).toBeLessThanOrEqual(maxBuckets);
        expect(buckets[0].from).toBe(range.from);
        expect(buckets[buckets.length - 1].to).toBe(range.to);
        for (let i = 0; i < buckets.length; i++) {
          expect(buckets[i].from <= buckets[i].to).toBe(true);
          if (i > 0) expect(buckets[i].from).toBe(addDays(buckets[i - 1].to, 1));
        }
      }),
    );
  });

  it('uses one bucket per day for ranges up to 31 days', () => {
    const buckets = deriveDailyTotals([], [], [], '2026-03-01', '2026-03-31');
    expect(buckets).toHaveLength(31);
    expect(buckets.every((b) => b.from === b.to)).toBe(true);
  });

  it('a single day gives a single bucket', () => {
    expect(deriveDailyTotals([], [], [], '2026-03-05', '2026-03-05')).toEqual([
      { from: '2026-03-05', to: '2026-03-05', creditPaisa: 0, paymentsPaisa: 0 },
    ]);
  });

  it('groups days into wider buckets for long ranges but keeps at most 31 of them', () => {
    const buckets = deriveDailyTotals([], [], [], '2026-01-01', '2026-12-31');
    expect(buckets.length).toBeLessThanOrEqual(31);
    expect(daysBetween(buckets[0].from, buckets[buckets.length - 1].to) + 1).toBe(365);
  });

  it('copes with an absurdly long range instantly', () => {
    const start = performance.now();
    const buckets = deriveDailyTotals([], [], [], '0001-01-01', '9999-12-31');
    expect(buckets.length).toBeLessThanOrEqual(31);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('returns nothing for an invalid or reversed range', () => {
    expect(deriveDailyTotals([], [], [], '2026-03-10', '2026-03-01')).toEqual([]);
    expect(deriveDailyTotals([], [], [], 'nope', '2026-03-01')).toEqual([]);
    expect(deriveDailyTotals([], [], [], '2026-03-01', '2026-13-45')).toEqual([]);
  });

  it('puts each entry in the right day, and leaves reversed entries out', () => {
    const credit = [
      rec('creditGiven', { customerId: 'c', amountPaisa: 100000, date: '2026-03-02' }, 'a', 1),
      rec('creditGiven', { customerId: 'c', amountPaisa: 300000, date: '2026-03-02' }, 'b', 2),
      rec('creditGiven', { customerId: 'c', amountPaisa: 900000, date: '2026-03-03' }, 'oops', 3),
    ];
    const payment = [rec('paymentReceived', { customerId: 'c', amountPaisa: 50000, date: '2026-03-03' }, 'p', 4)];
    const reversal = [rec('entryReversed', { entryId: 'oops', reason: 'x' }, 'r', 5)];
    const buckets = deriveDailyTotals(credit, payment, reversal, '2026-03-01', '2026-03-04');
    expect(buckets.map((b) => [b.creditPaisa, b.paymentsPaisa])).toEqual([
      [0, 0],
      [400000, 0],
      [0, 50000],
      [0, 0],
    ]);
  });

  it('is independent of the order records arrive in', () => {
    fc.assert(
      fc.property(arbSpecs, arbRange, fc.integer(), (specs, range, seed) => {
        const l = buildLedger(specs, CUSTOMERS);
        expect(
          deriveDailyTotals(shuffle(l.credit, seed), shuffle(l.payment, seed + 1), shuffle(l.reversal, seed + 2), range.from, range.to),
        ).toEqual(deriveDailyTotals(l.credit, l.payment, l.reversal, range.from, range.to));
      }),
    );
  });
});

describe('per-customer breakdown (property-based)', () => {
  it('rows add up exactly to the report totals', () => {
    fc.assert(
      fc.property(arbSpecs, arbRange, (specs, range) => {
        const l = buildLedger(specs, CUSTOMERS);
        const customers = deriveCustomerList(l.customers, []);
        const totals = deriveReport(l.credit, l.payment, l.reversal, range.from, range.to);
        const rows = deriveCustomerBreakdown(l.credit, l.payment, l.reversal, customers, range.from, range.to, '?');
        expect(rows.reduce((s, r) => s + r.creditPaisa, 0)).toBe(totals.creditPaisa);
        expect(rows.reduce((s, r) => s + r.paymentsPaisa, 0)).toBe(totals.paymentsPaisa);
      }),
    );
  });

  it('lists only customers with activity, each once, biggest credit first', () => {
    fc.assert(
      fc.property(arbSpecs, arbRange, (specs, range) => {
        const l = buildLedger(specs, CUSTOMERS);
        const customers = deriveCustomerList(l.customers, []);
        const rows = deriveCustomerBreakdown(l.credit, l.payment, l.reversal, customers, range.from, range.to, '?');
        expect(new Set(rows.map((r) => r.customerId)).size).toBe(rows.length);
        for (const r of rows) expect(r.creditPaisa + r.paymentsPaisa).toBeGreaterThan(0);
        for (let i = 1; i < rows.length; i++) expect(rows[i - 1].creditPaisa).toBeGreaterThanOrEqual(rows[i].creditPaisa);
      }),
    );
  });

  it('matches each customer’s own live credit and payments in the range', () => {
    fc.assert(
      fc.property(arbSpecs, arbRange, (specs, range) => {
        const l = buildLedger(specs, CUSTOMERS);
        const customers = deriveCustomerList(l.customers, []);
        const rows = deriveCustomerBreakdown(l.credit, l.payment, l.reversal, customers, range.from, range.to, '?');
        for (let c = 0; c < CUSTOMERS; c++) {
          let credit = 0n;
          let payments = 0n;
          for (const s of specs) {
            const date = dayISO(s.day);
            if (s.customer !== c || s.reversed || date < range.from || date > range.to) continue;
            if (s.type === 'credit') credit += BigInt(s.amountPaisa);
            else payments += BigInt(s.amountPaisa);
          }
          const row = rows.find((r) => r.customerId === `cust-${c}`);
          expect(BigInt(row?.creditPaisa ?? 0)).toBe(credit);
          expect(BigInt(row?.paymentsPaisa ?? 0)).toBe(payments);
        }
      }),
    );
  });

  it('groups entries of a customer that is not known yet under one labelled row', () => {
    const credit = [
      rec('creditGiven', { customerId: 'ghost', amountPaisa: 40000, date: '2026-03-02' }, 'a', 1),
      rec('creditGiven', { customerId: 'ghost', amountPaisa: 60000, date: '2026-03-03' }, 'b', 2),
    ];
    const rows = deriveCustomerBreakdown(credit, [], [], [], '2026-03-01', '2026-03-31', 'Unknown customer');
    expect(rows).toEqual([{ customerId: 'ghost', name: 'Unknown customer', creditPaisa: 100000, paymentsPaisa: 0 }]);
  });
});

describe('dashboard: how many customers owe money (property-based)', () => {
  it('counts exactly the customers with a positive balance, however many there are', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const l = buildLedger(specs, CUSTOMERS);
        const customers = deriveCustomerList(l.customers, []);
        const dashboard = deriveDashboard(customers, l.credit, l.payment, l.reversal, dayISO(0));
        let owing = 0;
        for (let c = 0; c < CUSTOMERS; c++) if (expectedBalance(specs, c) > 0n) owing++;
        expect(dashboard.customersOwingCount).toBe(owing);
        expect(dashboard.topDebtors.length).toBe(Math.min(5, owing));
      }),
    );
  });
});
