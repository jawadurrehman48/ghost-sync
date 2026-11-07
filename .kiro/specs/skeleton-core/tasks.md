# Skeleton Core - Tasks

## Phase 1: Local Storage & DeviceId

- [ ] 1.1 Add `fake-indexeddb` to skeleton devDependencies (for Node-based Dexie tests). Also add `jsdom` and `@testing-library/react` to root devDependencies for DOM-environment tests (hooks, components, i18n). Install at root.
- [ ] 1.2 Update root `vitest.config.ts` to use `environment: 'jsdom'` so `window`, `navigator`, and `document` are available for hook/component/i18n tests.
- [ ] 1.3 Create `src/storage/types.ts`: `BaseRecord` (with `collection` field), `Record<P>`, `SyncedRow<P>`, generic collection type helpers.
- [ ] 1.4 Create `src/storage/deviceId.ts`: `getOrCreateDeviceId()` with localStorage + `crypto.randomUUID()` and fallback generator.
- [ ] 1.5 Create `src/storage/db.ts`: `createDatabase(config)` factory that dynamically declares Dexie tables from collection keys. Index `id` (pk), `createdAt`, `_syncStatus`. Internal `SyncedRow<P>` type.
- [ ] 1.6 Create `src/storage/store.ts`: `createStore(db, deviceId)` returning `{ add, query, getAllIds, getPending, markSynced, ingestPulled }`. `add` generates id/createdAt/deviceId/collection, inserts with `_syncStatus: 'pending'`, returns clean `Record<P>`. No update/delete methods exposed. Sync-internal methods (`getAllIds`, `getPending`, `markSynced`, `ingestPulled`) are available on the same object.
- [ ] 1.7 Create `src/storage/derive.ts`: `deriveState(records, reducer, initial?)` pure reducer fold.
- [ ] 1.8 Write unit tests for deviceId persistence (generated once, reused).
- [ ] 1.9 Write unit tests for Store: add returns full record with collection field, query returns ordered records, sync-internal methods work (getPending returns pending rows, markSynced updates status, ingestPulled routes by collection and is idempotent), no mutation API (update/delete) exists on the interface.
- [ ] 1.10 Write property-based test (fast-check) for `deriveState`: equals manual fold for arbitrary record lists and pure reducers.

## Phase 2: Sync Engine

- [ ] 2.1 Create `src/sync/types.ts`: `SyncStatus` discriminated union, `SyncStatusListener`.
- [ ] 2.2 Create `src/sync/status.ts`: `createSyncStatusStore(initial)` observable store with `get/set/subscribe`.
- [ ] 2.3 Create `src/sync/adapter.ts`: `SyncAdapter` interface + `InMemorySyncAdapter` class with shared Map, `push` (dedup by id), `pull` (exclude knownIds), `reset`, `size`.
- [ ] 2.4 Create `src/sync/engine.ts`: `createSyncEngine(config)` implementing the sync cycle (pull-then-push, idempotent merge, outbox status updates), concurrency guard, backoff retry, online/offline auto-trigger, `syncNow`, `subscribe`.
- [ ] 2.5 Write unit tests for InMemorySyncAdapter: push dedup, pull excludes known ids.
- [ ] 2.6 Write unit tests for sync engine: single sync cycle syncs pending, status transitions (pending -> syncing -> synced), offline guard, error triggers retry.
- [ ] 2.7 Write property-based test (fast-check) for sync convergence: N devices, arbitrary add/sync interleaving, all devices converge to the same record set, no loss, no duplication.

## Phase 3: Online Detection Hook

- [ ] 3.1 Create `src/hooks/useOnlineStatus.ts`: React hook subscribing to online/offline events, initializing from `navigator.onLine`.
- [ ] 3.2 Write unit tests for useOnlineStatus (simulate events, verify state updates).

## Phase 4: i18n & RTL Extension

- [ ] 4.1 Refactor `src/i18n/index.ts`: add `LANG_KEY` persistence, `getInitialLanguage`, `setLanguage`, `registerAppTranslations`, `LANGUAGES` const, `Language` type.
- [ ] 4.2 Create `src/i18n/useLanguage.ts`: hook returning `{ language, setLanguage, languages }`.
- [ ] 4.3 Update shared `en.json` / `ur.json` with skeleton-level UI keys (e.g. `sync.synced`, `sync.pending`, `sync.offline`, `sync.syncing`, `sync.error`, `language.toggle`).
- [ ] 4.4 Write unit tests: switching to ur sets dir=rtl + lang=ur and persists; switching to en sets dir=ltr + lang=en and persists; reload reads persisted lang.
- [ ] 4.5 Write unit tests for `registerAppTranslations`: app keys merge without overwriting skeleton keys.

## Phase 5: UI Shell Components

- [ ] 5.1 Create `src/ui/SyncStatusBadge.tsx`: pill component rendering status states with Tailwind logical classes, accessible label, 44px min touch target.
- [ ] 5.2 Create `src/ui/LanguageToggle.tsx`: button showing opposite language label, 44px min touch target, accessible.
- [ ] 5.3 Create `src/ui/AppShell.tsx`: sticky header (appName + SyncStatusBadge + LanguageToggle) + scrollable content area, mobile-first, RTL logical classes. Accepts `syncStatus`/`onSyncNow` and `language`/`onToggleLanguage` props.
- [ ] 5.4 Write component tests: AppShell renders appName and children, SyncStatusBadge shows correct text per status, LanguageToggle calls onToggle.

## Phase 6: Public API & Integration

- [ ] 6.1 Update `src/index.ts` barrel to export all modules: storage (types, store, derive, deviceId), sync (types, adapter, engine, status), hooks (useOnlineStatus), i18n (i18n, setLanguage, registerAppTranslations, useLanguage, LANGUAGES), ui (AppShell, SyncStatusBadge, LanguageToggle).
- [ ] 6.2 Verify both apps (khata, clinic-queue) can import a storage store and the UI shell from `@skeleton/core` without errors.
- [ ] 6.3 Run full test suite: `npm test` — all property and unit tests pass.
- [ ] 6.4 Run build: `npm run build` — skeleton compiles, both apps build.
- [ ] 6.5 Commit the completed skeleton core.
