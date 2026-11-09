import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatPaisa } from '@skeleton/core';
import {
  deriveAll,
  deriveBalance,
  deriveBalanceMap,
  deriveCustomerList,
  deriveDashboard,
  deriveReport,
  filterCustomers,
  isValidAmount,
} from '../apps/khata/src/khata.reducers';
import { arbEntrySpec, buildLedger, dayISO, expectedBalance, rec, shuffle, toData } from './khata.helpers';

const arbSpecs = fc.array(arbEntrySpec(2), { maxLength: 40 });

/** Values that must never be treated as money. */
const JUNK_AMOUNTS: number[] = [
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  -100,
  -1,
  0,
  12.5,
  0.1,
  2 ** 60,
  Number.MAX_SAFE_INTEGER + 2,
];

describe('corrupt, zero, negative and huge amounts never change a balance', () => {
  it('isValidAmount accepts only positive safe integers', () => {
    for (const bad of JUNK_AMOUNTS) expect(isValidAmount(bad)).toBe(false);
    for (const bad of ['100', null, undefined, {}, [], true]) expect(isValidAmount(bad)).toBe(false);
    for (const good of [1, 50, 100, 99_999_999_900, Number.MAX_SAFE_INTEGER]) expect(isValidAmount(good)).toBe(true);
  });

  it('property: junk records mixed in are ignored, so the balance equals the valid-only balance', () => {
    fc.assert(
      fc.property(
        arbSpecs,
        fc.array(fc.tuple(fc.constantFrom(...JUNK_AMOUNTS), fc.boolean(), fc.nat({ max: 1 })), { maxLength: 15 }),
        (specs, junk) => {
          const clean = buildLedger(specs, 2);
          const credit = [...clean.credit];
          const payment = [...clean.payment];
          junk.forEach(([amountPaisa, isCredit, customer], i) => {
            const payload = { customerId: `cust-${customer}`, amountPaisa, date: dayISO(i) };
            if (isCredit) credit.push(rec('creditGiven', payload, `junk-c-${i}`, 5000 + i));
            else payment.push(rec('paymentReceived', payload, `junk-p-${i}`, 5000 + i));
          });

          for (let c = 0; c < 2; c++) {
            const state = deriveBalance(credit, payment, clean.reversal, `cust-${c}`);
            expect(Number.isNaN(state.balancePaisa)).toBe(false);
            expect(BigInt(state.balancePaisa)).toBe(expectedBalance(specs, c));
            for (const e of state.entries) expect(Number.isNaN(e.runningBalancePaisa)).toBe(false);
          }
          const map = deriveBalanceMap(credit, payment, clean.reversal);
          for (const v of map.values()) expect(Number.isFinite(v)).toBe(true);
        },
      ),
    );
  });

  it('an amount given as text or missing is ignored instead of crashing', () => {
    const credit = [
      rec('creditGiven', { customerId: 'c', amountPaisa: '500' as unknown as number, date: dayISO(1) }, 'a', 1),
      rec('creditGiven', { customerId: 'c', amountPaisa: undefined as unknown as number, date: dayISO(1) }, 'b', 2),
      rec('creditGiven', { customerId: 'c', amountPaisa: 70000, date: dayISO(1) }, 'ok', 3),
    ];
    expect(deriveBalance(credit, [], [], 'c').balancePaisa).toBe(70000);
    expect(deriveReport(credit, [], [], '2026-03-01', '2026-03-31').creditPaisa).toBe(70000);
  });

  it('property: totals on the dashboard and reports never turn into NaN or Infinity', () => {
    fc.assert(
      fc.property(arbSpecs, fc.array(fc.constantFrom(...JUNK_AMOUNTS), { maxLength: 8 }), (specs, junk) => {
        const l = buildLedger(specs, 2);
        const credit = [
          ...l.credit,
          ...junk.map((a, i) => rec('creditGiven', { customerId: 'cust-0', amountPaisa: a, date: dayISO(3) }, `j${i}`, 7000 + i)),
        ];
        const dashboard = deriveDashboard(deriveCustomerList(l.customers, []), credit, l.payment, l.reversal, dayISO(3));
        const report = deriveReport(credit, l.payment, l.reversal, dayISO(0), dayISO(27));
        for (const n of [
          dashboard.totalOutstandingPaisa,
          dashboard.creditTodayPaisa,
          dashboard.paymentsTodayPaisa,
          report.creditPaisa,
          report.paymentsPaisa,
          report.netPaisa,
        ]) {
          expect(Number.isFinite(n)).toBe(true);
        }
      }),
    );
  });

  it('property: very large amounts (up to Rs 999,999,999 each, 100 entries) still add up exactly', () => {
    fc.assert(
      fc.property(fc.array(arbEntrySpec(1, 99_999_999_900), { maxLength: 100 }), (specs) => {
        const l = buildLedger(specs, 1);
        const { balancePaisa } = deriveBalance(l.credit, l.payment, l.reversal, 'cust-0');
        expect(Number.isSafeInteger(balancePaisa)).toBe(true);
        expect(BigInt(balancePaisa)).toBe(expectedBalance(specs, 0));
        expect(formatPaisa(balancePaisa)).toMatch(/^-?Rs \d{1,3}(,\d{3})*(\.\d{2})?$/);
      }),
    );
  });
});

