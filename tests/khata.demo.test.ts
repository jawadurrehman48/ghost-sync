import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Dexie from 'dexie';
import { createDatabase, createStore, todayISO, validatePakistaniPhone } from '@skeleton/core';
import type { Store } from '@skeleton/core';
import { deriveAll, deriveBalance } from '../apps/khata/src/khata.reducers';
import { loadDemoData } from '../apps/khata/src/utils/demo';
import type { KhataCollections, KhataData } from '../apps/khata/src/khata.types';

const DB_NAME = `khata-demo-test-${Date.now()}`;

let db: ReturnType<typeof createDatabase<KhataCollections>>;
let store: Store<KhataCollections>;
let data: KhataData;

async function snapshot(): Promise<KhataData> {
  return {
    customerCreated: await store.query('customerCreated'),
    customerUpdated: await store.query('customerUpdated'),
    creditGiven: await store.query('creditGiven'),
    paymentReceived: await store.query('paymentReceived'),
    entryReversed: await store.query('entryReversed'),
    settingsUpdated: await store.query('settingsUpdated'),
  };
}

describe('Demo data (TR-10)', () => {
  beforeAll(async () => {
    db = createDatabase<KhataCollections>({
      dbName: DB_NAME,
      collections: {
        customerCreated: undefined,
        customerUpdated: undefined,
        creditGiven: undefined,
        paymentReceived: undefined,
        entryReversed: undefined,
        settingsUpdated: undefined,
      },
    });
    store = createStore(db, 'demo-test-device');
    await loadDemoData(store);
    data = await snapshot();
  });

  afterAll(async () => {
    db.close();
    await Dexie.delete(DB_NAME);
  });

  it('adds at least 5 customers with names, and any phone numbers are valid Pakistani numbers', () => {
    expect(data.customerCreated.length).toBeGreaterThanOrEqual(5);
    for (const c of data.customerCreated) {
      expect(c.payload.name.trim()).not.toBe('');
      if (c.payload.phone) expect(validatePakistaniPhone(c.payload.phone)).toBe(true);
    }
  });

  it('every customer has a valid numeric balance (no NaN, always an integer)', () => {
    const derived = deriveAll(data, todayISO());
    for (const customer of derived.customers) {
      const balance = derived.balances.get(customer.id) ?? 0;
      expect(Number.isNaN(balance)).toBe(false);
      expect(Number.isInteger(balance)).toBe(true);
      expect(deriveBalance(data.creditGiven, data.paymentReceived, data.entryReversed, customer.id).balancePaisa).toBe(
        balance,
      );
    }
  });

  it('every transaction has a positive whole-paisa amount, a valid date and a known customer', () => {
    const ids = new Set(data.customerCreated.map((c) => c.id));
    for (const t of [...data.creditGiven, ...data.paymentReceived]) {
      expect(Number.isInteger(t.payload.amountPaisa)).toBe(true);
      expect(t.payload.amountPaisa).toBeGreaterThan(0);
      expect(t.payload.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ids.has(t.payload.customerId)).toBe(true);
    }
  });

  it('has multiple transactions for most customers', () => {
    const perCustomer = new Map<string, number>();
    for (const t of [...data.creditGiven, ...data.paymentReceived]) {
      perCustomer.set(t.payload.customerId, (perCustomer.get(t.payload.customerId) ?? 0) + 1);
    }
    const withMultiple = [...perCustomer.values()].filter((n) => n >= 2).length;
    expect(withMultiple).toBeGreaterThanOrEqual(5);
  });

  it('includes at least one reversed entry that points at a real transaction', () => {
    expect(data.entryReversed.length).toBeGreaterThanOrEqual(1);
    const transactionIds = new Set([...data.creditGiven, ...data.paymentReceived].map((t) => t.id));
    for (const r of data.entryReversed) {
      expect(transactionIds.has(r.payload.entryId)).toBe(true);
      expect(r.payload.reason.trim()).not.toBe('');
    }
  });

  it('has varied balances: someone owing, someone settled, someone in advance', () => {
    const { customers, balances } = deriveAll(data, todayISO());
    const values = customers.map((c) => balances.get(c.id) ?? 0);
    expect(values.some((b) => b > 0)).toBe(true);
    expect(values.some((b) => b === 0)).toBe(true);
    expect(values.some((b) => b < 0)).toBe(true);
  });

  it('produces the exact expected balances', () => {
    const { customers, balances } = deriveAll(data, todayISO());
    const byName = Object.fromEntries(customers.map((c) => [c.name, balances.get(c.id)]));
    expect(byName).toEqual({
      'Ahmed Ali': 800000,
      'Bilal Khan': 400000,
      'Sara Begum': 0,
      'Fatima Noor': -200000,
      'Tariq Mehmood': 150000,
    });
  });

  it("fills in the dashboard: outstanding total, today's figures and top debtors", () => {
    const { dashboard } = deriveAll(data, todayISO());
    expect(dashboard.totalOutstandingPaisa).toBe(800000 + 400000 + 150000);
    expect(dashboard.creditTodayPaisa).toBeGreaterThan(0);
    expect(dashboard.paymentsTodayPaisa).toBeGreaterThan(0);
    expect(dashboard.topDebtors.map((d) => d.name)).toEqual(['Ahmed Ali', 'Bilal Khan', 'Tariq Mehmood']);
  });

  it('sets a shop name', () => {
    expect(data.settingsUpdated.some((s) => s.payload.shopName)).toBe(true);
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
