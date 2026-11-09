import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import Dexie from 'dexie';
import { addDays, createDatabase, createStore, todayISO, validatePakistaniPhone } from '@skeleton/core';
import type { Store, TypedDexie } from '@skeleton/core';
import { deriveAll, deriveBalance, deriveSettings } from '../apps/khata/src/khata.reducers';
import { DEMO_CUSTOMERS, DEMO_SHOP_NAME, loadDemoData } from '../apps/khata/src/utils/demo';
import type { KhataCollections, KhataData } from '../apps/khata/src/khata.types';

const COLLECTIONS = {
  customerCreated: undefined,
  customerUpdated: undefined,
  creditGiven: undefined,
  paymentReceived: undefined,
  entryReversed: undefined,
  settingsUpdated: undefined,
};

async function snapshot(store: Store<KhataCollections>): Promise<KhataData> {
  return {
    customerCreated: await store.query('customerCreated'),
    customerUpdated: await store.query('customerUpdated'),
    creditGiven: await store.query('creditGiven'),
    paymentReceived: await store.query('paymentReceived'),
    entryReversed: await store.query('entryReversed'),
    settingsUpdated: await store.query('settingsUpdated'),
  };
}

const opened: Array<{ db: TypedDexie<KhataCollections>; name: string }> = [];
/** `track` = close and delete the database automatically after each test. */
function freshStore(track = true): { store: Store<KhataCollections>; db: TypedDexie<KhataCollections> } {
  const name = `khata-demo-test-${Date.now()}-${Math.random()}`;
  const db = createDatabase<KhataCollections>({ dbName: name, collections: COLLECTIONS });
  if (track) opened.push({ db, name });
  return { store: createStore(db, 'demo-test-device'), db };
}

afterEach(async () => {
  while (opened.length > 0) {
    const { db, name } = opened.pop()!;
    db.close();
    await Dexie.delete(name);
  }
});

describe('Demo data (TR-10)', () => {
  let data: KhataData;
  let store: Store<KhataCollections>;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const created = freshStore(false); // shared by every test below; cleaned up in afterAll
    store = created.store;
    expect(await loadDemoData(store)).toBe('loaded');
    data = await snapshot(store);
    cleanup = async () => {
      created.db.close();
      await Dexie.delete(created.db.name);
    };
  });

  afterAll(async () => {
    await cleanup();
  });

  it('adds 8 customers with common Pakistani names; every phone is a valid number, stored unformatted', () => {
    expect(data.customerCreated).toHaveLength(8);
    const names = data.customerCreated.map((c) => c.payload.name);
    expect(names).toEqual(expect.arrayContaining(['Muhammad Aslam', 'Rukhsana Bibi', 'Imran Hussain', 'Ayesha Siddiqui']));
    expect(new Set(names).size).toBe(8);
    for (const c of data.customerCreated) {
      if (c.payload.phone) {
        expect(validatePakistaniPhone(c.payload.phone)).toBe(true);
        expect(c.payload.phone).toMatch(/^03\d{9}$/);
      }
    }
    expect(data.customerCreated.some((c) => !c.payload.phone)).toBe(true); // one customer without a phone
  });

  it('every customer has a valid numeric balance (no NaN, always an integer)', () => {
    const derived = deriveAll(data, todayISO());
    for (const customer of derived.customers) {
      const balance = derived.balances.get(customer.id) ?? 0;
      expect(Number.isInteger(balance)).toBe(true);
      expect(deriveBalance(data.creditGiven, data.paymentReceived, data.entryReversed, customer.id).balancePaisa).toBe(
        balance,
      );
    }
  });

  it('uses realistic whole-rupee amounts, including familiar ones like Rs 1,250, Rs 3,480 and Rs 650', () => {
    const amounts = [...data.creditGiven, ...data.paymentReceived].map((t) => t.payload.amountPaisa);
    for (const a of amounts) {
      expect(Number.isInteger(a)).toBe(true);
      expect(a % 100).toBe(0);
      expect(a).toBeGreaterThan(0);
    }
    expect(amounts).toEqual(expect.arrayContaining([125000, 348000, 65000]));
  });

  it('spreads entries over the last 30 days, up to and including today', () => {
    const today = todayISO();
    const oldest = addDays(today, -29);
    const dates = [...data.creditGiven, ...data.paymentReceived].map((t) => t.payload.date);
    for (const d of dates) {
      expect(d >= oldest && d <= today).toBe(true);
    }
    expect(new Set(dates).size).toBeGreaterThan(15); // genuinely spread out
    expect(dates).toContain(today); // so the dashboard "today" figures are never empty
  });

  it('includes exactly one reversed entry, pointing at a real credit, with a reason', () => {
    expect(data.entryReversed).toHaveLength(1);
    const reversal = data.entryReversed[0];
    expect(reversal.payload.reason.trim()).not.toBe('');
    const target = data.creditGiven.find((c) => c.id === reversal.payload.entryId);
    expect(target?.payload.amountPaisa).toBe(300000);
  });

  it('produces the exact expected balances: owing, one fully settled, one advance', () => {
    const { customers, balances } = deriveAll(data, todayISO());
    const byName = Object.fromEntries(customers.map((c) => [c.name, balances.get(c.id)]));
    expect(byName).toEqual({
      'Muhammad Aslam': 288000,
      'Rukhsana Bibi': 204000,
      'Imran Hussain': 473000,
      'Ayesha Siddiqui': 0,
      'Zahid Mehmood': 250000, // Rs 3,000 typo reversed, Rs 300 re-entered
      'Naseem Akhtar': -50000,
      'Shabana Kausar': 118000,
      'Tariq Javed': 239000,
    });
    const values = Object.values(byName) as number[];
    expect(values.filter((b) => b === 0)).toHaveLength(1);
    expect(values.filter((b) => b < 0)).toHaveLength(1);
  });

  it("fills in the dashboard: outstanding total, owing count, today's figures and top 5 debtors", () => {
    const { dashboard } = deriveAll(data, todayISO());
    expect(dashboard.totalOutstandingPaisa).toBe(1_572_000);
    expect(dashboard.customersOwingCount).toBe(6);
    expect(dashboard.creditTodayPaisa).toBe(109000); // Rs 450 + Rs 640
    expect(dashboard.paymentsTodayPaisa).toBe(50000);
    expect(dashboard.topDebtors.map((d) => d.name)).toEqual([
      'Imran Hussain',
      'Muhammad Aslam',
      'Zahid Mehmood',
      'Tariq Javed',
      'Rukhsana Bibi',
    ]);
  });

  it('sets the shop name and records the demo marker', () => {
    const settings = deriveSettings(data.settingsUpdated);
    expect(settings.shopName).toBe(DEMO_SHOP_NAME);
    expect(settings.demoDataLoaded).toBe(true);
  });

  it('is written through the append-only store, so every record is pending sync', async () => {
    const pending = await store.getPending();
    const total =
      data.customerCreated.length +
      data.creditGiven.length +
      data.paymentReceived.length +
      data.entryReversed.length +
      data.settingsUpdated.length;
    expect(pending).toHaveLength(total);
  });
});

