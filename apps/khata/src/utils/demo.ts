import { toISODate } from '@skeleton/core';
import type { Store } from '@skeleton/core';
import type { KhataCollections } from '../khata.types';

/** Local calendar date (YYYY-MM-DD) N days before today. */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

/**
 * Load realistic sample data into the store for demonstrations.
 *
 * Inserts 5 customers with Pakistani names, multiple transactions per
 * customer spread over the last 30 days, one reversed entry, and varied
 * balances (owing, settled, advance). Also sets a shop name.
 *
 * All inserts go through `store.add` — same code path as real entries,
 * so sync, derivation, and balance calculation are exercised.
 *
 * Resulting balances:
 *   Ahmed Ali      — Rs 8,000  (owes, large)
 *   Bilal Khan     — Rs 4,000  (owes, medium)
 *   Tariq Mehmood  — Rs 1,500  (owes, small, has a reversal)
 *   Sara Begum     — Rs 0      (settled)
 *   Fatima Noor    — Rs -2,000 (advance payment)
 */
export async function loadDemoData(store: Store<KhataCollections>): Promise<void> {
  // --- Settings ---
  await store.add('settingsUpdated', { shopName: 'Ahmed General Store' });

  // --- Customer 1: Ahmed Ali — owes Rs 8,000 ---
  const ahmed = await store.add('customerCreated', {
    name: 'Ahmed Ali',
    phone: '03001234567',
    note: 'Regular customer',
  });
  await store.add('creditGiven', { customerId: ahmed.id, amountPaisa: 500000, date: daysAgo(20), note: 'Monthly ration' });
  await store.add('creditGiven', { customerId: ahmed.id, amountPaisa: 300000, date: daysAgo(10) });
  await store.add('paymentReceived', { customerId: ahmed.id, amountPaisa: 200000, date: daysAgo(5) });
  await store.add('creditGiven', { customerId: ahmed.id, amountPaisa: 200000, date: daysAgo(0), note: 'Today ration' });

  // --- Customer 2: Bilal Khan — owes Rs 4,000 ---
  const bilal = await store.add('customerCreated', {
    name: 'Bilal Khan',
    phone: '03007654321',
  });
  await store.add('creditGiven', { customerId: bilal.id, amountPaisa: 400000, date: daysAgo(15) });
  await store.add('paymentReceived', { customerId: bilal.id, amountPaisa: 100000, date: daysAgo(8) });
  await store.add('creditGiven', { customerId: bilal.id, amountPaisa: 200000, date: daysAgo(3) });
  await store.add('paymentReceived', { customerId: bilal.id, amountPaisa: 100000, date: daysAgo(0) });

  // --- Customer 3: Sara Begum — settled (Rs 0) ---
  const sara = await store.add('customerCreated', {
    name: 'Sara Begum',
  });
  await store.add('creditGiven', { customerId: sara.id, amountPaisa: 200000, date: daysAgo(12) });
  await store.add('paymentReceived', { customerId: sara.id, amountPaisa: 200000, date: daysAgo(6), note: 'Full payment' });

  // --- Customer 4: Fatima Noor — advance (Rs -2,000) ---
  const fatima = await store.add('customerCreated', {
    name: 'Fatima Noor',
    phone: '03331234567',
  });
  await store.add('creditGiven', { customerId: fatima.id, amountPaisa: 100000, date: daysAgo(18) });
  await store.add('paymentReceived', { customerId: fatima.id, amountPaisa: 300000, date: daysAgo(4), note: 'Advance payment' });

  // --- Customer 5: Tariq Mehmood — owes Rs 1,500 (has a reversal) ---
  const tariq = await store.add('customerCreated', {
    name: 'Tariq Mehmood',
  });
  await store.add('creditGiven', { customerId: tariq.id, amountPaisa: 200000, date: daysAgo(14) });
  const wrongCredit = await store.add('creditGiven', {
    customerId: tariq.id,
    amountPaisa: 100000,
    date: daysAgo(7),
    note: 'Wrong amount',
  });
  await store.add('entryReversed', { entryId: wrongCredit.id, reason: 'Wrong amount entered' });
  await store.add('paymentReceived', { customerId: tariq.id, amountPaisa: 50000, date: daysAgo(2) });
}
