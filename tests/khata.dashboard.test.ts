import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  deriveAll,
  deriveBalance,
  deriveBalanceMap,
  deriveCustomerList,
  deriveDashboard,
  deriveReport,
  deriveSettings,
  filterCustomers,
} from '../apps/khata/src/khata.reducers';
import { arbEntrySpec, buildLedger, dayISO, expectedBalance, rec, shuffle, toData } from './khata.helpers';
import type { EntrySpec } from './khata.helpers';

const CUSTOMERS = 6;
const arbSpecs = fc.array(arbEntrySpec(CUSTOMERS), { maxLength: 60 });
const TODAY = dayISO(3);

function dashboardFor(specs: EntrySpec[], today = TODAY) {
  const l = buildLedger(specs, CUSTOMERS);
  const customers = deriveCustomerList(l.customers, []);
  return { l, customers, dashboard: deriveDashboard(customers, l.credit, l.payment, l.reversal, today) };
}

describe('TR-4: dashboard total outstanding (property-based)', () => {
  it('equals the exact sum of all positive customer balances', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const { customers, l, dashboard } = dashboardFor(specs);

        let expected = 0n;
        for (let c = 0; c < CUSTOMERS; c++) {
          const balance = expectedBalance(specs, c);
          if (balance > 0n) expected += balance;
        }
        expect(BigInt(dashboard.totalOutstandingPaisa)).toBe(expected);

        // ...and also equals the sum of the individually derived per-customer balances
        let viaDeriveBalance = 0;
        for (const c of customers) {
          const b = deriveBalance(l.credit, l.payment, l.reversal, c.id).balancePaisa;
          if (b > 0) viaDeriveBalance += b;
        }
        expect(dashboard.totalOutstandingPaisa).toBe(viaDeriveBalance);
      }),
    );
  });

  it('is independent of the order records arrive in', () => {
    fc.assert(
      fc.property(arbSpecs, fc.integer(), (specs, seed) => {
        const { l, customers, dashboard } = dashboardFor(specs);
        const shuffled = deriveDashboard(
          shuffle(customers, seed),
          shuffle(l.credit, seed + 1),
          shuffle(l.payment, seed + 2),
          shuffle(l.reversal, seed + 3),
          TODAY,
        );
        expect(shuffled).toEqual(dashboard);
      }),
    );
  });

  it('top debtors: at most 5, all owing, sorted highest first, and the real top 5', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const { dashboard } = dashboardFor(specs);
        const top = dashboard.topDebtors;
        expect(top.length).toBeLessThanOrEqual(5);
        for (const d of top) expect(d.balancePaisa).toBeGreaterThan(0);
        for (let i = 1; i < top.length; i++) {
          expect(top[i - 1].balancePaisa).toBeGreaterThanOrEqual(top[i].balancePaisa);
        }

        const allPositive = [];
        for (let c = 0; c < CUSTOMERS; c++) {
          const b = expectedBalance(specs, c);
          if (b > 0n) allPositive.push(b);
        }
        allPositive.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
        expect(top.map((d) => BigInt(d.balancePaisa))).toEqual(allPositive.slice(0, 5));
      }),
    );
  });

  it("today's credit and payments count only live entries dated today", () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const { dashboard } = dashboardFor(specs);
        let credit = 0n;
        let payments = 0n;
        for (const s of specs) {
          if (s.reversed || dayISO(s.day) !== TODAY) continue;
          if (s.type === 'credit') credit += BigInt(s.amountPaisa);
          else payments += BigInt(s.amountPaisa);
        }
        expect(BigInt(dashboard.creditTodayPaisa)).toBe(credit);
        expect(BigInt(dashboard.paymentsTodayPaisa)).toBe(payments);
      }),
    );
  });

  it('deriveAll agrees with the individual derivations', () => {
    fc.assert(
      fc.property(arbSpecs, (specs) => {
        const l = buildLedger(specs, CUSTOMERS);
        const derived = deriveAll(toData(l), TODAY);
        expect(derived.dashboard).toEqual(dashboardFor(specs).dashboard);
        expect(derived.balances).toEqual(deriveBalanceMap(l.credit, l.payment, l.reversal));
        expect(derived.today).toBe(TODAY);
      }),
    );
  });
});

