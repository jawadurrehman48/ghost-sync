# Clinic Queue

**Patient tokens for small clinics, without paper slips and without internet.**

Clinic Queue replaces the paper token queue at a small clinic in Pakistan. The receptionist gives each patient a token (`A-12`) on a phone, the doctor calls patients in order, and a TV or tablet in the waiting room shows who is being seen. Everything works offline, in English or Urdu (right-to-left), on a 360px phone.

It is built entirely on [`@skeleton/core`](../../packages/skeleton/README.md), the same foundation as [Khata](../khata/README.md).

```bash
npm install
npm run dev:clinic        # http://localhost:5174
```

Open **Settings → Load demo data** to get a clinic with 10 patients, a week of past visits and a live queue for today.

## Features

| Screen | What it does |
| --- | --- |
| **Today's Queue** (home) | Counts for waiting, now serving and done. The token being seen (large) with Skip and Notes / complete. "Up next" with a WhatsApp / SMS notify button. The waiting list in order, with position and live waiting time. Skipped patients with Re-queue. |
| **Big button** | "Call next" when no one is being seen, "Complete & call next" when someone is, "Complete current patient" when no one is waiting, disabled when there is nothing to do. |
| **Issue token** (floating +) | Search patients by name or phone, or register one quickly (name required; phone, age, gender optional). Add an optional reason. The new token is shown very large with the number of patients ahead. A patient already in today's queue is not given a second token. |
| **Token page** | Patient, reason and times. Doctor actions for the current state: call this patient, complete with notes, skip, put back in queue. |
| **Waiting-room display** | Full-screen board opened from the queue (new tab or window). Clinic name, clock, the current token as large as the screen allows, and the next 3. Token numbers only, never names. It updates by itself every 2 seconds from local data, so it follows the reception tab with no internet. Full screen and exit buttons. |
| **Patients** | Searchable list with phone, age, gender, last visit and today's token. Add patient (the same name and phone twice is refused). Each patient's page lists every visit with token, status, reason and the doctor's notes. |
| **Notify** | A `wa.me` link with the message in the current language ("Hello Ayesha! Your token A-12 at City Clinic is next. Please come to the clinic." / "السلام علیکم …"), plus an SMS fallback. No paid API, no server. |
| **Summary** | For any day (default today): patients seen, average wait (issue to first call), tokens issued, skipped, still waiting, and a bar chart of patients arriving and seen per hour. |
| **Settings** | Clinic name, this device's token letter, language, CSV backup, demo data (loads once) and Clear all data (with a confirmation). |

Bottom navigation: Queue, Patients, Summary, Settings. The Android back button steps back through screens.

## How it works

### Records (append-only)

Nothing is ever edited or deleted. The queue is derived from these records every time:

| Record | Payload |
| --- | --- |
| `patientRegistered` | name, phone?, age?, gender? |
| `tokenIssued` | patientId, prefix (letter), number, date (local day), reason?, at |
| `tokenCalled` / `tokenCompleted` (notes?) / `tokenSkipped` / `tokenRequeued` | tokenId, at |
| `deviceLetterSet` | deviceId, letter |
| `settingsUpdated` | clinicName?, language?, demoDataLoaded? |

A token's life cycle is `waiting → serving → completed`, and `waiting/serving → skipped → (re-queued) → waiting`. Events are applied in time order (`at`, then `createdAt`, then id), and an event that is not allowed in the current state is ignored. So a token can never be completed before it is called, a completed token never comes back, and the result is the same whatever order records arrive in through sync. A re-queued patient goes to the back of the line.

### Token numbers on several offline devices

Numbers restart at 1 every day. Each device uses its own letter (A, B, C…), so a reception phone and a doctor's tablet can both issue tokens offline without ever producing the same label. The next number is one more than the highest number issued today **with this letter or by this device**, so changing the letter in the middle of the day cannot repeat a label either.

A new device suggests the first letter no other known device uses and records it when it issues its first token. Settings shows the letters used by other devices and warns if this device's letter clashes with one of them.

**Known limit:** two brand-new devices that have never synced cannot know about each other, so both suggest `A`. After the first sync, Settings (and the Issue token screen) show a warning on both and the user picks another letter for one of them. If a clinic sets up two devices on day one, give the second one a different letter in Settings before going offline.

