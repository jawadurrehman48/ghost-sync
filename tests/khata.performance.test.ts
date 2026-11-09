import { describe, it, expect } from 'vitest';
import { deriveAll, deriveBalance, filterCustomers } from '../apps/khata/src/khata.reducers';
import { rec, dayISO } from './khata.helpers';
import type { KhataData } from '../apps/khata/src/khata.types';

/**
 * NFR-2: the customer list and dashboard must render within 300 ms on a
 * low-end Android phone with up to 500 customers and 5,000 transactions.
 * Derivation is the only heavy work (everything is in memory), so it is timed
 * here with a generous 100 ms budget on the dev machine, leaving ~3x headroom
 * for a much slower phone.
 */
const CUSTOMERS = 500;
const TRANSACTIONS = 5000;

function bigData(): KhataData {
  const customerCreated = Array.from({ length: CUSTOMERS }, (_, i) =>
    rec('customerCreated', { name: `Customer ${i}`, phone: `03${String(100000000 + i)}` }, `c${i}`, i),
  );
  const creditGiven = [];
  const paymentReceived = [];
  const entryReversed = [];
  for (let i = 0; i < TRANSACTIONS; i++) {
    const payload = {
      customerId: `c${(i * 7) % CUSTOMERS}`,
      amountPaisa: 10_000 + ((i * 37) % 500_000),
      date: dayISO(i),
    };
    if (i % 3 === 0) paymentReceived.push(rec('paymentReceived', payload, `p${i}`, 1000 + i));
    else creditGiven.push(rec('creditGiven', payload, `g${i}`, 1000 + i));
    if (i % 50 === 0) entryReversed.push(rec('entryReversed', { entryId: `g${i + 1}`, reason: 'x' }, `r${i}`, 9000 + i));
  }
  return { customerCreated, customerUpdated: [], creditGiven, paymentReceived, entryReversed, settingsUpdated: [] };
}

function timeIt<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
}

describe('Performance at 500 customers and 5,000 transactions (NFR-2)', () => {
  const data = bigData();

  it('derives the whole app state (list, balances, dashboard, settings) within budget', () => {
    deriveAll(data); // warm up the JIT
    const { result, ms } = timeIt(() => deriveAll(data));
    expect(result.customers).toHaveLength(CUSTOMERS);
    expect(result.dashboard.topDebtors).toHaveLength(5);
    expect(ms).toBeLessThan(100);
  });

  it('searches and sorts the customer list within budget', () => {
    const derived = deriveAll(data);
    const { result, ms } = timeIt(() => filterCustomers(derived.customers, derived.balances, 'customer 4'));
    expect(result.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(50);
  });

  it("builds one customer's full ledger within budget", () => {
    const { result, ms } = timeIt(() => deriveBalance(data.creditGiven, data.paymentReceived, data.entryReversed, 'c7'));
    expect(result.entries.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(50);
  });
});