describe('reversals: twice, and reversing a reversal', () => {
  const credit = [rec('creditGiven', { customerId: 'c', amountPaisa: 250000, date: dayISO(1) }, 'e1', 1)];
  const payment = [rec('paymentReceived', { customerId: 'c', amountPaisa: 50000, date: dayISO(2) }, 'e2', 2)];

  it('reversing the same entry twice (even from two phones) counts as one reversal', () => {
    const once = [rec('entryReversed', { entryId: 'e1', reason: 'first' }, 'r1', 3)];
    const twice = [...once, rec('entryReversed', { entryId: 'e1', reason: 'second' }, 'r2', 4)];
    const a = deriveBalance(credit, payment, once, 'c');
    const b = deriveBalance(credit, payment, twice, 'c');
    expect(b.balancePaisa).toBe(-50000);
    expect(b.balancePaisa).toBe(a.balancePaisa);
    expect(b.entries.filter((e) => e.reversed)).toHaveLength(1);
  });

  it('reversing a reversal has no effect: the original entry stays reversed', () => {
    const reversals = [
      rec('entryReversed', { entryId: 'e1', reason: 'mistake' }, 'r1', 3),
      rec('entryReversed', { entryId: 'r1', reason: 'trying to undo the reversal' }, 'r2', 4),
    ];
    const state = deriveBalance(credit, payment, reversals, 'c');
    expect(state.balancePaisa).toBe(-50000);
    expect(state.entries.find((e) => e.id === 'e1')?.reversed).toBe(true);
    expect(deriveReport(credit, payment, reversals, '2026-03-01', '2026-03-31').creditPaisa).toBe(0);
  });

  it('property: extra reversals aimed at reversals, customers or random ids never change any balance', () => {
    fc.assert(
      fc.property(arbSpecs, fc.array(fc.string({ maxLength: 12 }), { maxLength: 10 }), fc.integer(), (specs, junkIds, seed) => {
        const l = buildLedger(specs, 2);
        const targets = [
          ...l.reversal.map((r) => r.id), // reversals of reversals
          ...l.customers.map((c) => c.id), // not entries at all
          ...junkIds,
        ].filter((id) => !specs.some((_, i) => `e-${i}` === id)); // never a real entry
        const extra = targets.map((entryId, i) => rec('entryReversed', { entryId, reason: 'x' }, `extra-${i}`, 9000 + i));
        const reversal = shuffle([...l.reversal, ...extra], seed);
        for (let c = 0; c < 2; c++) {
          expect(BigInt(deriveBalance(l.credit, l.payment, reversal, `cust-${c}`).balancePaisa)).toBe(expectedBalance(specs, c));
        }
      }),
    );
  });

  it('property: a duplicated reversal record never changes the balance', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const l = buildLedger(specs, 2);
        const duplicated = [...l.reversal, ...l.reversal.map((r) => rec('entryReversed', r.payload, `dup-${r.id}`, 9500))];
        for (let c = 0; c < 2; c++) {
          expect(deriveBalance(l.credit, l.payment, duplicated, `cust-${c}`).balancePaisa).toBe(
            deriveBalance(l.credit, l.payment, l.reversal, `cust-${c}`).balancePaisa,
          );
        }
      }),
    );
  });
});

