# Skeleton Core - Design

## Architecture Overview

The skeleton core is a TypeScript package (`@skeleton/core`) organized into five modules that map directly to the five functional areas. Each module is independently structured so subpath imports could be added later (NFR-5). A thin barrel `index.ts` re-exports everything for convenience; note that the barrel has a side effect (i18n initialization on import).

```
packages/skeleton/src/
├── index.ts                  # barrel re-export
├── storage/                   # Module 1: local storage + deviceId
│   ├── types.ts
│   ├── db.ts                  # Dexie setup factory
│   ├── deviceId.ts
│   ├── store.ts               # generic typed store API
│   └── derive.ts             # deriveState reducer fold
├── sync/                      # Module 2: sync engine
│   ├── types.ts
│   ├── adapter.ts             # SyncAdapter interface + InMemorySyncAdapter
│   ├── engine.ts              # sync orchestration, outbox, retry
│   └── status.ts              # sync status type + store
├── hooks/                      # Module 3: online detection
│   └── useOnlineStatus.ts
├── i18n/                      # Module 4: i18n + RTL (existing, extended)
│   ├── index.ts               # init, setLanguage, registerAppTranslations
│   ├── locales/
│   │   ├── en.json
│   │   └── ur.json
│   └── useLanguage.ts         # hook for current language + toggle
└── ui/                        # Module 5: UI shell
    ├── AppShell.tsx
    ├── SyncStatusBadge.tsx
    └── LanguageToggle.tsx
```

---

## 1. Local Storage Design

### Data Model

All records share a base shape. Apps extend it with a typed payload.

```typescript
// storage/types.ts

export interface BaseRecord {
  id: string;            // UUID v4
  createdAt: string;     // ISO 8601
  deviceId: string;
  collection: string;     // name of the collection this record belongs to
}

export type Record<P> = BaseRecord & { payload: P };

// An app defines its collections:
//   interface KhataCollections {
//     transactions: { amount: number; customerId: string };
//     customers: { name: string; phone: string };
//   }
```

The `collection` field is set by the Store's `add` method from the collection key the caller passes. It is persisted in Dexie and carried through the sync adapter, so the sync engine knows which Dexie table to route a pulled record into.

### Database Initialization

The Dexie database is created via a factory so each app names its own DB and declares its collections. Collections are stored as Dexie tables where the row is the full `Record<P>` plus an internal `_syncStatus` field.

```typescript
// storage/db.ts

import Dexie, { Table } from 'dexie';

export interface SyncedRow<P> extends Record<P> {
  _syncStatus: 'pending' | 'synced';
}

export interface StorageConfig<C> {
  dbName: string;
  // collection name -> nothing (type info only); keys become table names
  collections: Record<keyof C, unknown>;
}

export function createDatabase<C>(config: StorageConfig<C>): Dexie & { [K in keyof C]: Table<SyncedRow<C[K]>, string> } {
  // Dynamically create Dexie tables from config.collections keys
  // Index: id (primary), createdAt, _syncStatus
}
```

The `_syncStatus` field lives in Dexie rows but is stripped from the `Record<P>` returned by the public API (read methods return `Record<P>`, never the internal row).

### Store API

```typescript
// storage/store.ts

export interface Store<C> {
  add<K extends keyof C>(collection: K, payload: C[K]): Promise<Record<C[K]>>;
  // Append-only: no update, no delete

  query<K extends keyof C>(collection: K): Promise<Record<C[K]>[]>;

  // --- Sync-internal methods (used by SyncEngine, not by apps) ---
  // Returns all record ids known locally, across all collections.
  getAllIds(): Promise<string[]>;
  // Returns all rows with _syncStatus 'pending', across all collections.
  getPending(): Promise<SyncedRow<unknown>[]>;
  // Marks the given ids as 'synced' in Dexie.
  markSynced(ids: string[]): Promise<void>;
  // Inserts a record from sync pull into the table matching its collection field.
  // Idempotent: if the id already exists, the row is skipped.
  ingestPulled(record: SyncedRow<unknown>): Promise<void>;
}

export function createStore<C>(db, deviceId: string): Store<C>
```

