# @skeleton/core

A reusable, app-agnostic foundation for offline-first PWAs that work on cheap Android phones with unreliable internet.

## What It Provides

| Module | What You Get |
|--------|-------------|
| **storage** | Append-only local storage via Dexie/IndexedDB with typed records, UUIDs, timestamps, and a deviceId per device |
| **sync** | Outbox queue, pluggable SyncAdapter, in-memory mock adapter, retry with backoff, online/offline auto-sync |
| **hooks** | `useOnlineStatus` React hook for online/offline detection |
| **i18n** | English/Urdu with RTL, persistent language selection, per-app translation registration |
| **ui** | `AppShell`, `SyncStatusBadge`, `LanguageToggle` — mobile-first, RTL-aware Tailwind components |

## Quick Start

### 1. Define your record types

```typescript
// types.ts in your app
export type AppCollections = {
  customers: { name: string; phone: string };
  transactions: { customerId: string; amount: number }; // amount in paisa
};
```

Use `type` not `interface` so the generic constraints resolve cleanly.

### 2. Write a reducer to derive state

```typescript
import { deriveState, type SkeletonRecord } from '@skeleton/core';

// Derive a customer's balance from their transaction records
function balanceReducer(state: number | undefined, record: SkeletonRecord<{ customerId: string; amount: number }>) {
  return (state ?? 0) + record.payload.amount;
}

const records = await store.query('transactions');
const balance = deriveState(records, balanceReducer, 0);
```

### 3. Initialize storage and sync

```typescript
import {
  createDatabase, createStore, getOrCreateDeviceId,
  createSyncEngine, InMemorySyncAdapter,
} from '@skeleton/core';

const deviceId = getOrCreateDeviceId();
const db = createDatabase<AppCollections>({
  dbName: 'my-app',
  collections: { customers: undefined, transactions: undefined },
});
const store = createStore(db, deviceId);

const adapter = new InMemorySyncAdapter(); // swap with Supabase adapter later
const engine = createSyncEngine({ adapter, store });

// Start auto-sync on online/offline events
engine.start();
```

### 4. Register your translations

```typescript
import { registerAppTranslations } from '@skeleton/core';

registerAppTranslations({
  en: { 'app.title': 'My App', 'app.addCustomer': 'Add Customer' },
  ur: { 'app.title': 'میری ایپ', 'app.addCustomer': 'گاہک شامل کریں' },
});
```

Skeleton keys (sync status, language) are already included. Your app keys merge on top without overwriting skeleton keys.

### 5. Use the AppShell

```tsx
import { AppShell, useLanguage, setLanguage } from '@skeleton/core';

function App() {
  const { language } = useLanguage();

  return (
    <AppShell
      appName="My App"
      syncStatus={engine.getStatus()}
      onSyncNow={() => engine.syncNow()}
      language={language}
      onToggleLanguage={() => setLanguage(language === 'en' ? 'ur' : 'en')}
    >
      <YourScreens />
    </AppShell>
  );
}
```

## Public API

### Storage

- `getOrCreateDeviceId()` — persistent UUID per device
- `createDatabase(config)` — Dexie database factory
- `createStore(db, deviceId)` — append-only store with `add`, `query`, plus sync-internal methods
- `deriveState(records, reducer, initial?)` — fold records into derived state

### Sync

- `createSyncEngine(config)` — returns `{ syncNow, getStatus, subscribe, start, stop }`
- `InMemorySyncAdapter` — mock adapter for dev/tests
- `SyncAdapter` interface — implement for real backends (Supabase, etc.)

### i18n

- `setLanguage(lng)` — switch between 'en' and 'ur'
- `registerAppTranslations(translations)` — add app-specific keys
- `useLanguage()` — React hook returning current language + setter

### UI

- `AppShell` — header (app name + sync badge + language toggle) + scrollable content
- `SyncStatusBadge` — pill showing synced/pending/syncing/offline/error
- `LanguageToggle` — button switching English ↔ Urdu

## Testing

The skeleton includes property-based tests (fast-check) proving sync convergence across multiple devices. Run:

```bash
npm test
```

## Shared utilities, hooks and shell components

Anything two apps would both need lives here. Import all of it from `@skeleton/core`.

### Formatting, validation and dates

```typescript
import {
  formatPaisa, parseWholeRupees, paisaFromRupees,   // money
  validatePakistaniPhone, normalizePhone,           // phone
  todayISO, formatDateDMY, isValidISODate, monthRange, // dates
  toAsciiDigits,                                    // Urdu digits -> 0-9
} from '@skeleton/core';

formatPaisa(245050);              // "Rs 2,450.50"  (integer maths, same on every device)
parseWholeRupees('۲۵۰۰');          // 2500  (accepts Urdu digits, commas, spaces; null if invalid)
paisaFromRupees(2500);            // 250000
validatePakistaniPhone('0300-1234567'); // true
todayISO();                       // local "YYYY-MM-DD" (not the UTC day)
formatDateDMY('2026-10-15');      // "15/10/2026"
monthRange();                     // { from: '2026-11-01', to: '2026-11-30' }
```

### `useStoreSnapshot`: keep screens in sync with the local store

```tsx
const { data, error, reload } = useStoreSnapshot(loadEverything, { engine });
// after any write:  await store.add(...);  await reload();
```

Loads once, reloads on demand, and (when you pass the sync engine) reloads whenever
sync activity changes the data. Stale overlapping loads are dropped.

### `useTranslation`

Re-exported from `@skeleton/core` so apps never import `react-i18next` themselves.

### `BottomNav` and `ScreenHeader`

```tsx
<BottomNav
  items={[{ key: 'home', label: t('nav.home'), icon: <HomeIcon /> }, /* ... */]}
  active={tab}
  onSelect={setTab}
  ariaLabel={t('nav.label')}
/>

<ScreenHeader title={t('customers.title')} onBack={goBack} backLabel={t('common.back')} />
```

Both use logical Tailwind classes and 44px+ touch targets; the back chevron mirrors in RTL.
`AppShell` renders a phone-width column (`max-w-md`) centred on desktop screens.
Leave about `pb-24` under your content when using `BottomNav`.

### Rules every app follows

- All data goes through `createStore` / `deriveState` / `createSyncEngine`. No IndexedDB, no `fetch`.
- Records are append-only. Fix mistakes with a reversal record, never an edit or delete.
- Money is integer paisa. Dates are local `YYYY-MM-DD`.
- Every string is an i18n key in both `en.json` and `ur.json`. Layout uses `ms-`/`me-`/`ps-`/`pe-`/`text-start`/`text-end`.
- Add `@source "../../../packages/skeleton/src";` to the app's `index.css`.

See `apps/khata` for a complete app built this way.
