# Khata - Design

## Architecture Overview

Khata is a single-page React app (`apps/khata`) built entirely on `@skeleton/core`. It adds no new runtime dependencies beyond what the skeleton already provides. All state is derived from the append-only record store. Navigation is handled by a local `screen` state variable (no router library needed at this scale).

```
apps/khata/src/
├── main.tsx                  # app entry — registers translations, mounts App
├── App.tsx                   # root: db/store/engine setup, screen routing
├── khata.types.ts            # KhataCollections interface (6 collections)
├── khata.db.ts               # createDatabase<KhataCollections> singleton
├── khata.store.ts            # store + engine singletons
├── khata.reducers.ts         # deriveCustomers, deriveBalance, deriveDashboard
├── i18n/
│   ├── en.json               # all Khata-specific translation keys (English)
│   └── ur.json               # all Khata-specific translation keys (Urdu)
├── utils/
│   ├── money.ts              # formatPaisa → "Rs X,XXX" (→ skeleton candidate)
│   ├── phone.ts              # validatePakistaniPhone (→ skeleton candidate)
│   ├── reminder.ts           # buildWhatsAppUrl, buildSmsUrl
│   ├── csv.ts                # buildCsvBlob
│   └── demo.ts               # loadDemoData: inserts sample records
└── screens/
    ├── DashboardScreen.tsx
    ├── CustomerListScreen.tsx
    ├── AddCustomerScreen.tsx
    ├── CustomerDetailScreen.tsx
    ├── AddEntryScreen.tsx
    ├── ReverseEntryScreen.tsx
    ├── ReportsScreen.tsx
    └── SettingsScreen.tsx
```

> **Skeleton candidates:** `money.ts` and `phone.ts` are general-purpose utilities. After Khata is working, they will be moved to `packages/skeleton/src/utils/` and re-exported from `@skeleton/core` so `clinic-queue` can use them without duplicating code (C-5).

---

## State Model

### Collections

```typescript
// khata.types.ts

export type KhataCollections = {
  customerCreated:   { name: string; phone?: string; note?: string };
  customerUpdated:   { customerId: string; name?: string; phone?: string; note?: string };
  creditGiven:       { customerId: string; amountPaisa: number; note?: string; date: string };
  paymentReceived:   { customerId: string; amountPaisa: number; note?: string; date: string };
  entryReversed:     { entryId: string; reason: string };
  settingsUpdated:   { shopName?: string; language?: 'en' | 'ur' };
};
```

### Derived State

All state is derived from records using `deriveState` from `@skeleton/core`. Derivation is pure and re-run after every store mutation.

#### Customer Info

```typescript
// Derived by folding customerCreated + customerUpdated records for one customerId

type CustomerInfo = {
  id: string;        // the customerCreated record id
  name: string;
  phone?: string;
  note?: string;
  createdAt: string;
};
```

**Reducer logic:**
1. `customerCreated` → initializes `CustomerInfo` using the record id as the customer id
2. `customerUpdated` where `payload.customerId === targetId` → merges changed fields (non-undefined fields overwrite)

#### Customer Balance

```typescript
// Derived per customer from creditGiven, paymentReceived, entryReversed records

type BalanceState = {
  balancePaisa: number;    // positive = customer owes; negative = advance
  reversedEntryIds: Set<string>;
  entries: LedgerEntry[];  // ordered by createdAt, includes reversed (marked)
};

type LedgerEntry = {
  id: string;
  type: 'credit' | 'payment';
  amountPaisa: number;
  note?: string;
  date: string;
  createdAt: string;
  reversed: boolean;
  reverseReason?: string;
  runningBalancePaisa: number; // balance after this entry (0 for reversed)
};
```

**Reducer logic (processes records in `createdAt` order):**
- `entryReversed`: adds `payload.entryId` to `reversedEntryIds`, stores reason
- `creditGiven`: if id not in `reversedEntryIds`, adds `amountPaisa` to balance; appends `LedgerEntry` with `reversed: false`. If id IS in `reversedEntryIds`, appends with `reversed: true` (order-independent: re-process when reversal arrives)
- `paymentReceived`: symmetric to creditGiven, subtracts from balance

