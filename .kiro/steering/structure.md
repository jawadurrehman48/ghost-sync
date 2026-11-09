# Monorepo Structure

```
ghost-sync/
├── package.json              # Root workspace config (workspaces: packages/*, apps/*)
├── vitest.config.ts          # Vitest config (jsdom env, React plugin, fake-indexeddb setup)
├── tests/                    # Root-level test suite (skeleton + khata)
│   ├── setup.ts              # fake-indexeddb/auto for Dexie in Node
│   ├── store / engine / adapter / sync-convergence / derive / deviceId / i18n / ui*.test   # skeleton
│   ├── utils.test.ts         # money, phone, date helpers (property-based)
│   ├── i18n-keys.test.ts     # en/ur key parity for skeleton and khata
│   ├── khata.helpers.ts      # ledger builders, BigInt oracle, deterministic shuffle
│   └── khata.*.test.ts(x)    # balance, dashboard, reversal, reminder, phone, csv, demo,
│                             # screens, rtl (logical classes), architecture, performance
│
├── packages/
│   └── skeleton/             # @skeleton/core: shared library
│       ├── package.json      # name: @skeleton/core, deps: dexie, i18next, react-i18next
│       ├── tsconfig.json
│       ├── README.md         # How to build an app on the skeleton
│       └── src/
│           ├── index.ts      # Barrel export: all public API
│           ├── storage/      # Local storage + deviceId
│           │   ├── types.ts      # BaseRecord, Record<P>, SyncedRow<P>, Collections
│           │   ├── db.ts         # createDatabase(): Dexie factory
│           │   ├── store.ts      # createStore(): append-only store + sync-internal methods
│           │   ├── deviceId.ts   # getOrCreateDeviceId(): persistent UUID per device
│           │   └── derive.ts     # deriveState(): pure reducer fold
│           ├── sync/         # Sync engine
│           │   ├── types.ts      # SyncStatus, SyncEngineConfig, SyncEngine
│           │   ├── status.ts     # createSyncStatusStore(): observable
│           │   ├── adapter.ts    # SyncAdapter interface + InMemorySyncAdapter
│           │   └── engine.ts     # createSyncEngine(): pull/push/backoff/auto-sync
│           ├── utils/        # Formatting + validation shared by all apps
│           │   ├── money.ts      # formatPaisa, paisaFromRupees, parseWholeRupees
│           │   ├── phone.ts      # validatePakistaniPhone, normalizePhone
│           │   ├── date.ts       # todayISO (local), isValidISODate, formatDateDMY, monthRange
│           │   └── digits.ts     # toAsciiDigits (Urdu / Arabic-Indic digits)
│           ├── hooks/
│           │   ├── useOnlineStatus.ts   # React hook for online/offline
│           │   └── useStoreSnapshot.ts  # load local data; reload after writes and sync
│           ├── i18n/
│           │   ├── index.ts      # i18n init, setLanguage, registerAppTranslations
│           │   ├── useLanguage.ts # React hook for language state
│           │   └── locales/
│           │       ├── en.json   # Shared skeleton keys (English)
│           │       └── ur.json   # Shared skeleton keys (Urdu)
│           └── ui/               # UI shell components
│               ├── AppShell.tsx        # Phone-width column: header + content
│               ├── SyncStatusBadge.tsx # Sync status pill
│               ├── LanguageToggle.tsx  # EN ↔ UR toggle
│               ├── BottomNav.tsx       # Bottom tab bar (56px tabs)
│               └── ScreenHeader.tsx    # Screen title + RTL-aware back button
│
├── apps/
│   ├── khata/                # Credit ledger app (complete)
│   │   ├── package.json      # deps: @skeleton/core, react, react-dom
│   │   ├── vite.config.ts    # React + PWA (icons, manifest, font cache) + Tailwind
│   │   ├── public/           # favicon + PWA icons (192, 512, maskable, apple-touch)
│   │   └── src/
│   │       ├── main.tsx          # Registers khata translations, mounts App
│   │       ├── App.tsx           # Screen routing, bottom nav, sync wiring, history/back button
│   │       ├── index.css         # @import "tailwindcss" + @source skeleton + Urdu font rules
│   │       ├── khata.types.ts    # KhataCollections, derived-state types, Screen
│   │       ├── khata.db.ts       # createDatabase<KhataCollections>
│   │       ├── khata.store.ts    # store + sync engine singletons
│   │       ├── khata.reducers.ts # pure derivations: customers, balances, dashboard, reports
│   │       ├── i18n/             # en.json, ur.json (all khata.* keys)
│   │       ├── components/       # Money, NavIcons, shared style classes
│   │       ├── utils/            # reminder (WhatsApp/SMS), csv, demo
│   │       └── screens/          # Dashboard, CustomerList, AddCustomer (+edit), CustomerDetail,
│   │                             # AddEntry, ReverseEntry, Reports, Settings
│   │
│   └── clinic-queue/         # Patient token app (placeholder; PWA icons ready)
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── App.tsx       # Root component (placeholder)
│           └── index.css
│
└── .kiro/
    ├── steering/             # This folder: always-included project rules
    │   ├── product.md
    │   ├── tech.md
    │   └── structure.md
    ├── hooks/                # Auto-test and translation-checker hooks
    └── specs/                # Feature specs
        ├── skeleton-core/    # Skeleton implementation spec (complete)
        └── khata/            # Khata app spec (complete)
```

## Rules

1. **Code useful to both apps belongs in `packages/skeleton`.** If khata and clinic-queue would both use it (formatting, validation, date helpers, hooks, shell components), it goes in the skeleton. App-specific logic (record types, reducers, screens, translations) stays in the app.

2. **Apps never import from each other.** `apps/khata` cannot import from `apps/clinic-queue` and vice versa. Shared code goes through `@skeleton/core`.

3. **Each app registers its own translations.** Apps call `registerAppTranslations()` at startup with their app-specific keys, all under an app prefix (e.g. `khata.`). Skeleton keys are shared and included automatically. App keys cannot overwrite skeleton keys.

4. **Each app's `index.css` must include the skeleton source path** so Tailwind scans skeleton components for class names:
   ```css
   @import "tailwindcss";
   @source "../../../packages/skeleton/src";
   ```
   Without this, skeleton UI components (AppShell, SyncStatusBadge, LanguageToggle, BottomNav) will render unstyled.

5. **The barrel `packages/skeleton/src/index.ts` exports everything.** Apps import from `@skeleton/core` only. They never import `dexie`, `i18next` or `react-i18next` (use the re-exported `useTranslation`), never touch IndexedDB, and never make network calls. `tests/khata.architecture.test.ts` enforces this.

6. **Layout classes are logical.** `tests/khata.rtl.test.ts` fails the build if any app or skeleton UI file uses `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`, `left-`, `right-`, and similar.
