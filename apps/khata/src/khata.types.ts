import type { SkeletonRecord } from '@skeleton/core';

// ---------------------------------------------------------------------------
// Collection payload types
// ---------------------------------------------------------------------------

export type KhataCollections = {
  /** A new customer is registered */
  customerCreated: {
    name: string;
    phone?: string;
    note?: string;
  };
  /** A customer's info is changed (latest record wins for given customerId) */
  customerUpdated: {
    customerId: string;
    name?: string;
    phone?: string;
    note?: string;
  };
  /** Shopkeeper gives credit — customer owes more */
  creditGiven: {
    customerId: string;
    amountPaisa: number;
    note?: string;
    date: string;
  };
  /** Customer pays — they owe less */
  paymentReceived: {
    customerId: string;
    amountPaisa: number;
    note?: string;
    date: string;
  };
  /** Corrects a mistake by cancelling a previous credit/payment entry */
  entryReversed: {
    entryId: string;
    reason: string;
  };
  /** Shop-level settings (append-only, latest record wins) */
  settingsUpdated: {
    shopName?: string;
    language?: 'en' | 'ur';
  };
};

// ---------------------------------------------------------------------------
// Derived state types
// ---------------------------------------------------------------------------

export type CustomerInfo = {
  /** The customerCreated record id — used as the customer id throughout */
  id: string;
  name: string;
  phone?: string;
  note?: string;
  createdAt: string;
};

export type LedgerEntry = {
  id: string;
  type: 'credit' | 'payment';
  amountPaisa: number;
  note?: string;
  date: string;
  createdAt: string;
  reversed: boolean;
  reverseReason?: string;
  /** Balance after this entry (0 for reversed entries) */
  runningBalancePaisa: number;
};

export type BalanceState = {
  /** Positive = customer owes; negative = advance payment */
  balancePaisa: number;
  reversedEntryIds: Set<string>;
  entries: LedgerEntry[];
};

export type DashboardState = {
  /** Sum of all positive customer balances */
  totalOutstandingPaisa: number;
  creditTodayPaisa: number;
  paymentsTodayPaisa: number;
  topDebtors: { customerId: string; name: string; balancePaisa: number }[];
};

export type Settings = {
  shopName: string;
  language: 'en' | 'ur';
};

export type ReportTotals = {
  creditPaisa: number;
  paymentsPaisa: number;
  /** payments − credit. Positive = more collected than lent in the range. */
  netPaisa: number;
};

export type CustomerRow = {
  customer: CustomerInfo;
  balancePaisa: number;
};

// ---------------------------------------------------------------------------
// App data snapshot and navigation
// ---------------------------------------------------------------------------

type Rec<K extends keyof KhataCollections> = SkeletonRecord<KhataCollections[K]>;

/** Every record in the local store, grouped by collection. */
export type KhataData = {
  customerCreated: Rec<'customerCreated'>[];
  customerUpdated: Rec<'customerUpdated'>[];
  creditGiven: Rec<'creditGiven'>[];
  paymentReceived: Rec<'paymentReceived'>[];
  entryReversed: Rec<'entryReversed'>[];
  settingsUpdated: Rec<'settingsUpdated'>[];
};

/** Everything the screens display, derived from KhataData. */
export type KhataDerived = {
  customers: CustomerInfo[];
  /** customerId → balance in paisa (missing = 0) */
  balances: Map<string, number>;
  settings: Settings;
  dashboard: DashboardState;
  /** Local date (YYYY-MM-DD) the derivation used as "today" */
  today: string;
};

export type Screen =
  | { name: 'dashboard' }
  | { name: 'customerList' }
  | { name: 'addCustomer' }
  | { name: 'editCustomer'; customerId: string }
  | { name: 'customerDetail'; customerId: string }
  | { name: 'addEntry'; customerId: string; type: 'credit' | 'payment' }
  | { name: 'reverseEntry'; entryId: string; customerId: string }
  | { name: 'reports' }
  | { name: 'settings' };

// ---------------------------------------------------------------------------
// Convenience aliases for record types used in reducers and tests
// ---------------------------------------------------------------------------

export type AnyKhataRecord =
  | SkeletonRecord<KhataCollections['customerCreated']>
  | SkeletonRecord<KhataCollections['customerUpdated']>
  | SkeletonRecord<KhataCollections['creditGiven']>
  | SkeletonRecord<KhataCollections['paymentReceived']>
  | SkeletonRecord<KhataCollections['entryReversed']>
  | SkeletonRecord<KhataCollections['settingsUpdated']>;
