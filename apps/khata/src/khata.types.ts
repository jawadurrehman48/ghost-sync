import type { SkeletonRecord } from '@skeleton/core';

// ---------------------------------------------------------------------------
// Collection payload types (what is stored; append-only)
// ---------------------------------------------------------------------------

export type KhataCollections = {
  /** A new customer is registered */
  customerCreated: {
    name: string;
    phone?: string;
    note?: string;
  };
  /** A customer's info is changed (latest value of each field wins) */
  customerUpdated: {
    customerId: string;
    name?: string;
    phone?: string;
    note?: string;
  };
  /** Shopkeeper gives credit: the customer owes more */
  creditGiven: {
    customerId: string;
    /** Whole paisa, always a positive integer */
    amountPaisa: number;
    note?: string;
    /** Local calendar date, YYYY-MM-DD */
    date: string;
  };
  /** Customer pays: they owe less */
  paymentReceived: {
    customerId: string;
    amountPaisa: number;
    note?: string;
    date: string;
  };
  /** Corrects a mistake by cancelling a previous credit or payment entry */
  entryReversed: {
    entryId: string;
    reason: string;
  };
  /** Shop-level settings (latest value of each field wins) */
  settingsUpdated: {
    shopName?: string;
    language?: 'en' | 'ur';
    /** Written once when the demo data is loaded, so it is never loaded twice */
    demoDataLoaded?: boolean;
  };
};

// ---------------------------------------------------------------------------
// Derived state types
// ---------------------------------------------------------------------------

export type CustomerInfo = {
  /** The customerCreated record id, used as the customer id everywhere */
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
  /** Oldest first, ordered by entry date */
  entries: LedgerEntry[];
};

export type DashboardState = {
  /** Sum of all positive customer balances */
  totalOutstandingPaisa: number;
  /** How many customers have a positive balance */
  customersOwingCount: number;
  creditTodayPaisa: number;
  paymentsTodayPaisa: number;
  topDebtors: { customerId: string; name: string; balancePaisa: number }[];
};

export type Settings = {
  shopName: string;
  language: 'en' | 'ur';
  demoDataLoaded: boolean;
};

export type ReportTotals = {
  creditPaisa: number;
  paymentsPaisa: number;
  /** payments minus credit. Positive = more collected than lent in the range. */
  netPaisa: number;
};

/** One bar group in the report chart: totals for a run of days. */
export type ChartBucket = {
  from: string;
  to: string;
  creditPaisa: number;
  paymentsPaisa: number;
};

/** One customer's activity inside a report range. */
export type CustomerBreakdownRow = {
  customerId: string;
  name: string;
  creditPaisa: number;
  paymentsPaisa: number;
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
  /** customerId to balance in paisa (missing = 0) */
  balances: Map<string, number>;
  settings: Settings;
  dashboard: DashboardState;
  /** Local date (YYYY-MM-DD) the derivation used as "today" */
  today: string;
};

/** Screens that can open the quick-entry flow (and where Back returns to). */
export type QuickEntryOrigin = 'dashboard' | 'customerList' | 'reports';

export type Screen =
  | { name: 'dashboard' }
  | { name: 'customerList' }
  | { name: 'addCustomer' }
  | { name: 'editCustomer'; customerId: string }
  | { name: 'customerDetail'; customerId: string }
  | { name: 'addEntry'; customerId: string; type: 'credit' | 'payment' }
  | { name: 'quickEntry'; from: QuickEntryOrigin }
  | { name: 'reverseEntry'; entryId: string; customerId: string }
  | { name: 'reports' }
  | { name: 'settings' };