describe('customers: duplicates, orphans and odd text', () => {
  it('two customers with the same name are different people with separate balances', () => {
    const created = [
      rec('customerCreated', { name: 'Ali', phone: '03001111111' }, 'ali-1', 1),
      rec('customerCreated', { name: 'Ali', phone: '03002222222' }, 'ali-2', 2),
    ];
    const credit = [
      rec('creditGiven', { customerId: 'ali-1', amountPaisa: 100000, date: dayISO(1) }, 'c1', 3),
      rec('creditGiven', { customerId: 'ali-2', amountPaisa: 250000, date: dayISO(1) }, 'c2', 4),
    ];
    const customers = deriveCustomerList(created, []);
    const balances = deriveBalanceMap(credit, [], []);
    expect(customers).toHaveLength(2);
    expect(balances.get('ali-1')).toBe(100000);
    expect(balances.get('ali-2')).toBe(250000);
    expect(filterCustomers(customers, balances, 'ali').map((r) => r.customer.id)).toEqual(['ali-2', 'ali-1']);
    expect(deriveDashboard(customers, credit, [], [], dayISO(1)).customersOwingCount).toBe(2);
  });

  it('entries for a customer that does not exist (not synced yet) do not break anything', () => {
    const customers = deriveCustomerList([rec('customerCreated', { name: 'Real' }, 'real', 1)], []);
    const credit = [
      rec('creditGiven', { customerId: 'real', amountPaisa: 100000, date: dayISO(1) }, 'a', 2),
      rec('creditGiven', { customerId: 'ghost', amountPaisa: 900000, date: dayISO(1) }, 'b', 3),
    ];
    const dashboard = deriveDashboard(customers, credit, [], [], dayISO(1));
    expect(dashboard.totalOutstandingPaisa).toBe(100000); // only known customers count as "owing"
    expect(dashboard.customersOwingCount).toBe(1);
    expect(dashboard.creditTodayPaisa).toBe(1_000_000); // but the money really was given today
  });

  it('property: very long names and notes are handled without error and stay searchable', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 200, maxLength: 3000 }), fc.string({ maxLength: 3000 }), (name, note) => {
        const customers = deriveCustomerList([rec('customerCreated', { name, note }, 'c', 1)], []);
        expect(customers[0].name).toBe(name);
        const rows = filterCustomers(customers, new Map([['c', 1000]]), name.slice(0, 20).toLowerCase());
        expect(rows.length).toBeLessThanOrEqual(1);
      }),
      { numRuns: 30 },
    );
  });

  it('search text with regular-expression symbols is treated as plain text', () => {
    const customers = deriveCustomerList([rec('customerCreated', { name: 'A.B (C) [D] +E*' }, 'c', 1)], []);
    for (const q of ['(', '[', '.*', '+', '\\', '$', '^', '?']) {
      expect(() => filterCustomers(customers, new Map(), q)).not.toThrow();
    }
    expect(filterCustomers(customers, new Map(), '(c)')).toHaveLength(1);
    expect(filterCustomers(customers, new Map(), '.*')).toHaveLength(0);
  });
});

describe('dates', () => {
  it('an entry with an impossible date still counts towards the balance but not towards date-based reports', () => {
    const credit = [
      rec('creditGiven', { customerId: 'c', amountPaisa: 100000, date: '2026-02-30' }, 'bad', 1),
      rec('creditGiven', { customerId: 'c', amountPaisa: 50000, date: dayISO(5) }, 'good', 2),
    ];
    expect(deriveBalance(credit, [], [], 'c').balancePaisa).toBe(150000);
    expect(deriveReport(credit, [], [], '2026-01-01', '2026-12-31').creditPaisa).toBe(50000);
  });

  it('the ledger is ordered by the date on the entry, so a backdated entry sits in the right place', () => {
    const credit = [
      rec('creditGiven', { customerId: 'c', amountPaisa: 100000, date: '2026-03-20' }, 'later', 1),
      // recorded afterwards, but for an earlier day
      rec('creditGiven', { customerId: 'c', amountPaisa: 50000, date: '2026-03-10' }, 'backdated', 2),
    ];
    const { entries, balancePaisa } = deriveBalance(credit, [], [], 'c');
    expect(entries.map((e) => e.id)).toEqual(['backdated', 'later']);
    expect(entries.map((e) => e.runningBalancePaisa)).toEqual([50000, 150000]);
    expect(balancePaisa).toBe(150000);
  });
});

describe('an empty or brand-new database', () => {
  it('derives a sensible, crash-free empty state', () => {
    const derived = deriveAll(
      { customerCreated: [], customerUpdated: [], creditGiven: [], paymentReceived: [], entryReversed: [], settingsUpdated: [] },
      dayISO(1),
    );
    expect(derived.customers).toEqual([]);
    expect(derived.dashboard).toEqual({
      totalOutstandingPaisa: 0,
      customersOwingCount: 0,
      creditTodayPaisa: 0,
      paymentsTodayPaisa: 0,
      topDebtors: [],
    });
    expect(derived.settings).toEqual({ shopName: 'My Shop', language: 'en', demoDataLoaded: false });
  });

  it('property: deriveAll never throws for any generated ledger', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        expect(() => deriveAll(toData(buildLedger(specs, 2)), dayISO(2))).not.toThrow();
      }),
    );
  });
});