### Offline

All data is in IndexedDB on the device (through the skeleton store). The service worker precaches the app, icons and the bundled Urdu font, so the app opens and works with no network after the first visit. Sync runs in the background with the skeleton's sync engine.

## Reused from the skeleton

Storage and sync (`createDatabase`, `createStore`, `createCloudSync` with Supabase or local-only, `SyncDevicesSection` for pairing, `getOrCreateDeviceId`, `clearAllData`), `useStoreSnapshot` (with polling for the display), `useSubmitGuard` (one save per tap), `useNow`, i18n (`registerAppTranslations`, `useTranslation`, `useLanguage`, `setLanguage`), the app shell and UI kit (`AppShell`, `BottomNav`, `FloatingActionButton`, `ScreenHeader`, `Button`, `Card`, `TextField`, `TextAreaField`, `ChoiceGroup`, `StatCard`, `ConfirmDialog`, `EmptyState`, `Notice`, `LoadingState`, `ErrorBoundary`, `GroupedBarChart`, `SyncStatusBadge`, `LanguageToggle`), phone helpers (`validatePakistaniPhone`, `normalizePhone`, `formatPhone`, `toAsciiDigits`), date and time helpers (`todayISO`, `addDays`, `formatDateDMY`, `isValidISODate`, `formatTime`, `minutesBetween`, `localHour`), text helpers (`collapseSpaces`, `nameKey`), share links (`whatsAppLink`, `smsLink`), CSV (`csvDocument`, `csvSafeText`, `createCsvBlob`, `downloadBlob`), `singleFlight` for the demo data, and `theme.css`.

## Code map

```
src/
├── main.tsx              # registers clinic translations, mounts App
├── App.tsx               # shell, routing, history/back button, floating +, #display mode
├── clinic.types.ts       # record payloads, derived types, Screen
├── clinic.db.ts          # createDatabase<ClinicCollections>
├── clinic.store.ts       # store, deviceId, sync engine
├── clinic.limits.ts      # field length limits
├── clinic.reducers.ts    # pure derivations: patients, tokens, queue, letters, numbers, summary
├── clinic.actions.ts     # issue, call next, call, complete, skip, re-queue (re-read the store first)
├── i18n/                 # en.json, ur.json (clinic.* keys)
├── components/           # Logo, NavIcons, TokenLabel, StatusPill, PatientForm, NotifyButtons, format
├── utils/                # notify (WhatsApp/SMS), csv, demo
└── screens/              # Queue, IssueToken, Token, Display, Patients, AddPatient, PatientDetail, Summary, Settings
```

## Tests

From the repository root:

```bash
npm test                  # all tests, including the clinic suites below
npm run typecheck
npm run build --workspace=apps/clinic-queue
npm run preview --workspace=apps/clinic-queue -- --port 4174 --strictPort   # in another terminal
npm run e2e:clinic        # real Chrome: 360px, 44px targets, Urdu, offline, display
```

| File | Covers |
| --- | --- |
| `tests/clinic.tokens.test.ts` | Property-based: labels never repeat across offline devices (any interleaving of issuing, syncing and letter changes); state and queue order do not depend on record arrival order; the life-cycle rules; the actions against a real IndexedDB store |
| `tests/clinic.summary.test.ts` | Property-based: issued = waiting + serving + completed + skipped, hourly bars add up to the totals, average wait matches an independent calculation |
| `tests/clinic.notify.test.ts` | The message in English and Urdu, `wa.me/92…`, SMS fallback |
| `tests/clinic.demo.test.ts` | Demo data loads once (twice, concurrently, or already loaded on another device) and gives a realistic day |
| `tests/clinic.csv.test.ts` | CSV backup content, escaping and formula protection |
| `tests/clinic.screens.test.tsx` | Every screen in English and Urdu with no raw keys, and each flow |
| `tests/clinic.app.test.tsx` | The real app end to end: first token, call, complete, demo data, display, Urdu, clear all |
| `tests/khata.rtl.test.ts`, `tests/khata.architecture.test.ts`, `tests/i18n-keys.test.ts` | Shared rules, also applied to Clinic Queue: logical classes only, skeleton-only imports, no `any`, matching en/ur keys |
