import { addDays, daysBetween, deriveState, isValidISODate, toAsciiDigits, todayISO } from '@skeleton/core';
import type { SkeletonRecord } from '@skeleton/core';
import type {
  BalanceState,
  ChartBucket,
  CustomerBreakdownRow,
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
type EntryRecord = Rec<'creditGiven'> | Rec<'paymentReceived'>;

export const DEFAULT_SHOP_NAME = 'My Shop';

// ---------------------------------------------------------------------------
// Safety helpers: bad data must never crash the app or change a balance wrongly
// ---------------------------------------------------------------------------

/** A real money amount: a positive whole number of paisa that adds up exactly. */
export function isValidAmount(amountPaisa: unknown): amountPaisa is number {
  return typeof amountPaisa === 'number' && Number.isSafeInteger(amountPaisa) && amountPaisa > 0;
}

/** Drops records whose amount is corrupt (NaN, negative, fractional, huge). They count as nothing. */
function usable<T extends { payload: { amountPaisa: number } }>(records: T[]): T[] {
  return records.filter((r) => isValidAmount(r.payload.amountPaisa));
}

/**
 * ids of reversed entries. Reversals are final: a record that tries to reverse
 * a reversal (or anything that is not an entry) simply has no effect, because
 * only credit and payment entries are ever looked up in this set.
 */
function reversedIdSet(reversals: Rec<'entryReversed'>[]): Set<string> {
  const ids = new Set<string>();
  for (const r of reversals) {
    if (typeof r.payload.entryId === 'string') ids.add(r.payload.entryId);
  }
  return ids;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Total order for records: oldest first, ties broken by id. Sync can deliver
 * records in any order, so every derivation sorts with a total order first,
 * which makes the output identical for any arrival order.
 */
function byCreatedAt(a: { createdAt: string; id: string }, b: { createdAt: string; id: string }): number {
  return compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id);
}

/** Ledger order: by the date written on the entry, then by when it was recorded. */
function byEntryOrder(a: EntryRecord, b: EntryRecord): number {
  return compareText(String(a.payload.date ?? ''), String(b.payload.date ?? '')) || byCreatedAt(a, b);
}

/** Live (not reversed), valid-amount entries whose date is a real date inside [from, to]. */
function liveInRange<T extends EntryRecord>(records: T[], reversed: Set<string>, from: string, to: string): T[] {
  return usable(records).filter(
    (r) =>
      !reversed.has(r.id) && isValidISODate(r.payload.date) && r.payload.date >= from && r.payload.date <= to,
  );
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
  const reversedEntryIds = reversedIdSet(reversalRecords);
  const reasons = new Map<string, string>();
  for (const r of [...reversalRecords].sort(byCreatedAt)) {
    if (typeof r.payload.entryId === 'string') reasons.set(r.payload.entryId, r.payload.reason);
  }

  type Row = { record: EntryRecord; type: 'credit' | 'payment' };
  const rows: Row[] = [
    ...usable(creditRecords)
      .filter((r) => r.payload.customerId === customerId)
      .map((record): Row => ({ record, type: 'credit' })),
    ...usable(paymentRecords)
      .filter((r) => r.payload.customerId === customerId)
      .map((record): Row => ({ record, type: 'payment' })),
  ].sort((a, b) => byEntryOrder(a.record, b.record));

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
 * Balance of every customer in one pass: customerId to paisa.
 * Always agrees with deriveBalance(...).balancePaisa for the same customer.
 */
export function deriveBalanceMap(
  creditRecords: Rec<'creditGiven'>[],
  paymentRecords: Rec<'paymentReceived'>[],
  reversalRecords: Rec<'entryReversed'>[],
): Map<string, number> {
  const reversed = reversedIdSet(reversalRecords);
  const map = new Map<string, number>();
  for (const r of usable(creditRecords)) {
    const amount = reversed.has(r.id) ? 0 : r.payload.amountPaisa;
    map.set(r.payload.customerId, (map.get(r.payload.customerId) ?? 0) + amount);
  }
  for (const r of usable(paymentRecords)) {
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

/** Latest shopName and language win; defaults are "My Shop" and "en". Once the demo marker is written it stays true. */
export function deriveSettings(settingsRecords: Rec<'settingsUpdated'>[]): Settings {
  const initial: Settings = { shopName: DEFAULT_SHOP_NAME, language: 'en', demoDataLoaded: false };
  return deriveState<KhataCollections['settingsUpdated'], Settings>(
    [...settingsRecords].sort(byCreatedAt),
    (state, r) => {
      const prev = state ?? initial;
      return {
        shopName: r.payload.shopName ?? prev.shopName,
        language: r.payload.language ?? prev.language,
        demoDataLoaded: prev.demoDataLoaded || r.payload.demoDataLoaded === true,
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
  /** Pass the balances if you already have them, to avoid computing them twice. */
  balances: Map<string, number> = deriveBalanceMap(creditRecords, paymentRecords, reversalRecords),
): DashboardState {
  const reversed = reversedIdSet(reversalRecords);

  let creditTodayPaisa = 0;
  for (const r of usable(creditRecords)) {
    if (!reversed.has(r.id) && r.payload.date === today) creditTodayPaisa += r.payload.amountPaisa;
  }
  let paymentsTodayPaisa = 0;
  for (const r of usable(paymentRecords)) {
    if (!reversed.has(r.id) && r.payload.date === today) paymentsTodayPaisa += r.payload.amountPaisa;
  }

  let totalOutstandingPaisa = 0;
  const debtors: { customerId: string; name: string; balancePaisa: number }[] = [];
  for (const c of customers) {
    const balancePaisa = balances.get(c.id) ?? 0;
    if (balancePaisa > 0) {
      totalOutstandingPaisa += balancePaisa;
      debtors.push({ customerId: c.id, name: c.name, balancePaisa });
    }
  }
  debtors.sort((a, b) => b.balancePaisa - a.balancePaisa || compareText(a.customerId, b.customerId));

  return {
    totalOutstandingPaisa,
    customersOwingCount: debtors.length,
    creditTodayPaisa,
    paymentsTodayPaisa,
    topDebtors: debtors.slice(0, 5),
  };
}

/**
 * Totals of live credit and payments whose date is within [from, to]
 * inclusive. Corrupt amounts, reversed entries and impossible dates are ignored.
 */
export function deriveReport(
  creditRecords: Rec<'creditGiven'>[],
  paymentRecords: Rec<'paymentReceived'>[],
  reversalRecords: Rec<'entryReversed'>[],
  from: string,
  to: string,
): ReportTotals {
  const reversed = reversedIdSet(reversalRecords);

  let creditPaisa = 0;
  for (const r of liveInRange(creditRecords, reversed, from, to)) creditPaisa += r.payload.amountPaisa;
  let paymentsPaisa = 0;
  for (const r of liveInRange(paymentRecords, reversed, from, to)) paymentsPaisa += r.payload.amountPaisa;

  return { creditPaisa, paymentsPaisa, netPaisa: paymentsPaisa - creditPaisa };
}

/**
 * Per-day totals for the report chart. The range is split into at most
 * `maxBuckets` equal runs of days (one day each for up to a month, then
 * progressively wider), so the chart stays readable for any range. The
 * buckets are contiguous, cover the whole range, and add up to deriveReport.
 */
export function deriveDailyTotals(
  creditRecords: Rec<'creditGiven'>[],
  paymentRecords: Rec<'paymentReceived'>[],
  reversalRecords: Rec<'entryReversed'>[],
  from: string,
  to: string,
  maxBuckets = 31,
): ChartBucket[] {
  if (!isValidISODate(from) || !isValidISODate(to) || from > to) return [];

  const reversed = reversedIdSet(reversalRecords);
  const totalDays = daysBetween(from, to) + 1;
  const size = Math.ceil(totalDays / maxBuckets);
  const count = Math.ceil(totalDays / size);

  const buckets: ChartBucket[] = Array.from({ length: count }, (_, i) => ({
    from: addDays(from, i * size),
    to: addDays(from, Math.min(totalDays - 1, (i + 1) * size - 1)),
    creditPaisa: 0,
    paymentsPaisa: 0,
  }));

  for (const r of liveInRange(creditRecords, reversed, from, to)) {
    buckets[Math.floor(daysBetween(from, r.payload.date) / size)].creditPaisa += r.payload.amountPaisa;
  }
  for (const r of liveInRange(paymentRecords, reversed, from, to)) {
    buckets[Math.floor(daysBetween(from, r.payload.date) / size)].paymentsPaisa += r.payload.amountPaisa;
  }
  return buckets;
}

/**
 * Each customer's credit and payments inside [from, to], biggest credit first.
 * Only customers with activity appear. Entries whose customer is not known
 * (not yet synced) are grouped under their own row labelled `unknownLabel`,
 * so the rows always add up to the report totals.
 */
export function deriveCustomerBreakdown(
  creditRecords: Rec<'creditGiven'>[],
  paymentRecords: Rec<'paymentReceived'>[],
  reversalRecords: Rec<'entryReversed'>[],
  customers: CustomerInfo[],
  from: string,
  to: string,
  unknownLabel: string,
): CustomerBreakdownRow[] {
  const reversed = reversedIdSet(reversalRecords);
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const rows = new Map<string, CustomerBreakdownRow>();

  const rowFor = (customerId: string): CustomerBreakdownRow => {
    let row = rows.get(customerId);
    if (!row) {
      row = { customerId, name: names.get(customerId) ?? unknownLabel, creditPaisa: 0, paymentsPaisa: 0 };
      rows.set(customerId, row);
    }
    return row;
  };

  for (const r of liveInRange(creditRecords, reversed, from, to)) rowFor(r.payload.customerId).creditPaisa += r.payload.amountPaisa;
  for (const r of liveInRange(paymentRecords, reversed, from, to)) rowFor(r.payload.customerId).paymentsPaisa += r.payload.amountPaisa;

  return [...rows.values()].sort(
    (a, b) =>
      b.creditPaisa - a.creditPaisa ||
      b.paymentsPaisa - a.paymentsPaisa ||
      a.name.localeCompare(b.name) ||
      compareText(a.customerId, b.customerId),
  );
}

// ---------------------------------------------------------------------------
// Everything at once
// ---------------------------------------------------------------------------

/** Derive everything the screens need from a snapshot of the store. */
export function deriveAll(data: KhataData, today: string = todayISO()): KhataDerived {
  const customers = deriveCustomerList(data.customerCreated, data.customerUpdated);
  const balances = deriveBalanceMap(data.creditGiven, data.paymentReceived, data.entryReversed);
  return {
    customers,
    balances,
    settings: deriveSettings(data.settingsUpdated),
    dashboard: deriveDashboard(
      customers,
      data.creditGiven,
      data.paymentReceived,
      data.entryReversed,
      today,
      balances,
    ),
    today,
  };
}