> **Order-independence note:** Because sync may deliver records in any order, the reducer processes all records but marks entries as reversed retroactively. The final `entries` array is built in a second pass after all records are seen, so balance and reversal state are always consistent regardless of insertion order. This satisfies TR-2.

#### Dashboard

```typescript
type DashboardState = {
  totalOutstandingPaisa: number; // sum of positive customer balances
  creditTodayPaisa: number;
  paymentsTodayPaisa: number;
  topDebtors: { customerId: string; name: string; balancePaisa: number }[]; // top 5
};
```

Derived by aggregating per-customer balance states across all customers.

#### Settings

```typescript
type Settings = {
  shopName: string;    // default: 'My Shop' / 'میری دکان'
  language: 'en' | 'ur';
};
```

Derived by folding `settingsUpdated` records; latest non-undefined field values win.

---

## Screen Architecture

Navigation is a local React state variable `screen` in `App.tsx`. Each screen is a component that receives the store/engine singletons and a `navigate(screen)` callback. No router library.

```typescript
type Screen =
  | { name: 'dashboard' }
  | { name: 'customerList' }
  | { name: 'addCustomer' }
  | { name: 'customerDetail'; customerId: string }
  | { name: 'addEntry'; customerId: string; type: 'credit' | 'payment' }
  | { name: 'reverseEntry'; entryId: string; customerId: string }
  | { name: 'reports' }
  | { name: 'settings' };
```

Bottom navigation bar: Dashboard | Customers | Reports | Settings (4 tabs, always visible).

---

## Screen Designs

### Dashboard Screen

```
┌─────────────────────────────────┐
│ Khata          [sync] [🌐]      │  ← AppShell header
├─────────────────────────────────┤
│  Total Outstanding              │
│  ┌─────────────────────────┐   │
│  │   Rs 24,500             │   │  ← large red amount
│  └─────────────────────────┘   │
│                                 │
│  Today                          │
│  Credit Given    Rs 3,000  🔴   │
│  Payments Recv   Rs 1,500  🟢   │
│                                 │
│  Top Debtors                    │
│  ┌─ Ahmed Ali ──────── Rs 8,200 │
│  ├─ Bilal Khan ─────── Rs 5,100 │
│  ├─ Sara Begum ─────── Rs 4,300 │
│  └─ ...                         │
├─────────────────────────────────┤
│ [Home] [Customers] [Reports] [⚙]│  ← bottom nav
└─────────────────────────────────┘
```

### Customer List Screen

```
┌─────────────────────────────────┐
│ Customers       [sync] [🌐]     │
├─────────────────────────────────┤
│ 🔍 Search name or phone...      │
├─────────────────────────────────┤
│ Ahmed Ali              Rs 8,200 │  ← red
│ Bilal Khan             Rs 5,100 │  ← red
│ Sara Begum             Rs 4,300 │  ← red
│ Fatima Noor            Rs 0     │  ← green
├─────────────────────────────────┤
│          [+ Add Customer]        │  ← full-width, 44px
└─────────────────────────────────┘
```

### Customer Detail Screen

```
┌─────────────────────────────────┐
│ ← Ahmed Ali     [sync] [🌐]    │
├─────────────────────────────────┤
│  Balance: Rs 8,200              │  ← red, large
│  📱 03XX-XXXXXXX               │
│                                 │
│  [💳 Credit Given] [✅ Payment] │  ← two 44px buttons
│  [📲 Send Reminder]             │  ← only shown if balance > 0
├─────────────────────────────────┤
│  Transaction History            │
│  ─────────────────              │
│  15/10/2026  Credit  Rs 2,000  │  ← red
│  Running bal: Rs 8,200          │
│  Note: Ration                   │
│                      [Correct]  │
│  ─────────────────              │
│  10/10/2026  Payment Rs 1,000  │  ← green
│  Running bal: Rs 6,200          │
│  ─────────────────              │
│  05/10/2026  ~~Credit Rs 500~~ │  ← strikethrough, gray
│  Reversed: Wrong amount         │
└─────────────────────────────────┘
```

### Add Entry Screen

