# @skeleton/core

The shared foundation for Ghost Sync apps: offline-first PWAs for cheap Android phones (about 360px wide) with unreliable internet, in English and Urdu.

Everything an app needs is imported from one place:

```ts
import { createStore, AppShell, formatPaisa /* ... */ } from '@skeleton/core';
```

Apps never import `dexie`, `i18next` or `react-i18next` directly, never touch IndexedDB, and never call the network. `tests/khata.architecture.test.ts` enforces this for Khata and Clinic Queue.

## What's inside

| Module | Exports |
| --- | --- |
| **storage** | `createDatabase`, `createStore` (append-only `add` / `query`), `deriveState`, `getOrCreateDeviceId`, `clearAllData` |
| **sync** | `createSyncEngine`, `InMemorySyncAdapter`, `SyncAdapter` and `SyncableStore` types, `createSyncStatusStore` |
| **i18n** | `registerAppTranslations`, `setLanguage`, `useLanguage`, `useTranslation`, `LANGUAGES`, `i18n` |
| **utils** | money: `formatPaisa`, `paisaFromRupees`, `parseWholeRupees` · phone: `validatePakistaniPhone`, `normalizePhone`, `formatPhone` · dates: `todayISO`, `toISODate`, `isValidISODate`, `formatDateDMY`, `addDays`, `daysBetween`, `weekRange`, `monthRange` · time: `formatTime`, `minutesBetween`, `localHour`, `isValidTimestamp` · text: `collapseSpaces`, `nameKey` · share: `toInternationalPk`, `whatsAppLink`, `smsLink` · CSV: `csvField`, `csvSafeText`, `csvLine`, `csvDocument`, `createCsvBlob`, `downloadBlob` · `singleFlight` · `toAsciiDigits` |
| **hooks** | `useStoreSnapshot` (optional `pollMs`), `useSubmitGuard`, `useOnlineStatus`, `useNow` |
| **ui** | `AppShell`, `BottomNav`, `ScreenHeader`, `Button`, `Card`, `StatCard`, `TextField`, `TextAreaField`, `ChoiceGroup`, `ConfirmDialog`, `EmptyState`, `FloatingActionButton`, `Notice`, `LoadingState`, `Spinner`, `ErrorBoundary`, `GroupedBarChart`, `SyncStatusBadge`, `LanguageToggle` |
| **theme** | `src/theme.css`: brand colour tokens, bundled offline Urdu font, Urdu line-height, animations, reduced-motion support |

## Build a new app in six steps

### 1. Styles: import the theme

```css
/* apps/my-app/src/index.css */
@import "tailwindcss";
@import "../../../packages/skeleton/src/theme.css";
@source "../../../packages/skeleton/src";

/* optional: your own brand colour (never red or green, which mean money owed and received) */
@theme {
  --color-brand-600: #0f766e;
  --color-brand-700: #115e59;
}
```

The theme bundles the **Noto Nastaliq Urdu** font, so add `woff2` to your PWA precache (`globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']`) and Urdu works offline.

### 2. Define your record types

```ts
export type AppCollections = {
  patientAdded: { name: string; phone?: string };
  tokenIssued: { patientId: string; number: number; date: string };
  tokenCancelled: { tokenId: string; reason: string }; // fix mistakes by appending, never editing
};
```

Use `type` (not `interface`) so the generics resolve cleanly.

### 3. Create the database, store and sync engine

```ts
import { createDatabase, createStore, createSyncEngine, getOrCreateDeviceId, InMemorySyncAdapter } from '@skeleton/core';

export const db = createDatabase<AppCollections>({
  dbName: 'my-app',
  collections: { patientAdded: undefined, tokenIssued: undefined, tokenCancelled: undefined },
});
export const store = createStore(db, getOrCreateDeviceId());
export const engine = createSyncEngine({ adapter: new InMemorySyncAdapter(), store });
```

### 4. Derive state with pure functions

```ts
import { deriveState, type SkeletonRecord } from '@skeleton/core';

const cancelled = new Set(cancellations.map((c) => c.payload.tokenId));
const waiting = deriveState(tokens, (count = 0, t) => (cancelled.has(t.id) ? count : count + 1), 0);
```

Keep these functions pure and give them property-based tests. Sync may deliver records in any order, so sort by a total order (`createdAt`, then `id`) before folding.

### 5. Register translations

```ts
import { registerAppTranslations } from '@skeleton/core';
import en from './i18n/en.json';
import ur from './i18n/ur.json';

registerAppTranslations({ en, ur }); // before the first render
```

Put your keys under an app prefix (for example `clinic.`). Skeleton keys (`sync.*`, `language.*`, `error.*`, `loading`) are already included, and app keys cannot overwrite them.

### 6. Compose screens from the UI kit