- `add` generates id + createdAt + deviceId + collection (from the key), inserts with `_syncStatus: 'pending'`, returns the clean `Record<P>`.
- `query` returns records ordered by `createdAt` ascending, strips `_syncStatus`.
- `getAllIds` iterates all Dexie tables and collects primary keys.
- `getPending` queries each table by `_syncStatus: 'pending'` and concatenates results.
- `markSynced` bulk-updates the `_syncStatus` field on matching rows across all tables.
- `ingestPulled` reads `record.collection`, gets the corresponding Dexie table, and does a `put` only if the id doesn't already exist (idempotent).

### DeviceId

```typescript
// storage/deviceId.ts

const STORAGE_KEY = 'ghost-sync-device-id';

export function getOrCreateDeviceId(): string {
  // Check localStorage; if absent, generate UUID v4 and store it.
}
```

Uses `crypto.randomUUID()` (available in modern browsers and test environments). Falls back to a manual RFC4122 v4 generator if `crypto.randomUUID` is undefined.

### State Derivation

```typescript
// storage/derive.ts

export type Reducer<P, S> = (state: S | undefined, record: Record<P>) => S;

export function deriveState<P, S>(records: Record<P>[], reducer: Reducer<P, S>, initial?: S): S {
  return records.reduce((acc, r) => reducer(acc, r), initial);
}
```

This is a pure function with no Dexie dependency, making it trivial to property-test.

---

## 2. Sync Engine Design

### SyncAdapter Interface

```typescript
// sync/adapter.ts

export interface SyncAdapter<P = any> {
  // Push records this device hasn't synced yet; returns ids accepted.
  push(records: Record<P>[]): Promise<string[]>;
  // Pull all records the backend knows about, optionally since a cursor.
  // Returns records this device does NOT already have (adapter does dedup).
  pull(knownIds: string[]): Promise<Record<P>[]>;
}
```

The adapter is generic over `P` but operates on the full `Record<P>` which includes the `collection` field. This lets the sync engine route pulled records back to the correct Dexie table. All collections share one adapter instance — records from different collections are stored together in the adapter keyed by id.

### In-Memory Mock Adapter

```typescript
// sync/adapter.ts

export class InMemorySyncAdapter implements SyncAdapter {
  private store = new Map<string, Record<any>>();  // id -> record, shared cloud

  async push(records: Record<any>[]): Promise<string[]> {
    // Insert records not already in store; return newly added ids
  }

  async pull(knownIds: string[]): Promise<Record<any>[]> {
    // Return all records whose id is NOT in knownIds
  }

  // Test helpers
  reset(): void { this.store.clear(); }
  size(): number { return this.store.size; }
}
```

This simulates a shared backend. Multiple engine instances pointed at the same `InMemorySyncAdapter` instance simulate multiple devices.

### Sync Status

```typescript
// sync/status.ts

export type SyncStatus =
  | { state: 'synced' }
  | { state: 'pending'; count: number }
  | { state: 'syncing' }
  | { state: 'offline' }
  | { state: 'error'; message: string };

export type SyncStatusListener = (status: SyncStatus) => void;

export function createSyncStatusStore(initial: SyncStatus): {
  get: () => SyncStatus;
  set: (s: SyncStatus) => void;
  subscribe: (fn: SyncStatusListener) => () => void;
}
```

A lightweight observable store (no external dependency) so React components can subscribe.

### Sync Engine

```typescript
// sync/engine.ts

export interface SyncEngineConfig {
  adapter: SyncAdapter;
  store: Store<any>;
  maxRetries: number;       // default 5
  baseDelayMs: number;      // default 1000
  maxDelayMs: number;       // default 30000
}

export function createSyncEngine(config: SyncEngineConfig): {
  syncNow: () => Promise<void>;
  getStatus: () => SyncStatus;
  subscribe: (fn: SyncStatusListener) => () => void;
  start: () => void;   // begins listening to online/offline for auto-sync
  stop: () => void;
}
```