describe('Demo data can only be loaded once', () => {
  it('pressing it twice does not add duplicate customers or transactions', async () => {
    const { store } = freshStore();
    expect(await loadDemoData(store)).toBe('loaded');
    const after1 = await snapshot(store);

    expect(await loadDemoData(store)).toBe('alreadyLoaded');
    expect(await loadDemoData(store)).toBe('alreadyLoaded');
    const after3 = await snapshot(store);

    expect(after3.customerCreated).toHaveLength(DEMO_CUSTOMERS.length);
    for (const key of Object.keys(after1) as Array<keyof KhataData>) {
      expect(after3[key].map((r) => r.id)).toEqual(after1[key].map((r) => r.id));
    }
  });

  it('several overlapping calls (a rapid double tap) still add the data exactly once', async () => {
    const { store } = freshStore();
    const results = await Promise.all([loadDemoData(store), loadDemoData(store), loadDemoData(store)]);
    expect(results.every((r) => r === 'loaded')).toBe(true);
    const data = await snapshot(store);
    expect(data.customerCreated).toHaveLength(DEMO_CUSTOMERS.length);
    expect(data.entryReversed).toHaveLength(1);
    expect(data.settingsUpdated.filter((s) => s.payload.demoDataLoaded)).toHaveLength(1);
  });

  it('a second store (another device after sync) that already has the marker adds nothing', async () => {
    const { store } = freshStore();
    await store.add('settingsUpdated', { demoDataLoaded: true });
    expect(await loadDemoData(store)).toBe('alreadyLoaded');
    expect((await snapshot(store)).customerCreated).toHaveLength(0);
  });

  it('does not overwrite a shop name the owner already chose', async () => {
    const { store } = freshStore();
    await store.add('settingsUpdated', { shopName: 'Bismillah Kiryana' });
    await loadDemoData(store);
    expect(deriveSettings(await store.query('settingsUpdated')).shopName).toBe('Bismillah Kiryana');
  });

  it('can be loaded again after all data was cleared (the marker is cleared with it)', async () => {
    const { store, db } = freshStore();
    await loadDemoData(store);
    await Promise.all(db.tables.map((t) => t.clear()));
    expect(await loadDemoData(store)).toBe('loaded');
    expect((await snapshot(store)).customerCreated).toHaveLength(DEMO_CUSTOMERS.length);
  });
});