```tsx
import {
  AppShell, BottomNav, ErrorBoundary, FloatingActionButton, LoadingState,
  useLanguage, setLanguage, useStoreSnapshot, useTranslation,
} from '@skeleton/core';

function App() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data, reload } = useStoreSnapshot(loadEverything, { engine }); // reloads after sync too

  return (
    <AppShell
      appName={t('clinic.appName')}
      logo={<Logo />}
      syncStatus={status}
      onSyncNow={() => engine.syncNow()}
      language={language}
      onToggleLanguage={() => setLanguage(language === 'en' ? 'ur' : 'en')}
    >
      <div className="pb-32">{data ? <Screens data={data} onChanged={reload} /> : <LoadingState />}</div>
      <FloatingActionButton label={t('clinic.newToken')} onClick={openNewToken} />
      <BottomNav items={tabs} active={tab} onSelect={setTab} ariaLabel={t('clinic.menu')} />
    </AppShell>
  );
}
```

Wrap the root in `<ErrorBoundary>` (in `main.tsx`) so a bug shows a friendly, translated message instead of a blank screen.

## The UI kit

All components are mobile-first, use **logical** Tailwind classes only (`ms-`, `pe-`, `text-start`, ...), so they mirror automatically in Urdu, and keep interactive elements at **44px or more**.

| Component | Use it for |
| --- | --- |
| `Button` | Every button. Variants `primary` (brand), `secondary`, `neutral`, `danger` (red), `dangerOutline`, `success` (green). `loading` disables it and shows a spinner. With `href` it renders a link (adds `noopener` for new tabs). |
| `Card` | The one card style. Pass `onClick` to make the whole card a 56px button. `tone="muted"` for inactive items. |
| `StatCard` | A small figure with a label (counts on a dashboard). Tones `default`, `brand`, `success`, `warning`, `danger`, optional `hint`. |
| `TextField`, `TextAreaField` | Labelled inputs with `error` / `hint` wired to `aria-describedby`. `size="lg"` gives the 56px amount field. |
| `ChoiceGroup` | A native radio group drawn as large (48px) choice buttons. `allowDeselect` lets an optional choice be cleared. |
| `ConfirmDialog` | "Are you sure?" dialogs. Focus starts on Cancel, Tab stays inside, Escape or a tap outside cancels, `tone="danger"` makes the confirm button red. |
| `EmptyState` | Friendly "nothing here yet" with an action button. |
| `FloatingActionButton` | The round `+` above the bottom navigation, on the right in English and the left in Urdu. |
| `Notice` | Inline messages: errors are announced at once (`role="alert"`), success and info politely. |
| `LoadingState`, `Spinner` | Loading feedback with a translated label. |
| `ErrorBoundary` | Catches render crashes; offers Try again / Reopen. |
| `GroupedBarChart` | A small SVG bar chart with no chart library. Never draws NaN; stays left-to-right inside Urdu pages so dates read correctly. |
| `AppShell`, `BottomNav`, `ScreenHeader` | The frame: a phone-width column centred on desktop, a header with logo, sync badge and language toggle, 56px tabs, and a title with an RTL-aware back button. |

## The helpers

```ts
formatPaisa(245050);                   // "Rs 2,450.50" (integer maths, identical on every device)
parseWholeRupees('۲,۵۰۰');              // 2500 (Urdu digits, commas, spaces); null if invalid
paisaFromRupees(2500);                 // 250000
formatPhone('03001234567');            // "0300-1234567" (store unformatted, show formatted)
validatePakistaniPhone('0300 1234567');// true
todayISO();                            // the LOCAL date, e.g. "2026-11-07" (not the UTC day)
weekRange();                           // { from: Monday, to: Sunday }
monthRange();                          // { from: '2026-11-01', to: '2026-11-30' }
addDays('2026-12-31', 1);              // "2027-01-01"
```

```ts
formatTime('2026-11-07T05:30:00Z');    // local "HH:MM", e.g. "10:30" in Pakistan
minutesBetween(issuedAt, calledAt);    // whole minutes, never negative
whatsAppLink('0300-1234567', message); // "https://wa.me/923001234567?text=..." (no API, no server)
smsLink('0300-1234567', message);      // "sms:03001234567?body=..." fallback
csvDocument(rows);                     // escaped CSV; csvSafeText() blocks spreadsheet formulas
downloadBlob(createCsvBlob(csv), 'backup.csv'); // UTF-8 BOM so Urdu opens correctly in Excel
singleFlight(store, () => loadDemo()); // one run at a time per key (double taps share it)
```

`useNow(ms)` re-renders every `ms` for live clocks and waiting times. `useStoreSnapshot(load, { engine, pollMs })` also re-reads local data on a timer, which keeps a second tab (such as a waiting-room display) in step without any network.

`useSubmitGuard()` returns `{ busy, run }`. Wrap every save in `run(...)`: in an append-only ledger, a double tap would otherwise record a real second entry.

`clearAllData(db)` erases every record on the phone in one transaction. It is meant only for an explicit "reset" behind a `ConfirmDialog`.

## Tests

From the repository root, `npm test` runs the skeleton suites alongside the apps': storage, the sync engine (including a property-based convergence test across three devices), i18n and RTL, the helpers (property-based), hooks, and every UI component (accessibility, touch targets, RTL classes, dialog focus handling, a chart that never draws NaN).