**Sync cycle algorithm:**

```
1. If offline -> status 'offline', return.
2. If already syncing -> return (guard against concurrent cycles).
3. Set status 'syncing'.
4. Pull phase:
   a. knownIds = Store.getAllIds()
   b. pulled = adapter.pull(knownIds)
   c. For each pulled record: Store.ingestPulled(record) (routes by collection field; idempotent).
5. Push phase:
   a. pending = Store.getPending()
   b. accepted = adapter.push(pending)
   c. Store.markSynced(accepted)
6. If success -> compute pending count; if 0 -> 'synced', else -> 'pending'.
7. On error:
   a. Set status 'error' with message.
   b. Schedule retry with backoff: delay = min(baseDelayMs * 2^attempt, maxDelayMs).
   c. Retry up to maxRetries. After maxRetries, remain in 'error' until manual trigger or online event.
   d. Retries do NOT re-push already-synced records (they're marked 'synced').
```

**Concurrency safety:** A module-level `isSyncing` boolean guards against concurrent cycles. Pushed records that the adapter already has (deduped by id) are still marked synced — idempotent.

**Offline-to-online trigger:** The engine listens to `window.addEventListener('online', ...)` and calls `syncNow()` when it fires. The engine also calls `syncNow()` once on `start()` if online.

### Why no conflicts

Because records are append-only and keyed by UUID, two devices can never create the same id. The merge is a simple set union by id. Pull dedups against local ids; push dedups against the adapter's ids. No field-level merge needed (C-3).

---

## 3. Online/Offline Detection Design

```typescript
// hooks/useOnlineStatus.ts

import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
```

No external dependency. The sync engine uses the same browser events independently (not via this hook) so it works without React.

---

## 4. i18n and RTL Design

### Extension of Existing Setup

The current `i18n/index.ts` initializes i18next with en/ur. We extend it with:

1. **Persistence:** Read/write `localStorage` key `ghost-sync-lang`.
2. **App translation registration:** A function to merge app keys.

```typescript
// i18n/index.ts (extended)

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ur from './locales/ur.json';

const LANG_KEY = 'ghost-sync-lang';
export const LANGUAGES = ['en', 'ur'] as const;
export type Language = typeof LANGUAGES[number];

function getInitialLanguage(): Language {
  const stored = typeof localStorage !== 'undefined'
    ? localStorage.getItem(LANG_KEY) as Language | null
    : null;
  return stored && LANGUAGES.includes(stored) ? stored : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ur: { translation: ur } },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng: Language) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = lng === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LANG_KEY, lng);
  }
});

export function setLanguage(lng: Language): void {
  i18n.changeLanguage(lng);
}

export function registerAppTranslations(translations: Partial<Record<Language, Record<string, string>>>): void {
  // Merge app keys into i18next resources under 'translation' namespace.
  // App keys are added with a prefix or namespaced to avoid overwriting skeleton keys.
  // Use i18n.addResourceBundle for each language.
  for (const [lng, keys] of Object.entries(translations)) {
    i18n.addResourceBundle(lng, 'translation', keys, /* deep */ true, /* overwrite */ false);
  }
}

export function useLanguage(): { language: Language; setLanguage: (l: Language) => void; languages: readonly Language[] } {
  // Wraps useTranslation to return current lang + setter
}

export default i18n;
```

**Key precedence:** `addResourceBundle` with `overwrite: false` means existing keys are preserved. Skeleton keys loaded first win; app keys fill gaps. If an app needs its own namespace, it can pass a namespaced object (e.g. `{ "khata.title": "..." }`).

---

## 5. UI Shell Design

All components use Tailwind v4 logical properties for RTL. Mobile-first.

### AppShell

