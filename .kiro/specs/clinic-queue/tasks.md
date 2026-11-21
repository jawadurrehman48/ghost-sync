# Clinic Queue - Tasks

## Phase 1: Shared code in the skeleton

- [x] 1.1 `utils/csv.ts`: `csvField`, `csvSafeText`, `csvLine`, `csvDocument`, `createCsvBlob`, `downloadBlob`. Refactor Khata's CSV to use them (same output).
- [x] 1.2 `utils/share.ts`: `toInternationalPk`, `whatsAppLink`, `smsLink`. Refactor Khata's reminders to use them.
- [x] 1.3 `utils/once.ts`: `singleFlight`. Refactor Khata's demo loader to use it.
- [x] 1.4 `utils/text.ts`: `collapseSpaces`, `nameKey` (moved from Khata).
- [x] 1.5 `utils/time.ts`: `formatTime`, `minutesBetween`, `localHour`, `isValidTimestamp`.
- [x] 1.6 `hooks/useNow`; `useStoreSnapshot` `pollMs` option.
- [x] 1.7 `ui/StatCard`, `ui/ChoiceGroup`.
- [x] 1.8 Tests for all of the above.

## Phase 2: Data model and logic

- [x] 2.1 `clinic.types.ts`: collections, Token, Queue, Summary, Patient, Screen.
- [x] 2.2 `clinic.db.ts`, `clinic.store.ts`.
- [x] 2.3 `clinic.reducers.ts`: patients, tokens (state machine), queue, device letter, next number, summary, search, visits, settings, `deriveAll`.
- [x] 2.4 `clinic.actions.ts`: issue token, call next, call, complete, skip, requeue.

## Phase 3: Translations

- [x] 3.1 `i18n/en.json`, `i18n/ur.json` (`clinic.*` keys); register in `main.tsx`.

## Phase 4: Utilities

- [x] 4.1 `utils/notify.ts` (WhatsApp/SMS message).
- [x] 4.2 `utils/csv.ts` (patients and tokens export).
- [x] 4.3 `utils/demo.ts` (realistic data, loads once).

## Phase 5: Screens and app

- [x] 5.1 Components: Logo, NavIcons, TokenLabel, StatusPill, PatientForm.
- [x] 5.2 QueueScreen.
- [x] 5.3 IssueTokenScreen.
- [x] 5.4 TokenScreen (doctor actions).
- [x] 5.5 DisplayScreen (Now Serving).
- [x] 5.6 PatientsScreen, AddPatientScreen, PatientDetailScreen.
- [x] 5.7 SummaryScreen.
- [x] 5.8 SettingsScreen.
- [x] 5.9 App.tsx: shell, routing, bottom navigation, floating +, display mode, history.

## Phase 6: Tests

- [x] 6.1 `clinic.tokens.test.ts`: TR-1, TR-2, TR-3 (property-based).
- [x] 6.2 `clinic.summary.test.ts`: TR-4 (property-based).
- [x] 6.3 `clinic.notify.test.ts`: TR-5.
- [x] 6.4 `clinic.demo.test.ts`: TR-6.
- [x] 6.5 `clinic.screens.test.tsx` and `clinic.app.test.tsx`.
- [x] 6.6 Extend the RTL, architecture and translation-key tests to Clinic Queue.

## Phase 7: Polish and integration

- [x] 7.1 Real-browser check (`scripts/e2e-clinic.mjs`): 360px, 44px targets, Urdu, offline, display.
- [x] 7.2 Requirements audit.
- [x] 7.3 READMEs.
- [x] 7.4 `npm test`, `npm run typecheck`, `npm run build` clean; commit.
