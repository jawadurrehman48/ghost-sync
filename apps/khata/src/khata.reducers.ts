import { deriveState, todayISO, toAsciiDigits } from '@skeleton/core';
import type { SkeletonRecord } from '@skeleton/core';
import type {
  BalanceState,
  CustomerInfo,
  CustomerRow,
  DashboardState,
  KhataCollections,
  KhataData,
  KhataDerived,
  LedgerEntry,
  ReportTotals,
  Settings,
} from './khata.types';

type Rec<K extends keyof KhataCollections> = SkeletonRecord<KhataCollections[K]>;

export const DEFAULT_SHOP_NAME = 'My Shop';

/**
 * Total order for records: oldest first, ties broken by id. Sync can deliver
 * records in any order, so every derivation sorts with this comparator first,
 * which makes the output identical for any arrival order.
 */
function byCreatedAt(
  a: { createdAt: string; id: string },
  b: { createdAt: string; id: string },
): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

function applyUpdates(info: CustomerInfo, updates: Rec<'customerUpdated'>[]): void {
  for (const u of [...updates].sort(byCreatedAt)) {
    if (u.payload.name !== undefined) info.name = u.payload.name;
    if (u.payload.phone !== undefined) info.phone = u.payload.phone;
    if (u.payload.note !== undefined) info.note = u.payload.note;
  }
}

/**
 * All customers from customerCreated records, with customerUpdated records
 * applied in order (latest value of each field wins). Sorted oldest first.
 */
export function deriveCustomerList(
  createdRecords: Rec<'customerCreated'>[],
  updatedRecords: Rec<'customerUpdated'>[],
): CustomerInfo[] {
  const updatesByCustomer = new Map<string, Rec<'customerUpdated'>[]>();
  for (const u of updatedRecords) {
    const list = updatesByCustomer.get(u.payload.customerId) ?? [];
    list.push(u);
    updatesByCustomer.set(u.payload.customerId, list);
  }

  return [...createdRecords].sort(byCreatedAt).map((r) => {
    const info: CustomerInfo = {
      id: r.id,
      name: r.payload.name,
      phone: r.payload.phone,
      note: r.payload.note,
      createdAt: r.createdAt,
    };
    applyUpdates(info, updatesByCustomer.get(r.id) ?? []);
    return info;
  });
}

