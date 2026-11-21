# Clinic Queue - Design

## Principle: reuse, don't rebuild

Clinic Queue is a thin app on top of `@skeleton/core`, built the same way as Khata. The skeleton provides storage, sync, i18n, the app shell and UI kit, phone/date/time helpers, CSV export, WhatsApp/SMS links, the "load once" demo helper and polling snapshots. The app adds only its record types, pure reducers, screens and translations.

Generic code that Khata had kept in the app moves into the skeleton so both apps share it:

| New in skeleton | Used by |
| --- | --- |
| `utils/csv.ts`: `csvField`, `csvSafeText`, `csvLine`, `csvDocument`, `createCsvBlob`, `downloadBlob` | Khata export, Clinic export |
| `utils/share.ts`: `toInternationalPk`, `whatsAppLink`, `smsLink` | Khata reminders, Clinic notify |
| `utils/once.ts`: `singleFlight` | both demo loaders |
| `utils/text.ts`: `collapseSpaces`, `nameKey` | both apps' forms |
| `utils/time.ts`: `formatTime`, `minutesBetween`, `localHour`, `isValidTimestamp` | Clinic queue, summary |
| `hooks/useNow` | live waiting times, display clock |
| `useStoreSnapshot({ pollMs })` | display auto-refresh across tabs |
| `ui/StatCard`, `ui/ChoiceGroup` | Clinic counts, gender picker |

## Files

```
apps/clinic-queue/src/
├── main.tsx              # registers translations, ErrorBoundary, mounts App
├── App.tsx               # shell, routing, bottom nav, floating +, #display mode, history
├── clinic.types.ts       # collections, derived types, Screen
├── clinic.db.ts          # createDatabase<ClinicCollections>
├── clinic.store.ts       # store, adapter, engine, deviceId
├── clinic.reducers.ts    # pure derivations (state machine, queue, summary, letters)
├── clinic.actions.ts     # the only writers: issue, call, complete, skip, requeue
├── clinic.limits.ts      # input limits
├── i18n/en.json, ur.json
├── components/           # Logo, NavIcons, TokenLabel, StatusPill, PatientForm, clinicName
├── utils/                # notify, csv, demo
└── screens/              # Queue, IssueToken, Token, Display, Patients, AddPatient,
                          # PatientDetail, Summary, Settings
```

## Token state machine

```
issued ──► waiting ──called──► serving ──completed──► completed (final)
              │                   │
              └────skipped────────┴──► skipped ──requeued──► waiting
```

All events of a token are sorted by `(at, createdAt, id)` and folded. An event that is not allowed in the current state is ignored (for example a completion before any call, or anything after completion). Because the sort is a total order on the record set, the result never depends on arrival order.

Derived `Token`: `id, label, prefix, number, patientId, date, reason, status, issuedAt, queuedAt, firstCalledAt?, calledAt?, completedAt?, skippedAt?, notes?`.

- `queuedAt` is the issue time, or the latest re-queue time (a re-queued patient goes to the back).
- Waiting list: status `waiting`, sorted by `queuedAt`, then id.
- Now serving: status `serving`, most recently called first.

## Token numbers across offline devices

Each device has one letter. `deriveDeviceLetter(records, deviceId)` returns the device's latest `deviceLetterSet` letter, or a suggestion: the first letter A–Z that no other known device uses. The letter is claimed (a record is written) when the device issues its first token.

`nextTokenNumber(tokens, date, prefix, deviceId)` = 1 + the highest number issued on `date` that has the same prefix **or** was issued by this device. Labels are `prefix-number`. Two devices with different letters can only collide if they share a prefix, which the app prevents by suggestion and warns about in Settings (`letterConflict`).

## Call next

| Situation | Big button | Effect |
| --- | --- | --- |
| waiting > 0, nobody serving | Call next | call first waiting |
| waiting > 0, someone serving | Complete & call next | complete current, call first waiting |
| waiting = 0, someone serving | Complete current | complete current |
| nothing | No one waiting (disabled) | none |

## Display mode

`App` renders `DisplayScreen` without the shell when `location.hash === '#display'`. The Queue screen opens it with `window.open('#display')`, so it can sit in a second window on a TV. The display reloads its snapshot every 2 seconds (`pollMs`), which picks up writes from the other tab (they share IndexedDB), plus sync activity. It has a full-screen button, an exit link and a live clock.

## Summary

`deriveSummary(tokens, date)`: `issued, waiting, serving, completed, skipped, avgWaitMinutes` (mean of `firstCalledAt − issuedAt` over called tokens, or null), and `hours` (one bucket per local hour from the first to the last activity, with arrived and seen counts). Invariants: `issued = waiting + serving + completed + skipped`, Σ arrived = issued, Σ seen = completed.

## Demo data

Ten patients with common Pakistani names, visits on the previous six days (completed, with doctor's notes), and today's queue with completed, serving, waiting and skipped tokens spread over the last few hours. Written through `store.add`, guarded by a `demoDataLoaded` marker plus `singleFlight`.

## Screens (360px)

- **Queue:** clinic name + Display button; three StatCards; Now Serving card; Up Next card with notify; big Call Next button; waiting list; skipped list with Re-queue; empty state.
- **Issue Token:** search list or new-patient form → reason → huge issued token with position and notify.
- **Token:** large label, status, patient, times, notes; actions by status.
- **Display:** dark full screen, huge teal current token, next three, clock.
- **Patients / Add Patient / Patient Detail:** search, form with ChoiceGroup for gender, visit history.
- **Summary:** date, StatCards, GroupedBarChart per hour.
- **Settings:** clinic name, device letter, language, CSV, demo, clear all.