```
┌─────────────────────────────────┐
│ ← Credit Given  [sync] [🌐]    │
├─────────────────────────────────┤
│  Customer: Ahmed Ali            │
│                                 │
│  Amount (Rs)                    │
│  ┌─────────────────────────┐   │
│  │  2 0 0 0                │   │  ← large 48px input, numeric kbd
│  └─────────────────────────┘   │
│                                 │
│  Note (optional)                │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  Date                           │
│  ┌─────────────────────────┐   │
│  │  07/11/2026             │   │  ← date picker, defaults to today
│  └─────────────────────────┘   │
│                                 │
│       [Save Credit Given]        │  ← 44px, full-width
└─────────────────────────────────┘
```

### Reverse Entry Screen

```
┌─────────────────────────────────┐
│ ← Correct Mistake [sync] [🌐]  │
├─────────────────────────────────┤
│  You are reversing:             │
│                                 │
│  Type:    Credit Given          │
│  Amount:  Rs 2,000              │
│  Date:    15/10/2026            │
│  Note:    Ration                │
│                                 │
│  Reason for reversal (required) │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│       [Confirm Reversal]         │  ← 44px, red button
└─────────────────────────────────┘
```

### Reports Screen

```
┌─────────────────────────────────┐
│ Reports         [sync] [🌐]    │
├─────────────────────────────────┤
│  From: [01/11/2026]  To: [07/11/2026]  │
├─────────────────────────────────┤
│  Credit Given    Rs 12,500  🔴  │
│  Payments Recv   Rs  8,000  🟢  │
│  Net             Rs  4,500  🔴  │
└─────────────────────────────────┘
```

### Settings Screen

```
┌─────────────────────────────────┐
│ Settings        [sync] [🌐]    │
├─────────────────────────────────┤
│  Shop Name                      │
│  ┌─────────────────────────┐   │
│  │ Ahmed General Store     │   │
│  └─────────────────────────┘   │
│                                 │
│  Language                       │
│  ● English   ○ اردو             │
│                                 │
│       [Export CSV]               │
│       [Load Demo Data]           │
└─────────────────────────────────┘
```

---

## Money Formatting

```typescript
// utils/money.ts  (→ move to @skeleton/core/utils after Khata ships)

export function formatPaisa(paisa: number): string {
  const rs = Math.floor(Math.abs(paisa) / 100);
  const formatted = rs.toLocaleString('en-PK'); // e.g. "1,234"
  return `Rs ${formatted}`;
}

export function paisaFromRupees(rs: number): number {
  return Math.round(rs) * 100; // rs is always a whole number from the form input
}
```

All arithmetic done in paisa (integers). Display only converts for rendering. No `toFixed`, no floating-point division for financial calculations.

---

## Phone Validation

```typescript
// utils/phone.ts  (→ move to @skeleton/core/utils after Khata ships)

const PK_PHONE_RE = /^03\d{9}$/;

export function validatePakistaniPhone(phone: string): boolean {
  const stripped = phone.replace(/[-\s]/g, '');
  return PK_PHONE_RE.test(stripped);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[-\s]/g, '');
}
```

Accepts: `03001234567`, `0300-1234567`, `0300 1234567`. Rejects all other formats.

---

## Payment Reminder

```typescript
// utils/reminder.ts

export function buildWhatsAppUrl(opts: {
  phone: string;       // normalized Pakistani number
  shopName: string;
  customerName: string;
  balancePaisa: number;
  language: 'en' | 'ur';
}): string {
  const amount = formatPaisa(opts.balancePaisa);
  const msg = opts.language === 'ur'
    ? `السلام علیکم ${opts.customerName}! ${opts.shopName} سے یاد دہانی: آپ کا بقایا ${amount} ہے۔ برائے مہربانی ادائیگی کریں۔ شکریہ`
    : `Hello ${opts.customerName}! Reminder from ${opts.shopName}: your outstanding balance is ${amount}. Please make a payment at your earliest convenience. Thank you.`;
  const intlPhone = `92${opts.phone.slice(1)}`; // 03xx → 923xx
  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
}

export function buildSmsUrl(opts: { phone: string; message: string }): string {
  return `sms:${opts.phone}?body=${encodeURIComponent(opts.message)}`;
}
```

The "Send Reminder" button tries `window.open(whatsAppUrl)` first. If the user's device doesn't have WhatsApp, the `wa.me` page will not open the app; the SMS fallback is surfaced as a secondary button/link.

---

## CSV Export

