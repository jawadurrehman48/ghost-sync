import { describe, it, expect } from 'vitest';
import {
  deriveAll,
  deriveBalance,
  deriveCustomerList,
  deriveDashboard,
  deriveReport,
} from '../apps/khata/src/khata.reducers';
import { rec } from './khata.helpers';
import type { KhataData } from '../apps/khata/src/khata.types';

const TODAY = '2026-03-10';

/**
 * Ahmed: credit Rs 5,000 (e1), payment Rs 1,000 (e2), credit Rs 2,000 today (e3, a typo, reversed).
 * Without the mistake his balance is Rs 4,000. Bilal: credit Rs 3,000 today (e4).
 */
const customerCreated = [
  rec('customerCreated', { name: 'Ahmed' }, 'ahmed', 1),
  rec('customerCreated', { name: 'Bilal' }, 'bilal', 2),
];
const credit = [
  rec('creditGiven', { customerId: 'ahmed', amountPaisa: 500000, date: '2026-03-01' }, 'e1', 10),
  rec('creditGiven', { customerId: 'ahmed', amountPaisa: 200000, date: TODAY, note: 'typo' }, 'e3', 12),
  rec('creditGiven', { customerId: 'bilal', amountPaisa: 300000, date: TODAY }, 'e4', 13),
];
const payment = [rec('paymentReceived', { customerId: 'ahmed', amountPaisa: 100000, date: '2026-03-05' }, 'e2', 11)];
const reversal = [rec('entryReversed', { entryId: 'e3', reason: 'Typed 2000 instead of 200' }, 'r1', 14)];

const withoutMistake = credit.filter((c) => c.id !== 'e3');

describe('Entry reversal (TR-9)', () => {
  it('excludes a reversed entry from the balance', () => {
    expect(deriveBalance(credit, payment, [], 'ahmed').balancePaisa).toBe(600000); // 5000 + 2000 − 1000
    expect(deriveBalance(credit, payment, reversal, 'ahmed').balancePaisa).toBe(400000); // 5000 − 1000
  });

  it('gives the same balance as if the entry had never been added', () => {
    const asIfNever = deriveBalance(withoutMistake, payment, [], 'ahmed');
    const reversed = deriveBalance(credit, payment, reversal, 'ahmed');
    expect(reversed.balancePaisa).toBe(asIfNever.balancePaisa);
  });

  it('keeps the reversed entry visible, marked reversed, with its reason', () => {
    const { entries } = deriveBalance(credit, payment, reversal, 'ahmed');
    expect(entries).toHaveLength(3);
    const mistake = entries.find((e) => e.id === 'e3');
    expect(mistake).toMatchObject({ reversed: true, reverseReason: 'Typed 2000 instead of 200', amountPaisa: 200000 });
    expect(entries.filter((e) => !e.reversed).map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('running balances skip the reversed entry', () => {
    const live = deriveBalance(credit, payment, reversal, 'ahmed').entries.filter((e) => !e.reversed);
    expect(live.map((e) => e.runningBalancePaisa)).toEqual([500000, 400000]);
  });

  it("excludes it from the dashboard's total outstanding and today's credit", () => {
    const customers = deriveCustomerList(customerCreated, []);
    const dashboard = deriveDashboard(customers, credit, payment, reversal, TODAY);
    expect(dashboard.totalOutstandingPaisa).toBe(400000 + 300000);
    expect(dashboard.creditTodayPaisa).toBe(300000); // Bilal's only; Ahmed's reversed Rs 2,000 is excluded
    expect(dashboard.topDebtors.map((d) => d.name)).toEqual(['Ahmed', 'Bilal']);
  });

  it('the dashboard counts the entry before the reversal and not after', () => {
    const customers = deriveCustomerList(customerCreated, []);
    expect(deriveDashboard(customers, credit, payment, [], TODAY).creditTodayPaisa).toBe(500000);
    expect(deriveDashboard(customers, credit, payment, reversal, TODAY).creditTodayPaisa).toBe(300000);
  });

  it('excludes it from report totals', () => {
    const report = deriveReport(credit, payment, reversal, '2026-03-01', '2026-03-31');
    expect(report).toEqual({ creditPaisa: 800000, paymentsPaisa: 100000, netPaisa: -700000 });
    expect(deriveReport(credit, payment, [], '2026-03-01', '2026-03-31').creditPaisa).toBe(1000000);
  });

  it("a reversal of one customer's entry never changes another customer's balance", () => {
    expect(deriveBalance(credit, payment, reversal, 'bilal').balancePaisa).toBe(300000);
  });

  it('two devices reversing the same entry still count it only once', () => {
    const twice = [...reversal, rec('entryReversed', { entryId: 'e3', reason: 'Also reversed on phone 2' }, 'r2', 15)];
    const state = deriveBalance(credit, payment, twice, 'ahmed');
    expect(state.balancePaisa).toBe(400000);
    expect(state.entries.filter((e) => e.reversed)).toHaveLength(1);
  });

  it('reversing a payment makes the customer owe that amount again', () => {
    const reversePayment = [rec('entryReversed', { entryId: 'e2', reason: 'Cheque bounced' }, 'r3', 16)];
    // credits 5000 + 2000 are live, the Rs 1,000 payment no longer counts
    expect(deriveBalance(credit, payment, reversePayment, 'ahmed').balancePaisa).toBe(700000);
  });

  it('deriveAll applies reversals everywhere at once', () => {
    const data: KhataData = {
      customerCreated,
      customerUpdated: [],
      creditGiven: credit,
      paymentReceived: payment,
      entryReversed: reversal,
      settingsUpdated: [],
    };
    const derived = deriveAll(data, TODAY);
    expect(derived.balances.get('ahmed')).toBe(400000);
    expect(derived.dashboard.totalOutstandingPaisa).toBe(700000);
  });
});