/** Current info for one customer, or null if no such customerCreated record. */
export function deriveCustomerInfo(
  createdRecords: Rec<'customerCreated'>[],
  updatedRecords: Rec<'customerUpdated'>[],
  customerId: string,
): CustomerInfo | null {
  const created = createdRecords.find((r) => r.id === customerId);
  if (!created) return null;
  const info: CustomerInfo = {
    id: created.id,
    name: created.payload.name,
    phone: created.payload.phone,
    note: created.payload.note,
    createdAt: created.createdAt,
  };
  applyUpdates(
    info,
    updatedRecords.filter((r) => r.payload.customerId === customerId),
  );
  return info;
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

/**
 * Balance and full ledger for one customer.
 *
 * Order-independent: the set of reversed entry ids is built first, then
 * entries are sorted with a total order and folded. An entry that has a
 * reversal record is shown (marked reversed) but never counted.
 * Positive balance = customer owes; negative = advance.
 */
export function deriveBalance(
  creditRecords: Rec<'creditGiven'>[],
  paymentRecords: Rec<'paymentReceived'>[],
  reversalRecords: Rec<'entryReversed'>[],
  customerId: string,
): BalanceState {
  const reversedEntryIds = new Set<string>();
  const reasons = new Map<string, string>();
  for (const r of [...reversalRecords].sort(byCreatedAt)) {
    reversedEntryIds.add(r.payload.entryId);
    reasons.set(r.payload.entryId, r.payload.reason);
  }

  type Row = { record: Rec<'creditGiven'> | Rec<'paymentReceived'>; type: 'credit' | 'payment' };
  const rows: Row[] = [
    ...creditRecords
      .filter((r) => r.payload.customerId === customerId)
      .map((record): Row => ({ record, type: 'credit' })),
    ...paymentRecords
      .filter((r) => r.payload.customerId === customerId)
      .map((record): Row => ({ record, type: 'payment' })),
  ].sort((a, b) => byCreatedAt(a.record, b.record));

  let balancePaisa = 0;
  const entries: LedgerEntry[] = [];

  for (const { record, type } of rows) {
    const reversed = reversedEntryIds.has(record.id);
    const amountPaisa = record.payload.amountPaisa;
    if (!reversed) balancePaisa += type === 'credit' ? amountPaisa : -amountPaisa;

    entries.push({
      id: record.id,
      type,
      amountPaisa,
      note: record.payload.note,
      date: record.payload.date,
      createdAt: record.createdAt,
      reversed,
      reverseReason: reversed ? reasons.get(record.id) : undefined,
      runningBalancePaisa: reversed ? 0 : balancePaisa,
    });
  }

  return { balancePaisa, reversedEntryIds, entries };
}

/**
 * Balance of every customer in one pass: customerId → paisa.
 * Always agrees with deriveBalance(...).balancePaisa for the same customer.
 */
export function deriveBalanceMap(
  creditRecords: Rec<'creditGiven'>[],
  paymentRecords: Rec<'paymentReceived'>[],
  reversalRecords: Rec<'entryReversed'>[],
): Map<string, number> {
  const reversed = new Set(reversalRecords.map((r) => r.payload.entryId));
  const map = new Map<string, number>();
  for (const r of creditRecords) {
    const amount = reversed.has(r.id) ? 0 : r.payload.amountPaisa;
    map.set(r.payload.customerId, (map.get(r.payload.customerId) ?? 0) + amount);
  }
  for (const r of paymentRecords) {
    const amount = reversed.has(r.id) ? 0 : r.payload.amountPaisa;
    map.set(r.payload.customerId, (map.get(r.payload.customerId) ?? 0) - amount);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Customer list (search + sort)
// ---------------------------------------------------------------------------

/**
 * Customers with balances, filtered by a case-insensitive search of name or
 * phone, sorted by balance descending (highest owed first), then by name.
 * Phone search ignores hyphens/spaces and accepts Urdu digits.
 */
export function filterCustomers(
  customers: CustomerInfo[],
  balances: Map<string, number>,
  query: string,
): CustomerRow[] {
  const q = query.trim().toLowerCase();
  const qDigits = toAsciiDigits(q).replace(/[-\s]/g, '');

  return customers
    .filter((c) => {
      if (q === '') return true;
      if (c.name.toLowerCase().includes(q)) return true;
      if (qDigits !== '' && c.phone) return toAsciiDigits(c.phone).replace(/[-\s]/g, '').includes(qDigits);
      return false;
    })
    .map((customer) => ({ customer, balancePaisa: balances.get(customer.id) ?? 0 }))
    .sort((a, b) => {
      if (a.balancePaisa !== b.balancePaisa) return b.balancePaisa - a.balancePaisa;
      const byName = a.customer.name.localeCompare(b.customer.name);
      return byName !== 0 ? byName : byCreatedAt(a.customer, b.customer);
    });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Latest shopName and language win; defaults are "My Shop" and "en". */
export function deriveSettings(settingsRecords: Rec<'settingsUpdated'>[]): Settings {
  const initial: Settings = { shopName: DEFAULT_SHOP_NAME, language: 'en' };
  return deriveState<KhataCollections['settingsUpdated'], Settings>(
    [...settingsRecords].sort(byCreatedAt),
    (state, r) => {
      const prev = state ?? initial;
      return {
        shopName: r.payload.shopName ?? prev.shopName,
        language: r.payload.language ?? prev.language,
      };
    },
    initial,
  );
}

// ---------------------------------------------------------------------------
// Dashboard and reports
// ---------------------------------------------------------------------------

/**
 * Dashboard figures. `today` is a local "YYYY-MM-DD" date.
 * totalOutstanding = sum of all positive customer balances, exactly.
 */
export function deriveDashboard(
  customers: CustomerInfo[],
  creditRecords: Rec<'creditGiven'>[],
  paymentRecords: Rec<'paymentReceived'>[],
  reversalRecords: Rec<'entryReversed'>[],
  today: string = todayISO(),
): DashboardState {
  const reversed = new Set(reversalRecords.map((r) => r.payload.entryId));

  let creditTodayPaisa = 0;
  for (const r of creditRecords) {
    if (!reversed.has(r.id) && r.payload.date === today) creditTodayPaisa += r.payload.amountPaisa;
  }
  let paymentsTodayPaisa = 0;
  for (const r of paymentRecords) {
    if (!reversed.has(r.id) && r.payload.date === today) paymentsTodayPaisa += r.payload.amountPaisa;
  }

  const balances = deriveBalanceMap(creditRecords, paymentRecords, reversalRecords);
  let totalOutstandingPaisa = 0;
  const debtors: { customerId: string; name: string; balancePaisa: number }[] = [];
  for (const c of customers) {
    const balancePaisa = balances.get(c.id) ?? 0;
    if (balancePaisa > 0) {
      totalOutstandingPaisa += balancePaisa;
      debtors.push({ customerId: c.id, name: c.name, balancePaisa });
    }
  }
  debtors.sort((a, b) => b.balancePaisa - a.balancePaisa || (a.customerId < b.customerId ? -1 : 1));

  return {
    totalOutstandingPaisa,
    creditTodayPaisa,
    paymentsTodayPaisa,
    topDebtors: debtors.slice(0, 5),
  };
}

/**
 * Totals of non-reversed credit and payments whose date is within
 * [from, to] inclusive (ISO dates compare correctly as strings).
 */
export function deriveReport(
  creditRecords: Rec<'creditGiven'>[],
  paymentRecords: Rec<'paymentReceived'>[],
  reversalRecords: Rec<'entryReversed'>[],
  from: string,
  to: string,
): ReportTotals {
  const reversed = new Set(reversalRecords.map((r) => r.payload.entryId));
  const inRange = (date: string) => date >= from && date <= to;

  let creditPaisa = 0;
  for (const r of creditRecords) {
    if (!reversed.has(r.id) && inRange(r.payload.date)) creditPaisa += r.payload.amountPaisa;
  }
  let paymentsPaisa = 0;
  for (const r of paymentRecords) {
    if (!reversed.has(r.id) && inRange(r.payload.date)) paymentsPaisa += r.payload.amountPaisa;
  }
  return { creditPaisa, paymentsPaisa, netPaisa: paymentsPaisa - creditPaisa };
}

// ---------------------------------------------------------------------------
// Everything at once
// ---------------------------------------------------------------------------

/** Derive everything the screens need from a snapshot of the store. */
export function deriveAll(data: KhataData, today: string = todayISO()): KhataDerived {
  const customers = deriveCustomerList(data.customerCreated, data.customerUpdated);
  return {
    customers,
    balances: deriveBalanceMap(data.creditGiven, data.paymentReceived, data.entryReversed),
    settings: deriveSettings(data.settingsUpdated),
    dashboard: deriveDashboard(customers, data.creditGiven, data.paymentReceived, data.entryReversed, today),
    today,
  };
}
