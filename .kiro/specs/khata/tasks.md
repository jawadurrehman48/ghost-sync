# Khata - Tasks

Legend: `[x]` done and covered by tests/build. `[ ]` needs a human in a real browser (see checklist at the end).

## Phase 1: Types, DB, Store & Reducers

- [x] 1.1 `khata.types.ts`: `KhataCollections` (six collections, money as `amountPaisa`), derived-state types, plus `KhataData`, `KhataDerived`, `Screen`, `ReportTotals`, `CustomerRow`.
- [x] 1.2 `khata.db.ts`: `createDatabase<KhataCollections>` with `dbName: 'khata'`.
- [x] 1.3 `khata.store.ts`: `createStore` + `createSyncEngine({ adapter: new InMemorySyncAdapter(), store })`.
- [x] 1.4 `khata.reducers.ts`: `deriveCustomerList`, `deriveCustomerInfo`, `deriveBalance` (order-independent reversal; total order on `createdAt` then `id`), `deriveBalanceMap`, `deriveSettings`, `deriveDashboard`, `deriveReport`, `filterCustomers`, `deriveAll`.
- [x] 1.5 Money helpers (`formatPaisa`, `paisaFromRupees`, plus `parseWholeRupees`). **Moved straight into `packages/skeleton/src/utils/money.ts`** (C-5). Uses integer arithmetic and its own thousand-separator grouping, not `toLocaleString`.
- [x] 1.6 Phone helpers (`validatePakistaniPhone`, `normalizePhone`). **Moved straight into `packages/skeleton/src/utils/phone.ts`.** Also accepts Urdu digits.

## Phase 2: i18n Translations

- [x] 2.1 `i18n/en.json`, every `khata.*` key. No hard-coded English in JSX (enforced by `tests/khata.architecture.test.ts`).
- [x] 2.2 `i18n/ur.json`, same keys, simple Urdu. Key parity and placeholder parity enforced by `tests/i18n-keys.test.ts`.
- [x] 2.3 `main.tsx` calls `registerAppTranslations({ en, ur })` before render.

## Phase 3: Utility Functions

- [x] 3.1 `utils/reminder.ts`: `buildWhatsAppUrl`, `buildSmsUrl`, `buildSmsMessage`.
- [x] 3.2 `utils/csv.ts`: `buildCsvString`, `buildCsvBlob` (UTF-8 BOM, shop name header, spreadsheet-formula protection), `collectExportRows`, `downloadCsvBlob`.
- [x] 3.3 `utils/demo.ts`: `loadDemoData(store)`: 5 customers, one reversal, owing / settled / advance, uses local dates.

## Phase 4: Screens

- [x] 4.1 `DashboardScreen`: total outstanding, today's credit and payments, top-5 debtors (tap opens customer).
- [x] 4.2 `CustomerListScreen`: search by name/phone, highest balance first, red/green plus a word (Owes / Settled / Advance).
- [x] 4.3 `AddCustomerScreen`: name required, phone validated. Also edits (saves only changed fields as `customerUpdated`).
- [x] 4.4 `CustomerDetailScreen`: balance, Credit/Payment buttons, WhatsApp + SMS reminder links (only when owing and phone set), full history with running balance, "Correct Mistake".
- [x] 4.5 `AddEntryScreen`: 56px numeric field (Urdu digits accepted), live "Rs" preview, note, date defaulting to today.
- [x] 4.6 `ReverseEntryScreen`: shows original entry, reason required, no double reversal.
- [x] 4.7 `ReportsScreen`: date range (default current month), credit / payments / net. **Net = payments − credit** per FR-8.2 (the design mock-up showed the opposite sign).
- [x] 4.8 `SettingsScreen`: shop name, language radios, CSV download, demo data behind an in-page confirmation.

## Phase 5: App Root & Navigation

- [x] 5.1 `App.tsx` replaces the demo page: `AppShell`, bottom navigation (4 tabs), screen routing, browser-history integration so the Android back button steps back through screens.
- [x] 5.2 Engine start/stop in an effect; sync status in the header; `useStoreSnapshot` reloads after writes and sync; "today" refreshes past midnight.
- [x] 5.3 Logical Tailwind classes everywhere. `tests/khata.rtl.test.ts` fails on any `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right`.

## Phase 6: Tests

- [x] 6.1 `khata.balance.test.ts`: TR-1, TR-2 (incl. identical timestamps and reversal-before-entry clock skew), TR-3, TR-5. BigInt oracle.
- [x] 6.2 `khata.dashboard.test.ts`: TR-4, plus report totals/monotonicity/additivity, search and sort, customer updates, settings.
- [x] 6.3 `khata.reminder.test.ts`: TR-6 (English, Urdu, encoding of any name, phone conversion).
- [x] 6.4 `khata.phone.test.ts`: TR-7.
- [x] 6.5 `khata.csv.test.ts`: TR-8, plus a quoting round-trip property test and formula-injection protection.
- [x] 6.6 `khata.reversal.test.ts`: TR-9.
- [x] 6.7 `khata.demo.test.ts`: TR-10 against a real (fake-indexeddb) database, exact expected balances.
- [x] 6.8 Full `npm test` passes. Additional suites: `khata.screens.test.tsx` (every screen in English and Urdu, forms, reminders, reversal rules, export, demo), `khata.architecture.test.ts` (NFR-7), `khata.performance.test.ts` (NFR-2), `utils.test.ts`, `i18n-keys.test.ts`, `ui-nav.test.tsx`.

## Phase 7: Polish & Integration

- [ ] 7.1 360px width, no horizontal overflow. Needs a real browser. (Touch-target classes are asserted in tests.)
- [ ] 7.2 Urdu / RTL look of every screen. Needs a real browser. (No physical-direction classes, `dir`/`lang` switching and no missing keys are asserted in tests.)
- [ ] 7.3 Offline use end to end. Needs a real browser: `npm run build`, then `npm run preview`, then set DevTools to Offline.
- [ ] 7.4 Demo mode walkthrough. (Data integrity and the confirmation flow are covered by tests.)
- [ ] 7.5 WhatsApp opens with the pre-filled message. (Link and message are covered by tests.)
- [ ] 7.6 CSV opens correctly in Excel/Sheets. (Content, BOM and quoting are covered by tests.)
- [x] 7.7 Money and phone helpers live in `packages/skeleton/src/utils/` and are exported from `@skeleton/core` (done in Phase 1; also added date helpers and `toAsciiDigits`).
- [x] 7.8 `npm run build`: skeleton compiles, Khata builds under `strict: true`.
- [x] 7.9 Committed.

## Added during implementation

- PWA installability: the manifest referenced icons that did not exist. Generated 192, 512, maskable and Apple touch icons for both apps; manifest now has `start_url`, `scope`, maskable icon, theme colour; service worker precaches them and has a navigation fallback.
- `strict: true` turned on for `apps/khata` (steering requires strict TypeScript).
- Skeleton additions for reuse by clinic-queue: `utils/*`, `useStoreSnapshot`, `BottomNav`, `ScreenHeader`, `useTranslation` re-export; `LanguageToggle` aria-label now translated.
- Urdu translation fixes: "غلطی ٹھکریں" → "غلطی درست کریں", "منسوخری" → "منسوخی".
