# Khata - Tasks

## Phase 1: Types, DB, Store & Reducers

- [ ] 1.1 Create `apps/khata/src/khata.types.ts`: define `KhataCollections` interface with six collections (`customerCreated`, `customerUpdated`, `creditGiven`, `paymentReceived`, `entryReversed`, `settingsUpdated`) and their payload types. Store money as `amountPaisa: number` (integers). Export `LedgerEntry`, `CustomerInfo`, `BalanceState`, `DashboardState`, `Settings` derived-state types.

- [ ] 1.2 Create `apps/khata/src/khata.db.ts`: call `createDatabase<KhataCollections>` from `@skeleton/core` with `dbName: 'khata'` and all six collection keys. Export the singleton `db`.

- [ ] 1.3 Create `apps/khata/src/khata.store.ts`: call `createStore(db, getOrCreateDeviceId())` and `createSyncEngine({ adapter: new InMemorySyncAdapter(), store })`. Export singleton `store` and `engine`. Both imported from `@skeleton/core` only.

- [ ] 1.4 Create `apps/khata/src/khata.reducers.ts`: implement four pure reducer functions using `deriveState` from `@skeleton/core`:
  - `deriveCustomerList(records)` → `CustomerInfo[]` (all customers, sorted by `createdAt`)
  - `deriveCustomerInfo(records, customerId)` → `CustomerInfo | null` (latest name/phone/note for one customer)
  - `deriveBalance(records, customerId)` → `BalanceState` (balance in paisa + ledger entries with running balance + reversed entry ids). Reversal must be order-independent: build reversedIds set first, then compute balance and entries.
  - `deriveSettings(records)` → `Settings` (shopName + language from latest `settingsUpdated` record; defaults: `shopName = 'My Shop'`, `language = 'en'`)

- [ ] 1.5 Create `apps/khata/src/utils/money.ts`: `formatPaisa(paisa: number): string` → `"Rs X,XXX"` using integer arithmetic only (no `toFixed`, no floating-point division). `paisaFromRupees(rs: number): number` → `Math.round(rs) * 100`.

- [ ] 1.6 Create `apps/khata/src/utils/phone.ts`: `validatePakistaniPhone(phone: string): boolean` (strips hyphens/spaces, checks `/^03\d{9}$/`). `normalizePhone(phone: string): string`.

## Phase 2: i18n Translations

- [ ] 2.1 Create `apps/khata/src/i18n/en.json` with all `khata.*` keys listed in the design doc. Every user-visible string in the app must have a key here. No hardcoded English strings in JSX.

- [ ] 2.2 Create `apps/khata/src/i18n/ur.json` with Urdu translations for every key in `en.json`. Both files must have exactly the same keys (the translation-checker hook will enforce this). Use correct Urdu for financial terms: balance = بقایا, credit = ادھار, payment = ادائیگی, customer = گاہک, shop = دکان.

- [ ] 2.3 Update `apps/khata/src/main.tsx` to call `registerAppTranslations({ en, ur })` from `@skeleton/core` before rendering, importing from the two JSON files above.

## Phase 3: Utility Functions

- [ ] 3.1 Create `apps/khata/src/utils/reminder.ts`: implement `buildWhatsAppUrl(opts)` and `buildSmsUrl(opts)`. WhatsApp URL converts Pakistani number to international format (`03xx` → `923xx`). Message text uses i18n templates for both languages. Export both functions.

- [ ] 3.2 Create `apps/khata/src/utils/csv.ts`: implement `buildCsvBlob(customers, entries)` returning a UTF-8 BOM CSV `Blob` (BOM needed for Excel compatibility with Urdu text). CSV columns for customers: Name, Phone, Balance (Rs). CSV columns for transactions: Customer, Date, Type, Amount (Rs), Note, Status (Active/Reversed).

- [ ] 3.3 Create `apps/khata/src/utils/demo.ts`: implement `loadDemoData(store)`. Insert at least 5 customers (Pakistani names) and multiple transactions per customer using `store.add`. Dates spread over last 30 days (use `new Date()` minus offsets). Include at least one reversal. Leave varied balances: some owing, one settled, one with advance.

## Phase 4: Screens

- [ ] 4.1 Create `apps/khata/src/screens/DashboardScreen.tsx`: renders total outstanding (paisa → Rs, red), credit today, payments today, and top-5 debtors list. All amounts via `formatPaisa`. All text via `useTranslation` from `@skeleton/core`'s i18n. Tapping a debtor navigates to `customerDetail`.

- [ ] 4.2 Create `apps/khata/src/screens/CustomerListScreen.tsx`: renders a searchable list of all customers sorted by balance descending. Each row: name + balance (red if positive, green if zero/negative). Search input filters by name and phone. "Add Customer" button navigates to `addCustomer`.

- [ ] 4.3 Create `apps/khata/src/screens/AddCustomerScreen.tsx`: form with name (required), phone (optional, validated), note (optional). On submit calls `store.add('customerCreated', payload)`. Inline validation errors in current language. On success navigates back to `customerList`.

- [ ] 4.4 Create `apps/khata/src/screens/CustomerDetailScreen.tsx`: shows balance, customer info, two primary buttons (Credit Given / Payment Received), Send Reminder button (only when balance > 0), and transaction history. Each non-reversed entry has a "Correct mistake" button. Reversed entries shown with strikethrough and reason.

- [ ] 4.5 Create `apps/khata/src/screens/AddEntryScreen.tsx`: shared for credit and payment (type passed as prop). Large numeric input (48px height, `inputMode="numeric"`), optional note, date defaulting to today. On submit calls `store.add('creditGiven', ...)` or `store.add('paymentReceived', ...)`. Navigates back to `customerDetail` on success.

