# Khata - Tasks

Legend: `[x]` done and verified by tests, the build, or the real-browser check (`npm run e2e`).

## Phase 1: Types, DB, Store & Reducers

- [x] 1.1 `khata.types.ts`: `KhataCollections` (six collections, money as `amountPaisa`), derived-state types, `KhataData`, `KhataDerived`, `Screen`, `ReportTotals`, `ChartBucket`, `CustomerBreakdownRow`.
- [x] 1.2 `khata.db.ts`: `createDatabase<KhataCollections>` with `dbName: 'khata'`.
- [x] 1.3 `khata.store.ts`: `createStore` + `createSyncEngine({ adapter: new InMemorySyncAdapter(), store })`.
- [x] 1.4 `khata.reducers.ts`: customers, balances (order-independent; ledger ordered by entry date), balance map, settings, dashboard, reports, chart buckets, per-customer breakdown, search, `deriveAll`. Corrupt amounts are ignored, and reversals of reversals have no effect.
- [x] 1.5 Money helpers. **Live in `packages/skeleton/src/utils/money.ts`.**
- [x] 1.6 Phone helpers (plus `formatPhone`). **Live in `packages/skeleton/src/utils/phone.ts`.**

## Phase 2: i18n Translations

- [x] 2.1 `i18n/en.json`: every `khata.*` key, with no hard-coded English in screens (enforced by `tests/khata.architecture.test.ts`).
- [x] 2.2 `i18n/ur.json`: the same keys in simple shopkeeper Urdu. Key and placeholder parity enforced by `tests/i18n-keys.test.ts`.
- [x] 2.3 `main.tsx` calls `registerAppTranslations({ en, ur })` before render and wraps the app in `ErrorBoundary`.

## Phase 3: Utility Functions

- [x] 3.1 `utils/reminder.ts`: WhatsApp and SMS links.
- [x] 3.2 `utils/csv.ts`: UTF-8 BOM, shop name header, formula-injection protection.
- [x] 3.3 `utils/demo.ts`: 8 customers, realistic amounts over 30 days, one reversal, one settled, one advance; **loads only once** (marker record, written first; overlapping calls share one run).

## Phase 4: Screens

- [x] 4.1 Dashboard: total outstanding, **owing count**, today's credit and payments, top-5 debtors (each opens the customer), welcome empty state.
- [x] 4.2 Customer list: search, highest balance first, red/green plus a status word, empty states with actions.
- [x] 4.3 Add / edit customer: validation, length limits, duplicate (name + phone) protection, formatted phone.
- [x] 4.4 Customer detail: balance, actions, reminders, history, Correct Mistake, empty state.
- [x] 4.5 Add entry: shared `EntryForm` (56px numeric field, Urdu digits, Rs preview, note, date), double-tap safe.
- [x] 4.6 Reverse entry: reason required and limited, no double reversal, double-tap safe.
- [x] 4.7 Reports: **Today / This Week / This Month**, custom range, totals, **SVG bar chart**, **per-customer breakdown**, empty state.
- [x] 4.8 Settings: shop name, language, CSV, demo data (once), **Clear all data** with confirmation.
- [x] 4.9 **Quick entry** screen behind the floating `+` button.

## Phase 5: App Root & Navigation

- [x] 5.1 `App.tsx`: AppShell with logo, bottom navigation, screen routing, Android back button via history, floating `+` on Home and Customers.
- [x] 5.2 Sync engine wiring, `useStoreSnapshot`, midnight rollover, per-screen error boundary, loading and error states.
- [x] 5.3 Logical Tailwind classes only (enforced by `tests/khata.rtl.test.ts`).

## Phase 6: Tests

- [x] 6.1 `khata.balance.test.ts`: TR-1, TR-2, TR-3, TR-5 (property-based, BigInt oracle).
- [x] 6.2 `khata.dashboard.test.ts`: TR-4, reports, search, settings.
- [x] 6.3 `khata.reminder.test.ts`: TR-6.
- [x] 6.4 `khata.phone.test.ts`: TR-7.
- [x] 6.5 `khata.csv.test.ts`: TR-8.
- [x] 6.6 `khata.reversal.test.ts`: TR-9.
- [x] 6.7 `khata.demo.test.ts`: TR-10, plus **load-once tests** (twice, concurrent, synced marker, after clearing).
- [x] 6.8 `khata.edge-cases.test.ts`: corrupt/zero/negative/huge amounts, reversing twice, reversing a reversal, duplicate names, orphan entries, long text, impossible dates, empty database (property-based).
- [x] 6.9 `khata.reports.test.ts`: chart buckets and breakdown add up to the totals, cover the range, order independence, owing count (property-based).
- [x] 6.10 `khata.screens.test.tsx`: every screen in English and Urdu, forms, limits, double taps, quick entry, reports, clear-all dialog.
- [x] 6.11 `khata.app.test.tsx`: the real app against a real (fake) IndexedDB, through the whole journey and Urdu mode.
- [x] 6.12 Skeleton: `ui-kit.test.tsx`, `ui-nav.test.tsx`, `guard-and-clear.test.ts`, `date-range.test.ts`, `utils.test.ts`.

## Phase 7: Polish & Integration

- [x] 7.1 360px width, no horizontal overflow, every control at least 44px: checked on every screen in a real Chrome by `npm run e2e`.
- [x] 7.2 Urdu / RTL on every screen: mirrored navigation, `+` on the left, back button on the right, Nastaliq font loaded; checked by `npm run e2e` and reviewed in its screenshots.
- [x] 7.3 Offline end to end: reload, add customer, credit, payment, reversal, quick entry, CSV, reload and clear, all with the network off (`npm run e2e`).
- [x] 7.4 Demo mode walkthrough, including pressing it twice (`npm run e2e`, `khata.app.test.tsx`).
- [x] 7.5 WhatsApp / SMS links and messages (unit + screen tests). Opening WhatsApp itself needs a real phone.
- [x] 7.6 CSV download offline with UTF-8 BOM (`npm run e2e`).
- [x] 7.7 Shared code in `packages/skeleton` (utils, hooks, UI kit, theme).
- [x] 7.8 `npm run build` and `npm run typecheck`: zero errors, zero warnings.
- [x] 7.9 Committed.

## Phase 8: Submission polish

- [x] 8.1 Demo data loads at most once, with a message when it is already there.
- [x] 8.2 Clear all data, with a confirmation dialog.
- [x] 8.3 Floating `+` quick entry.
- [x] 8.4 Dashboard owing count; every top-debtor row opens the customer.
- [x] 8.5 Reports quick ranges, SVG chart, per-customer breakdown.
- [x] 8.6 Realistic Pakistani demo data.
- [x] 8.7 Logo (open ledger book) in the header, favicon and PWA icons (192, 512, maskable, Apple touch).
- [x] 8.8 One brand colour (indigo `brand-*` tokens); red for owed and green for received everywhere.
- [x] 8.9 Empty, loading and error states on every screen; phone shown as `0300-1234567`; subtle fade-in transitions (off with reduced motion).
- [x] 8.10 Urdu wording reviewed; the Nastaliq font is bundled and precached (no Google Fonts), and the saved language applies at startup.
- [x] 8.11 Unused code and dependencies removed (old style helpers, Vite template files, `@testing-library/jest-dom`, dead types, the remaining `any`).
- [x] 8.12 READMEs: root, `apps/khata`, `apps/clinic-queue`, `packages/skeleton`.
