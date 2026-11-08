# Monorepo Structure

```
ghost-sync/
├── package.json              # Root workspace config (workspaces: packages/*, apps/*)
├── vitest.config.ts          # Vitest config (jsdom env, React plugin, fake-indexeddb setup)
├── tests/                    # Root-level test suite
│   ├── setup.ts              # fake-indexeddb/auto for Dexie in Node
│   ├── store.test.ts         # Storage unit tests
│   ├── engine.test.ts        # Sync engine unit tests
│   ├── sync-convergence.test.ts  # Property-based sync convergence (fast-check)
│   └── ...                   # deviceId, adapter, derive, i18n, ui, useOnlineStatus tests
│
├── packages/
│   └── skeleton/             # @skeleton/core — shared library
│       ├── package.json      # name: @skeleton/core, deps: dexie, i18next, react-i18next
│       ├── tsconfig.json
│       ├── README.md         # How to build an app on the skeleton
│       └── src/
│           ├── index.ts      # Barrel export — all public API
│           ├── storage/      # Local storage + deviceId
│           │   ├── types.ts      # BaseRecord, Record<P>, SyncedRow<P>, Collections
│           │   ├── db.ts         # createDatabase() — Dexie factory
│           │   ├── store.ts      # createStore() — append-only store + sync-internal methods
│           │   ├── deviceId.ts   # getOrCreateDeviceId() — persistent UUID per device
│           │   └── derive.ts     # deriveState() — pure reducer fold
│           ├── sync/          # Sync engine
│           │   ├── types.ts      # SyncStatus, SyncEngineConfig, SyncEngine
│           │   ├── status.ts     # createSyncStatusStore() — observable
│           │   ├── adapter.ts    # SyncAdapter interface + InMemorySyncAdapter
│           │   └── engine.ts      # createSyncEngine() — pull/push/backoff/auto-sync
│           ├── hooks/
│           │   └── useOnlineStatus.ts  # React hook for online/offline
│           ├── i18n/
│           │   ├── index.ts      # i18n init, setLanguage, registerAppTranslations
│           │   ├── useLanguage.ts # React hook for language state
│           │   └── locales/
│           │       ├── en.json   # Shared skeleton keys (English)
│           │       └── ur.json   # Shared skeleton keys (Urdu)
│           └── ui/               # UI shell components
│               ├── AppShell.tsx       # Header + content area
│               ├── SyncStatusBadge.tsx # Sync status pill
│               └── LanguageToggle.tsx  # EN ↔ UR toggle
│
├── apps/
│   ├── khata/                # Credit ledger app
│   │   ├── package.json      # deps: @skeleton/core, react, react-dom
│   │   ├── vite.config.ts    # React + PWA + Tailwind plugins
│   │   └── src/
│   │       ├── main.tsx      # Entry point
│   │       ├── App.tsx       # Root component (currently demo page)
│   │       └── index.css     # @import "tailwindcss" + @source skeleton
│   │
│   └── clinic-queue/         # Patient token app
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── App.tsx       # Root component (placeholder)
│           └── index.css
│
└── .kiro/
    ├── steering/             # This folder — always-included project rules
    │   ├── product.md
    │   ├── tech.md
    │   └── structure.md
    └── specs/                # Feature specs
        ├── skeleton-core/    # Skeleton implementation spec (complete)
        └── khata-app/        # Khata app spec (pending implementation)
```

## Rules

1. **Code useful to both apps belongs in `packages/skeleton`.** If khata and clinic-queue would both use it, it goes in the skeleton. App-specific logic (record types, reducers, screens) stays in the app.

2. **Apps never import from each other.** `apps/khata` cannot import from `apps/clinic-queue` and vice versa. Shared code goes through `@skeleton/core`.

3. **Each app registers its own translations.** Apps call `registerAppTranslations()` at startup with their app-specific keys. Skeleton keys are shared and included automatically. App keys cannot overwrite skeleton keys.

4. **Each app's `index.css` must include the skeleton source path** so Tailwind scans skeleton components for class names:
   ```css
   @import "tailwindcss";
   @source "../../../packages/skeleton/src";
   ```
   Without this, skeleton UI components (AppShell, SyncStatusBadge, LanguageToggle) will render unstyled.

5. **The barrel `packages/skeleton/src/index.ts` exports everything.** Apps import from `@skeleton/core` — they should not need to reach into internal module paths.