- [ ] 4.6 Create `apps/khata/src/screens/ReverseEntryScreen.tsx`: shows the original entry details (type, amount, date, note). Requires a reason text field. On confirm calls `store.add('entryReversed', { entryId, reason })`. Navigates back to `customerDetail` on success.

- [ ] 4.7 Create `apps/khata/src/screens/ReportsScreen.tsx`: date-range selector (from/to, defaulting to current calendar month). Shows credit given total, payments received total, and net for the range. All computed from local records with no network call.

- [ ] 4.8 Create `apps/khata/src/screens/SettingsScreen.tsx`: shop name input, language selector (English / Urdu radio). On shop name save calls `store.add('settingsUpdated', { shopName })`. Language change calls `setLanguage(lng)` from `@skeleton/core` and also persists via `store.add('settingsUpdated', { language: lng })`. Export CSV button triggers `buildCsvBlob` download. Load Demo Data button shows a confirmation dialog then calls `loadDemoData(store)`.

## Phase 5: App Root & Navigation

- [ ] 5.1 Update `apps/khata/src/App.tsx`: set up screen state (type `Screen` from design), render the correct screen component based on current state, wire `navigate` callback. Wrap everything in `AppShell` from `@skeleton/core` with `appName={t('khata.appName')}`, `syncStatus`, `onSyncNow`, `language`, and `onToggleLanguage`. Add a bottom navigation bar (4 tabs: Dashboard, Customers, Reports, Settings) with `min-h-[44px]` touch targets and Tailwind logical properties.

- [ ] 5.2 Wire engine start/stop in a `useEffect` in `App.tsx`. Subscribe to engine status and pass to `AppShell`. Subscribe to store changes and re-derive all state on each change.

- [ ] 5.3 Apply RTL layout to all screens: use Tailwind logical properties throughout (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`). Test by switching to Urdu — layout should mirror correctly.

## Phase 6: Tests

- [ ] 6.1 Create `tests/khata.balance.test.ts`: property-based tests (fast-check):
  - **TR-1:** For any sequence of credit/payment/reversal records, `deriveBalance` produces balance = sum(non-reversed credits) − sum(non-reversed payments).
  - **TR-2:** Balance is identical regardless of record arrival order (shuffle records, re-derive, compare).
  - **TR-3:** Reversing an entry restores the exact pre-entry balance.
  - **TR-5:** No floating-point error for any integer paisa amounts.

- [ ] 6.2 Create `tests/khata.dashboard.test.ts`: property-based test (fast-check):
  - **TR-4:** Dashboard total outstanding equals exact sum of all positive individual customer balances for any multi-customer record set.

- [ ] 6.3 Create `tests/khata.reminder.test.ts`: unit tests (**TR-6**):
  - `buildWhatsAppUrl` produces correct URL with phone in international format, correct message in English.
  - `buildWhatsAppUrl` produces correct Urdu message.
  - Shop name and customer name appear in the message.
  - `buildSmsUrl` produces correct `sms:` link.

- [ ] 6.4 Create `tests/khata.phone.test.ts`: unit tests (**TR-7**):
  - Valid formats accepted: `03001234567`, `0300-1234567`, `0300 1234567`.
  - Invalid formats rejected: `92300...`, `+923...`, `01234567890`, empty string, letters.

- [ ] 6.5 Create `tests/khata.csv.test.ts`: unit tests (**TR-8**):
  - CSV contains correct headers.
  - All customers appear with correct balance in Rs.
  - All transactions appear with correct type, amount, and status.
  - Reversed entries are labelled "Reversed".

- [ ] 6.6 Create `tests/khata.reversal.test.ts`: unit tests (**TR-9**):
  - Reversed entry is excluded from balance calculation.
  - Reversed entry is excluded from dashboard totals.
  - Balance with reversal equals balance as if entry never existed.

- [ ] 6.7 Create `tests/khata.demo.test.ts`: unit tests (**TR-10**):
  - After `loadDemoData`, all customers have valid numeric balances (not NaN).
  - At least one reversed entry exists in the records.
  - At least one customer with positive balance and at least one with zero or negative.

- [ ] 6.8 Run `npm test` — all existing tests (82) plus all new Khata tests pass.

## Phase 7: Polish & Integration

- [ ] 7.1 Verify all screens work at 360px viewport width in browser DevTools. No horizontal overflow.

- [ ] 7.2 Verify RTL layout: switch to Urdu, check every screen — navigation, forms, buttons, and balance display all mirror correctly.

- [ ] 7.3 Verify offline mode: in DevTools Network tab, set to Offline. Add a customer, add credit entry, add payment. All operations work. Sync badge shows pending count.

- [ ] 7.4 Verify demo mode end-to-end: tap Load Demo Data in settings → dismiss confirmation → data appears on dashboard and customer list → open a customer → transaction history shows entries → open a reversed entry → see strikethrough.

- [ ] 7.5 Verify payment reminder: open a customer with balance > 0 → tap Send Reminder → WhatsApp opens with correct pre-filled message.

- [ ] 7.6 Verify CSV export: tap Export CSV in settings → file downloads → open in Excel/Sheets → all customers and transactions present, amounts correct.

- [ ] 7.7 Move `apps/khata/src/utils/money.ts` and `apps/khata/src/utils/phone.ts` to `packages/skeleton/src/utils/` and re-export from `@skeleton/core` barrel. Update `apps/khata` imports. Verify tests still pass.

- [ ] 7.8 Run `npm run build` — skeleton compiles, Khata app builds with no TypeScript errors.

- [ ] 7.9 Commit completed Khata app.