describe('reports (property-based)', () => {
  const arbRange = fc
    .tuple(fc.nat({ max: 27 }), fc.nat({ max: 27 }))
    .map(([a, b]) => ({ from: dayISO(Math.min(a, b)), to: dayISO(Math.max(a, b)) }));

  it('totals only live entries dated within the inclusive range; net = payments − credit', () => {
    fc.assert(
      fc.property(arbSpecs, arbRange, (specs, range) => {
        const l = buildLedger(specs, CUSTOMERS);
        const report = deriveReport(l.credit, l.payment, l.reversal, range.from, range.to);

        let credit = 0n;
        let payments = 0n;
        for (const s of specs) {
          const date = dayISO(s.day);
          if (s.reversed || date < range.from || date > range.to) continue;
          if (s.type === 'credit') credit += BigInt(s.amountPaisa);
          else payments += BigInt(s.amountPaisa);
        }
        expect(BigInt(report.creditPaisa)).toBe(credit);
        expect(BigInt(report.paymentsPaisa)).toBe(payments);
        expect(BigInt(report.netPaisa)).toBe(payments - credit);
      }),
    );
  });

  it('widening the date range never decreases either total', () => {
    fc.assert(
      fc.property(arbSpecs, arbRange, (specs, range) => {
        const l = buildLedger(specs, CUSTOMERS);
        const narrow = deriveReport(l.credit, l.payment, l.reversal, range.from, range.to);
        const wide = deriveReport(l.credit, l.payment, l.reversal, dayISO(0), dayISO(27));
        expect(wide.creditPaisa).toBeGreaterThanOrEqual(narrow.creditPaisa);
        expect(wide.paymentsPaisa).toBeGreaterThanOrEqual(narrow.paymentsPaisa);
      }),
    );
  });

  it('splitting a range at any day gives two totals that add up to the whole', () => {
    fc.assert(
      fc.property(arbSpecs, fc.integer({ min: 0, max: 26 }), (specs, cut) => {
        const l = buildLedger(specs, CUSTOMERS);
        const whole = deriveReport(l.credit, l.payment, l.reversal, dayISO(0), dayISO(27));
        const left = deriveReport(l.credit, l.payment, l.reversal, dayISO(0), dayISO(cut));
        const right = deriveReport(l.credit, l.payment, l.reversal, dayISO(cut + 1), dayISO(27));
        expect(left.creditPaisa + right.creditPaisa).toBe(whole.creditPaisa);
        expect(left.paymentsPaisa + right.paymentsPaisa).toBe(whole.paymentsPaisa);
      }),
    );
  });
});

describe('customer list: search and sort', () => {
  const created = [
    rec('customerCreated', { name: 'Ahmed Ali', phone: '03001234567' }, 'c1', 1),
    rec('customerCreated', { name: 'Bilal Khan', phone: '03337654321' }, 'c2', 2),
    rec('customerCreated', { name: 'Sara Begum' }, 'c3', 3),
    rec('customerCreated', { name: 'فاطمہ نور' }, 'c4', 4),
  ];
  const customers = deriveCustomerList(created, []);
  const balances = new Map([
    ['c1', 500_000],
    ['c2', 1_200_000],
    ['c3', 0],
    ['c4', -300_000],
  ]);

  it('sorts by balance descending, advance (negative) last', () => {
    const names = filterCustomers(customers, balances, '').map((r) => r.customer.name);
    expect(names).toEqual(['Bilal Khan', 'Ahmed Ali', 'Sara Begum', 'فاطمہ نور']);
  });

  it('searches names case-insensitively and by partial text', () => {
    expect(filterCustomers(customers, balances, 'ALI').map((r) => r.customer.id)).toEqual(['c1']);
    expect(filterCustomers(customers, balances, 'khan').map((r) => r.customer.id)).toEqual(['c2']);
    expect(filterCustomers(customers, balances, 'نور').map((r) => r.customer.id)).toEqual(['c4']);
  });

  it('searches by phone, ignoring hyphens, spaces and Urdu digits', () => {
    expect(filterCustomers(customers, balances, '0300').map((r) => r.customer.id)).toEqual(['c1']);
    expect(filterCustomers(customers, balances, '0333-765').map((r) => r.customer.id)).toEqual(['c2']);
    expect(filterCustomers(customers, balances, '۰۳۰۰').map((r) => r.customer.id)).toEqual(['c1']);
  });

  it('returns nothing for text that matches no one', () => {
    expect(filterCustomers(customers, balances, 'zzz')).toEqual([]);
  });

  it('property: a search result is always a subset, in non-increasing balance order', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 6 }), (query) => {
        const rows = filterCustomers(customers, balances, query);
        expect(rows.length).toBeLessThanOrEqual(customers.length);
        for (let i = 1; i < rows.length; i++) {
          expect(rows[i - 1].balancePaisa).toBeGreaterThanOrEqual(rows[i].balancePaisa);
        }
        if (query.trim() === '') expect(rows).toHaveLength(customers.length);
      }),
    );
  });
});

describe('customer details and settings', () => {
  it('applies updates in time order, latest value of each field wins, and skips unchanged fields', () => {
    const created = [rec('customerCreated', { name: 'Ali', phone: '03001111111', note: 'n1' }, 'c1', 1)];
    const updates = [
      rec('customerUpdated', { customerId: 'c1', name: 'Ali Khan' }, 'u1', 5),
      rec('customerUpdated', { customerId: 'c1', phone: '03002222222' }, 'u2', 6),
      rec('customerUpdated', { customerId: 'c1', name: 'Ali K.' }, 'u3', 7),
    ];
    const [info] = deriveCustomerList(created, shuffle(updates, 42));
    expect(info).toMatchObject({ id: 'c1', name: 'Ali K.', phone: '03002222222', note: 'n1' });
  });

  it('settings: defaults, then latest value of each field wins in any arrival order', () => {
    expect(deriveSettings([])).toEqual({ shopName: 'My Shop', language: 'en' });

    const records = [
      rec('settingsUpdated', { shopName: 'First' }, 's1', 1),
      rec('settingsUpdated', { language: 'ur' }, 's2', 2),
      rec('settingsUpdated', { shopName: 'Second' }, 's3', 3),
    ];
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        expect(deriveSettings(shuffle(records, seed))).toEqual({ shopName: 'Second', language: 'ur' });
      }),
    );
  });
});