```typescript
// utils/csv.ts

export function buildCsvBlob(customers: CustomerInfo[], allEntries: AllEntriesExport[]): Blob {
  // Header: Name, Phone, Balance (Rs)
  // Then for each customer: transactions with Date, Type, Amount(Rs), Note, Status
  // Returns Blob with text/csv mime type
}
```

Download triggered by creating an `<a>` element with `href = URL.createObjectURL(blob)` and `download = 'khata-export.csv'`, then programmatically clicking it and revoking the URL.

---

## Demo Data

```typescript
// utils/demo.ts

export async function loadDemoData(store: Store<KhataCollections>): Promise<void> {
  // Inserts via store.add — same code path as real entries.
  // Sample customers: Ahmed Ali, Bilal Khan, Sara Begum, Fatima Noor, Tariq Mehmood
  // Multiple credit/payment records per customer across last 30 days
  // One reversed entry (wrong amount)
  // Varied balances: 2 owing, 1 settled, 1 advance, 1 large debtor
}
```

Demo data dates are set relative to `new Date()` at insertion time so the dashboard "today" figures are always populated.

---

## i18n Key Structure

All Khata keys are prefixed with `khata.` to prevent collisions with skeleton keys (which are unprefixed). Registered via `registerAppTranslations` on app startup.

```
khata.appName
khata.nav.dashboard
khata.nav.customers
khata.nav.reports
khata.nav.settings
khata.dashboard.totalOutstanding
khata.dashboard.creditToday
khata.dashboard.paymentsToday
khata.dashboard.topDebtors
khata.customers.title
khata.customers.search
khata.customers.addButton
khata.customers.emptyState
khata.addCustomer.title
khata.addCustomer.nameLabel
khata.addCustomer.phonePlaceholder
khata.addCustomer.noteLabel
khata.addCustomer.saveButton
khata.addCustomer.nameRequired
khata.addCustomer.phoneInvalid
khata.customerDetail.balance
khata.customerDetail.creditButton
khata.customerDetail.paymentButton
khata.customerDetail.reminderButton
khata.customerDetail.history
khata.customerDetail.reversed
khata.customerDetail.correctButton
khata.addEntry.creditTitle
khata.addEntry.paymentTitle
khata.addEntry.amountLabel
khata.addEntry.noteLabel
khata.addEntry.dateLabel
khata.addEntry.saveButton
khata.addEntry.amountRequired
khata.addEntry.amountInvalid
khata.reverseEntry.title
khata.reverseEntry.originalEntry
khata.reverseEntry.reasonLabel
khata.reverseEntry.confirmButton
khata.reverseEntry.reasonRequired
khata.reports.title
khata.reports.fromLabel
khata.reports.toLabel
khata.reports.creditGiven
khata.reports.paymentsReceived
khata.reports.net
khata.settings.title
khata.settings.shopNameLabel
khata.settings.languageLabel
khata.settings.exportButton
khata.settings.demoButton
khata.settings.demoConfirm
khata.settings.demoWarning
khata.reminder.whatsappMessage
khata.reminder.smsMessage
khata.common.back
khata.common.cancel
khata.common.save
khata.common.balance
khata.common.credit
khata.common.payment
```

---

## Testing Architecture

Tests live in `tests/` at the monorepo root (alongside existing skeleton tests). Khata-specific test files:

```
tests/
├── khata.balance.test.ts       # property-based: TR-1, TR-2, TR-3, TR-5
├── khata.dashboard.test.ts     # property-based: TR-4
├── khata.reminder.test.ts      # unit: TR-6
├── khata.phone.test.ts         # unit: TR-7
├── khata.csv.test.ts           # unit: TR-8
├── khata.reversal.test.ts      # unit: TR-9
└── khata.demo.test.ts          # unit: TR-10
```

The existing `vitest.config.ts` (jsdom environment, fake-indexeddb) covers all test requirements without changes.

---

## Dependency Notes

- **No new runtime dependencies.** `@skeleton/core` already pulls in Dexie, i18next, react-i18next, and Tailwind.
- `formatPaisa` and `validatePakistaniPhone` are pure functions — no dependencies at all.
- WhatsApp and SMS reminders are URL strings — no SDK needed.
- CSV export uses the browser `Blob` and `URL.createObjectURL` APIs — available offline.
- Demo mode uses the same `store.add` API as real entries — no special paths.

