# Khata: a digital udhaar book

Khata is an offline-first credit ledger for small kiryana shops in Pakistan. It replaces the paper notebook a shopkeeper uses to track what each customer owes.

## The problem

Most neighbourhood shops sell on credit (udhaar). The record is a paper notebook: pages tear, totals are added by hand, and when a customer disputes an amount there is no clear history. Digital ledgers exist, but most assume steady internet, English, and a recent phone. The shopkeepers this is for have cheap Android phones (about 360px wide), patchy mobile data, daily power cuts, and many prefer Urdu.

Khata is built for exactly that phone:

- **Fully offline.** Every screen and action works with no internet after the first visit.
- **Never loses data.** Every entry is saved on the phone first, and nothing is ever edited or deleted. A mistake is fixed by adding a reversal, so the full history stays visible.
- **English and Urdu.** One tap switches language, with a right-to-left layout and the Noto Nastaliq Urdu font, bundled so it works offline too.
- **Exact money.** Amounts are stored as whole paisa, so balances never drift by a rounding error.

## Features

| Area | What you can do |
| --- | --- |
| **Dashboard** | Total outstanding, how many customers owe, credit given and payments received today, and the five customers who owe the most (tap one to open it). A friendly welcome on an empty shop. |
| **Quick entry (+)** | The floating button on Home and Customers: search for a customer, pick Credit Given or Payment Received, type the amount, save. |
| **Customers** | Search by name or phone, highest balance first. Red means the customer owes, green means settled or paid in advance, and a word next to each amount (Owes / Settled / Advance) so colour is never the only signal. |
| **Add or edit a customer** | Name required, Pakistani mobile number optional and validated (shown as `0300-1234567`, stored unformatted), note optional. A second customer with the same name and number is refused. |
| **Customer page** | Balance, Credit Given / Payment Received, full history with running balance, and WhatsApp or SMS payment reminders in the current language. |
| **Correct a mistake** | Reverse any entry with a reason. It stays in the history, struck through, and stops counting. It can't be reversed twice. |
| **Reports** | Today / This Week / This Month or any date range: credit, payments and net, a bar chart per day (plain SVG, no chart library), and a per-customer breakdown. |
| **Settings** | Shop name, language, download everything as CSV (opens correctly in Excel, Urdu included), load demo data (only once), and clear all data behind a confirmation. |

Protection against bad input: amounts must be whole rupees from Rs 1 to Rs 999,999,999 (Urdu digits accepted), names and notes have length limits, and a double tap on any Save records only one entry. The ledger also ignores corrupt records, so a bad amount can never turn a balance into `NaN`.

## How it is built on `@skeleton/core`

Khata has **no** storage, sync, i18n or network code of its own. Everything comes from the shared skeleton in `packages/skeleton`:

| Khata needs | It uses |
| --- | --- |
| Local database and append-only records | `createDatabase`, `createStore` (`khata.db.ts`, `khata.store.ts`) |
| Background sync (Supabase or local-only), retry, offline status | `createCloudSync`, `syncSetupFromEnv`, `SyncStatusBadge` |
| Pairing phones: sync code, QR, join | `SyncDevicesSection` |
| Screens that refresh after writes and sync | `useStoreSnapshot` |
| English / Urdu and right-to-left layout | `registerAppTranslations`, `useTranslation`, `setLanguage`, `useLanguage` |
| Money, phone and date helpers | `formatPaisa`, `parseWholeRupees`, `formatPhone`, `validatePakistaniPhone`, `todayISO`, `weekRange`, `monthRange` |
| UI | `AppShell`, `BottomNav`, `ScreenHeader`, `Button`, `Card`, `TextField`, `ConfirmDialog`, `EmptyState`, `FloatingActionButton`, `Notice`, `LoadingState`, `ErrorBoundary`, `GroupedBarChart` |
| Theme and offline Urdu font | `packages/skeleton/src/theme.css` |

What is Khata-specific:

```
src/
├── khata.types.ts      # the six record types (customerCreated, creditGiven, entryReversed, ...)
├── khata.reducers.ts   # pure functions that derive balances, dashboard and reports from the records
├── khata.limits.ts     # input limits (name, note, amount)
├── i18n/en.json, ur.json
├── utils/              # WhatsApp/SMS reminder links, CSV export, demo data
├── components/         # Money (red/green amounts), EntryForm, Logo, icons
└── screens/            # Dashboard, CustomerList, AddCustomer, CustomerDetail, AddEntry,
                        # QuickEntry, ReverseEntry, Reports, Settings
```

The state model is simple: the app stores **events**, never totals. A balance is always recomputed from the records, so two phones that sync in any order end up showing the same numbers.

## Run it

From the repository root:

```bash
npm install
npm run dev:khata          # http://localhost:5173
```

In the app, go to **Settings → Load Demo Data** to fill it with a realistic sample shop: eight customers, a month of entries, one reversed mistake, one settled customer and one who paid in advance.

## Test it

```bash
npm test                   # unit + property-based tests (Vitest + fast-check), skeleton and Khata
npm run typecheck          # strict type-check of the test code
npm run build              # type-checks and builds every workspace
```

The ledger rules (balances, reversals, sync order, dashboard and report totals, no rounding errors) are checked with property-based tests over thousands of generated cases.

## Test it offline (real browser)

The service worker only runs in a production build:

```bash
npm run build --workspace=apps/khata
npm run preview --workspace=apps/khata -- --port 4173 --strictPort
```

Then either:

**By hand.** Open http://localhost:4173 in Chrome and wait a moment so the service worker can cache the app. In DevTools → Network, choose **Offline** and reload. The app still opens, and you can add customers, record entries, reverse one, use quick entry and download the CSV. Switch to Urdu and confirm the Nastaliq font still shows. DevTools → Application → Manifest shows the icons, and Chrome offers **Install**.

**Automatically.** With the preview still running:

```bash
npm run e2e
```

`scripts/e2e-khata.mjs` drives your installed Chrome at a 360px phone size. It checks the service worker and precache, the manifest and icons, demo data loading only once, every screen in English and Urdu (no sideways scrolling, every control at least 44px, RTL mirroring, the Urdu font), and then a full offline session. Screenshots are saved to `e2e-output/`.

## Install on an Android phone

Serve the production build on your network (`npm run preview --workspace=apps/khata -- --host`) and open the address in Chrome on the phone. Use **Add to Home screen** (or the install banner). Chrome only allows installation on `https://` or `localhost`, so for a real phone use an HTTPS host or a tunnel. After the first visit the app works with mobile data turned off.

## Limits and next steps

- **Cloud sync is optional.** With `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see the [root README](../../README.md#cloud-sync-with-supabase-optional)), phones paired in **Settings → Sync devices** share their data through Supabase. Without them the app is local-only (badge "Local only") and the CSV download is the backup.
- "Clear all data" deletes data on this phone only.
