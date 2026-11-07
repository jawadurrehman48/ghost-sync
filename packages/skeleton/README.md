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
