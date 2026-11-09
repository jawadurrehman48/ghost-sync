import { addDays, todayISO } from '@skeleton/core';
import type { Store } from '@skeleton/core';
import { DEFAULT_SHOP_NAME, deriveSettings } from '../khata.reducers';
import type { KhataCollections } from '../khata.types';

export type DemoResult = 'loaded' | 'alreadyLoaded';

type DemoCustomer = { name: string; phone?: string; note?: string };
type DemoEntry = {
  /** index into DEMO_CUSTOMERS */
  customer: number;
  daysAgo: number;
  type: 'credit' | 'payment';
  rupees: number;
  note?: string;
  /** If set, the entry is then reversed with this reason (a typing mistake). */
  reversedBecause?: string;
};

export const DEMO_SHOP_NAME = 'Al-Madina General Store';

/** Eight everyday kiryana customers. Phones are stored unformatted. */
export const DEMO_CUSTOMERS: DemoCustomer[] = [
  { name: 'Muhammad Aslam', phone: '03001234567', note: 'Monthly ration customer' },
  { name: 'Rukhsana Bibi', phone: '03331234567' },
  { name: 'Imran Hussain', phone: '03455678901', note: 'Pays at the start of the month' },
  { name: 'Ayesha Siddiqui', phone: '03008765432' },
  { name: 'Zahid Mehmood' },
  { name: 'Naseem Akhtar', phone: '03123456789' },
  { name: 'Shabana Kausar', phone: '03459988776' },
  { name: 'Tariq Javed', phone: '03017788991', note: 'Lives next to the mosque' },
];

/**
 * Entries over the last 30 days. Resulting balances (Rs):
 *   Muhammad Aslam 2,880 owes   | Rukhsana Bibi 2,040 owes | Imran Hussain 4,730 owes
 *   Ayesha Siddiqui 0 settled   | Zahid Mehmood 2,500 owes (Rs 3,000 typo reversed)
 *   Naseem Akhtar -500 advance  | Shabana Kausar 1,180 owes | Tariq Javed 2,390 owes
 */
export const DEMO_ENTRIES: DemoEntry[] = [
  // Muhammad Aslam
  { customer: 0, daysAgo: 27, type: 'credit', rupees: 3480, note: 'Monthly ration' },
  { customer: 0, daysAgo: 19, type: 'payment', rupees: 1500 },
  { customer: 0, daysAgo: 12, type: 'credit', rupees: 1250, note: 'Atta, chawal' },
  { customer: 0, daysAgo: 6, type: 'credit', rupees: 650, note: 'Cooking oil' },
  { customer: 0, daysAgo: 2, type: 'payment', rupees: 1000 },
  // Rukhsana Bibi
  { customer: 1, daysAgo: 25, type: 'credit', rupees: 2200, note: 'Ration' },
  { customer: 1, daysAgo: 14, type: 'credit', rupees: 890, note: 'Doodh, dahi' },
  { customer: 1, daysAgo: 8, type: 'payment', rupees: 1500 },
  { customer: 1, daysAgo: 0, type: 'credit', rupees: 450, note: 'Chai patti, cheeni' },
  // Imran Hussain
  { customer: 2, daysAgo: 22, type: 'credit', rupees: 5600, note: 'Wedding ration' },
  { customer: 2, daysAgo: 15, type: 'payment', rupees: 2000 },
  { customer: 2, daysAgo: 9, type: 'credit', rupees: 1350 },
  { customer: 2, daysAgo: 3, type: 'payment', rupees: 1000 },
  { customer: 2, daysAgo: 1, type: 'credit', rupees: 780, note: 'Biscuits, juice' },
  // Ayesha Siddiqui: fully settled
  { customer: 3, daysAgo: 21, type: 'credit', rupees: 1800 },
  { customer: 3, daysAgo: 13, type: 'credit', rupees: 725 },
  { customer: 3, daysAgo: 5, type: 'payment', rupees: 2525, note: 'Cleared the full account' },
  // Zahid Mehmood: one mistake, reversed
  { customer: 4, daysAgo: 18, type: 'credit', rupees: 950 },
  { customer: 4, daysAgo: 11, type: 'credit', rupees: 1250 },
  {
    customer: 4,
    daysAgo: 7,
    type: 'credit',
    rupees: 3000,
    note: 'Sugar and tea',
    reversedBecause: 'Typed Rs 3,000 instead of Rs 300',
  },
  { customer: 4, daysAgo: 7, type: 'credit', rupees: 300, note: 'Sugar and tea' },
  // Naseem Akhtar: paid in advance
  { customer: 5, daysAgo: 16, type: 'credit', rupees: 1100 },
  { customer: 5, daysAgo: 4, type: 'payment', rupees: 1600, note: 'Advance for next month' },
  // Shabana Kausar
  { customer: 6, daysAgo: 28, type: 'credit', rupees: 4120, note: 'Eid ration' },
  { customer: 6, daysAgo: 20, type: 'payment', rupees: 3000 },
  { customer: 6, daysAgo: 10, type: 'credit', rupees: 560 },
  { customer: 6, daysAgo: 0, type: 'payment', rupees: 500 },
  // Tariq Javed
  { customer: 7, daysAgo: 29, type: 'credit', rupees: 2750, note: 'Gharelu saman' },
  { customer: 7, daysAgo: 17, type: 'payment', rupees: 1000 },
  { customer: 7, daysAgo: 0, type: 'credit', rupees: 640, note: 'Dal, sabzi masala' },
];

