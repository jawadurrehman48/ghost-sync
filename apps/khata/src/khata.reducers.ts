import { deriveState } from '@skeleton/core';
import type { SkeletonRecord } from '@skeleton/core';
import type {
  KhataCollections,
  CustomerInfo,
  BalanceState,
  LedgerEntry,
  Settings,
  DashboardState,
} from './khata.types';

// ---------------------------------------------------------------------------
// 1. deriveCustomerList
// ---------------------------------------------------------------------------

/**
 * Derive the full customer list from customerCreated + customerUpdated records.
 * Updates are applied in createdAt order (latest wins for each field).
 * Result is sorted by createdAt ascending (oldest customer first).
 */
export function deriveCustomerList(
  createdRecords: SkeletonRecord<KhataCollections['customerCreated']>[],
  updatedRecords: SkeletonRecord<KhataCollections['customerUpdated']>[],
): CustomerInfo[] {
  // Build initial map from customerCreated records
  const customers = new Map<string, CustomerInfo>();

  for (const r of createdRecords) {
    customers.set(r.id, {
      id: r.id,
      name: r.payload.name,
      phone: r.payload.phone,
      note: r.payload.note,
      createdAt: r.createdAt,
    });
  }

  // Apply updates in createdAt order (latest wins)
  const sortedUpdates = [...updatedRecords].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  for (const r of sortedUpdates) {
    const customer = customers.get(r.payload.customerId);
    if (customer) {
      if (r.payload.name !== undefined) customer.name = r.payload.name;
      if (r.payload.phone !== undefined) customer.phone = r.payload.phone;
      if (r.payload.note !== undefined) customer.note = r.payload.note;
    }
  }

  return Array.from(customers.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

// ---------------------------------------------------------------------------
// 2. deriveCustomerInfo
// ---------------------------------------------------------------------------

/**
 * Derive the current info for a single customer.
 * Starts from the customerCreated record, then applies customerUpdated
 * records in createdAt order (latest wins for each field).
 * Returns null if no customerCreated record exists for the given id.
 */
export function deriveCustomerInfo(
  createdRecords: SkeletonRecord<KhataCollections['customerCreated']>[],
  updatedRecords: SkeletonRecord<KhataCollections['customerUpdated']>[],
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

  // Apply updates for this customer in chronological order
  const updates = updatedRecords
    .filter((r) => r.payload.customerId === customerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const r of updates) {
    if (r.payload.name !== undefined) info.name = r.payload.name;
    if (r.payload.phone !== undefined) info.phone = r.payload.phone;
    if (r.payload.note !== undefined) info.note = r.payload.note;
  }

  return info;
}

// ---------------------------------------------------------------------------
// 3. deriveBalance
// ---------------------------------------------------------------------------

/**
 * Derive the balance and transaction history for a single customer.
 *
 * Order-independent: first builds the set of reversed entry ids from
 * entryReversed records, then processes credit/payment records in
 * createdAt order. An entry is excluded from the balance if its id
 * appears in the reversed set, regardless of arrival order.
 *
 * @param creditRecords   - All creditGiven records (for all customers)
 * @param paymentRecords  - All paymentReceived records (for all customers)
 * @param reversalRecords - All entryReversed records (for all customers)
 * @param customerId      - The customer to compute balance for
 */
export function deriveBalance(
  creditRecords: SkeletonRecord<KhataCollections['creditGiven']>[],
  paymentRecords: SkeletonRecord<KhataCollections['paymentReceived']>[],
  reversalRecords: SkeletonRecord<KhataCollections['entryReversed']>[],
  customerId: string,
): BalanceState {
  // --- First pass: collect all reversed entry ids ---
  const reversedEntryIds = new Set<string>();
  const reverseReasons = new Map<string, string>();

  for (const r of reversalRecords) {
    reversedEntryIds.add(r.payload.entryId);
    reverseReasons.set(r.payload.entryId, r.payload.reason);
  }

  // --- Combine credit + payment records for this customer, sorted by createdAt ---
  type CombinedEntry = {
    record: SkeletonRecord<KhataCollections['creditGiven']> | SkeletonRecord<KhataCollections['paymentReceived']>;
    type: 'credit' | 'payment';
  };

  const allEntries: CombinedEntry[] = [
    ...creditRecords
      .filter((r) => r.payload.customerId === customerId)
      .map((r) => ({ record: r as CombinedEntry['record'], type: 'credit' as const })),
    ...paymentRecords
      .filter((r) => r.payload.customerId === customerId)
      .map((r) => ({ record: r as CombinedEntry['record'], type: 'payment' as const })),
  ];

  allEntries.sort((a, b) => a.record.createdAt.localeCompare(b.record.createdAt));

  // --- Second pass: compute balance and build entry list ---
  let balancePaisa = 0;
  const entries: LedgerEntry[] = [];

  for (const { record, type } of allEntries) {
    const reversed = reversedEntryIds.has(record.id);
    const amountPaisa = record.payload.amountPaisa;

    if (!reversed) {
      if (type === 'credit') {
        balancePaisa += amountPaisa;
      } else {
        balancePaisa -= amountPaisa;
      }
    }

    entries.push({
      id: record.id,
      type,
      amountPaisa,
      note: record.payload.note,
      date: record.payload.date,
      createdAt: record.createdAt,
      reversed,
      reverseReason: reversed ? reverseReasons.get(record.id) : undefined,
      runningBalancePaisa: reversed ? 0 : balancePaisa,
    });
  }

  return {
    balancePaisa,
    reversedEntryIds,
    entries,
  };
}

// ---------------------------------------------------------------------------
// 4. deriveSettings
// ---------------------------------------------------------------------------

/**
 * Derive the current settings from settingsUpdated records.
 * Uses deriveState from @skeleton/core for the fold.
 * Latest non-undefined field values win.
 * Defaults: shopName = 'My Shop', language = 'en'.
 */
export function deriveSettings(
  settingsRecords: SkeletonRecord<KhataCollections['settingsUpdated']>[],
): Settings {
  const sorted = [...settingsRecords].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  return deriveState(
    sorted,
    (state, r) => ({
      shopName: r.payload.shopName !== undefined ? r.payload.shopName : state.shopName,
      language: r.payload.language !== undefined ? r.payload.language : state.language,
    }),
    { shopName: 'My Shop', language: 'en' as 'en' | 'ur' },
  );
}

// ---------------------------------------------------------------------------
// 5. deriveDashboard (bonus — needed by dashboard screen)
// ---------------------------------------------------------------------------

/**
 * Derive dashboard state from all customer records and transaction records.
 * Requires the customer list (derived) and per-customer balances.
 */
export function deriveDashboard(
  customers: CustomerInfo[],
  creditRecords: SkeletonRecord<KhataCollections['creditGiven']>[],
  paymentRecords: SkeletonRecord<KhataCollections['paymentReceived']>[],
  reversalRecords: SkeletonRecord<KhataCollections['entryReversed']>[],
): DashboardState {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let totalOutstandingPaisa = 0;
  let creditTodayPaisa = 0;
  let paymentsTodayPaisa = 0;
  const debtorList: { customerId: string; name: string; balancePaisa: number }[] = [];

  // Compute today's totals from non-reversed entries
  const reversedIds = new Set(reversalRecords.map((r) => r.payload.entryId));

  for (const r of creditRecords) {
    if (!reversedIds.has(r.id) && r.payload.date === today) {
      creditTodayPaisa += r.payload.amountPaisa;
    }
  }

  for (const r of paymentRecords) {
    if (!reversedIds.has(r.id) && r.payload.date === today) {
      paymentsTodayPaisa += r.payload.amountPaisa;
    }
  }

  // Compute per-customer balances for outstanding and top debtors
  for (const customer of customers) {
    const balance = deriveBalance(creditRecords, paymentRecords, reversalRecords, customer.id);

    if (balance.balancePaisa > 0) {
      totalOutstandingPaisa += balance.balancePaisa;
      debtorList.push({
        customerId: customer.id,
        name: customer.name,
        balancePaisa: balance.balancePaisa,
      });
    }
  }

  // Sort debtors by balance descending, take top 5
  debtorList.sort((a, b) => b.balancePaisa - a.balancePaisa);
  const topDebtors = debtorList.slice(0, 5);

  return {
    totalOutstandingPaisa,
    creditTodayPaisa,
    paymentsTodayPaisa,
    topDebtors,
  };
}