```typescript
// ui/AppShell.tsx

interface AppShellProps {
  appName: string;
  children: React.ReactNode;
  // Sync status is obtained via props (app subscribes to SyncEngine and passes status).
  syncStatus?: SyncStatus;
  onSyncNow?: () => void;
  // Language is obtained via props (app passes from useLanguage or equivalent).
  language?: Language;
  onToggleLanguage?: () => void;
}
```

Layout:
```
┌─────────────────────────────────┐
│ [appName]    [sync badge] [🌐] │  <- header (sticky, h-14)
├─────────────────────────────────┤
│                                 │
│         children                │  <- content (flex-1, overflow-y-auto)
│                                 │
└─────────────────────────────────┘
```

- Header: `sticky top-0`, `h-14`, flex with `justify-between`, `ps-4 pe-4`.
- App name: `font-semibold`, `truncate`.
- Right cluster: `SyncStatusBadge` + `LanguageToggle`, gap via `gap-2`.
- Content area: `flex-1`, `overflow-y-auto`, `p-4`.
- All spacing uses logical properties (`ps`, `pe`, `ms`, `me`).

### SyncStatusBadge

```typescript
// ui/SyncStatusBadge.tsx

interface SyncStatusBadgeProps {
  status: SyncStatus;
  onClick?: () => void;  // triggers manual sync
}
```

Renders a compact pill:
- `offline` → gray dot + "Offline"
- `pending` → amber dot + "{n} pending"
- `syncing` → blue spinner + "Syncing"
- `synced` → green dot + "Synced"
- `error` → red dot + "Error"

Clickable if `onClick` provided and status is not `syncing`. Min touch target 44x44.

### LanguageToggle

```typescript
// ui/LanguageToggle.tsx

interface LanguageToggleProps {
  language: Language;
  onToggle: () => void;
}
```

A button showing the opposite language label: when `en` is active, shows "اردو"; when `ur` active, shows "English". Min touch target 44x44.

---

## Error Handling

- **Storage:** Dexie operations can reject (quota, corruption). `add` and `query` propagate rejections; the app decides how to surface them.
- **Sync:** Adapter failures are caught by the engine, trigger error status + retry. After exhausting retries, the engine stays in `error` until the next manual `syncNow()` or `online` event.
- **deviceId:** localStorage may be unavailable (private mode). `getOrCreateDeviceId` falls back to an in-memory UUID generated per session (sync will still work within the session; persistence loss is acceptable for the edge case).

---

## Dependency Notes

- **Dexie** provides IndexedDB access with a clean Table API and is testable in-memory via `fake-indexeddb` (dev dependency for tests).
- **i18next / react-i18next** already installed and initialized; we extend the existing module.
- **No new runtime dependencies** are needed for sync, hooks, or UI. `SyncStatusStore` is hand-rolled (no external state library).
- **Test deps to add:** `fake-indexeddb` for Dexie tests in Node environment, `jsdom` for DOM-environment tests (hooks, components, i18n), and `@testing-library/react` for rendering React hooks/components in tests. The root vitest config SHALL use `environment: 'jsdom'` so that `window`, `navigator`, and `document` are available. Node-only tests (property tests for sync/derive) work fine in jsdom as well.

---

## Sequence Diagrams

### Add Record Flow

```
App -> Store.add(collection, payload)
  Store generates { id, createdAt, deviceId, payload }
  Store -> Dexie.put(row with _syncStatus: 'pending')
  Store -> returns Record<P> to App
```

### Sync Cycle Flow

```
Engine.syncNow()
  -> guard: if offline -> set 'offline', return
  -> guard: if syncing -> return
  -> set 'syncing'
  -> knownIds = Store.getAllIds()
  -> pulled = adapter.pull(knownIds)
  -> for each in pulled: Store.ingestPulled(record) (routes by collection field)
  -> pending = Store.getPending()
  -> accepted = adapter.push(pending)
  -> Store.markSynced(accepted)
  -> recompute pending count -> set 'synced' or 'pending'
  -> on error: set 'error', schedule backoff retry
```