async function insertDemoData(store: Store<KhataCollections>): Promise<DemoResult> {
  const settings = deriveSettings(await store.query('settingsUpdated'));
  if (settings.demoDataLoaded) return 'alreadyLoaded';

  // Write the marker FIRST: even if two taps race or something fails half way,
  // the sample data can never be added a second time.
  await store.add('settingsUpdated', {
    demoDataLoaded: true,
    // Do not overwrite a shop name the owner already chose.
    ...(settings.shopName === DEFAULT_SHOP_NAME ? { shopName: DEMO_SHOP_NAME } : {}),
  });

  const customerIds: string[] = [];
  for (const customer of DEMO_CUSTOMERS) {
    const created = await store.add('customerCreated', customer);
    customerIds.push(created.id);
  }

  // Insert oldest first so the order they were recorded matches their dates.
  const today = todayISO();
  const ordered = DEMO_ENTRIES.map((entry, index) => ({ entry, index })).sort(
    (a, b) => b.entry.daysAgo - a.entry.daysAgo || a.index - b.index,
  );

  for (const { entry } of ordered) {
    const payload = {
      customerId: customerIds[entry.customer],
      amountPaisa: entry.rupees * 100,
      date: addDays(today, -entry.daysAgo),
      ...(entry.note ? { note: entry.note } : {}),
    };
    const saved =
      entry.type === 'credit' ? await store.add('creditGiven', payload) : await store.add('paymentReceived', payload);
    if (entry.reversedBecause) {
      await store.add('entryReversed', { entryId: saved.id, reason: entry.reversedBecause });
    }
  }
  return 'loaded';
}

const inFlight = new WeakMap<object, Promise<DemoResult>>();

/**
 * Add the realistic sample shop to the store, at most once.
 *  - If the demo data is already there, nothing is added and 'alreadyLoaded' is returned.
 *  - Two overlapping calls share one run, so a double tap cannot duplicate customers.
 * Everything goes through store.add, the same path as real entries.
 */
export function loadDemoData(store: Store<KhataCollections>): Promise<DemoResult> {
  const running = inFlight.get(store);
  if (running) return running;
  const task = insertDemoData(store).finally(() => inFlight.delete(store));
  inFlight.set(store, task);
  return task;
}
