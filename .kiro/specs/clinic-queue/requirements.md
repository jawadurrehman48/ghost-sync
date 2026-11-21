# Clinic Queue - Requirements

## Overview

Clinic Queue is a patient token and queue system for small clinics in Pakistan. It replaces paper token slips. It is built **only** on `@skeleton/core` and must work fully offline (internet drops and load-shedding are common), in English and Urdu (right-to-left), on a 360px phone screen with touch targets of at least 44px. It uses the teal brand colour already set up for the app.

## Users

- **Receptionist:** registers patients and issues tokens, usually on a cheap Android phone.
- **Doctor:** calls the next patient, completes visits with notes, skips patients who are not present.
- **Patients in the waiting room:** watch a "Now Serving" screen on a TV or tablet.

## Scope

**In scope:** patient registration, daily tokens, the live queue, doctor actions, a waiting-room display, patient history, WhatsApp/SMS notification, a daily summary with a chart, settings (clinic name, language, device letter, CSV export, demo data, clear all data), property-based and unit tests.

**Out of scope:** a real cloud sync backend (the skeleton's `InMemorySyncAdapter` is used), appointments booked in advance, payments, prescriptions, authentication.

---

## Data Model (append-only records)

Every record is added with `store.add` from `@skeleton/core`. Nothing is ever edited or deleted. All queue state is derived from records.

| Collection | Payload |
| --- | --- |
| `patientRegistered` | `name` (required), `phone?` (Pakistani mobile, stored unformatted), `age?` (0–120), `gender?` (`male` / `female` / `other`) |
| `tokenIssued` | `patientId`, `prefix` (one letter A–Z), `number` (positive integer), `date` (local `YYYY-MM-DD`), `reason?`, `at` (ISO time) |
| `tokenCalled` | `tokenId`, `at` |
| `tokenCompleted` | `tokenId`, `notes?`, `at` |
| `tokenSkipped` | `tokenId`, `at` |
| `tokenRequeued` | `tokenId`, `at` (puts a skipped token back in the queue) |
| `deviceLetterSet` | `deviceId`, `letter` (the token prefix this device uses) |
| `settingsUpdated` | `clinicName?`, `language?`, `demoDataLoaded?` |

`at` is the time the event happened. It is part of the payload (not only the store's `createdAt`) so demo data and imported history can carry realistic times.

---

## Functional Requirements

### FR-1 Token numbers

**FR-1.1** Token numbers SHALL restart at 1 each day.

**FR-1.2** Each device SHALL use a short letter prefix (A, B, C…), shown as `A-12`. Two devices with different letters SHALL never issue the same token label on the same day, even when both are offline.

**FR-1.3** A device SHALL suggest a letter that no other known device uses, and claim it (record it) the first time it issues a token. The user SHALL be able to change the letter in Settings. If another device is known to use the same letter, the app SHALL warn the user.

**FR-1.4** The next number for a device SHALL be one more than the highest number already issued today with that device's letter or by that device, so changing the letter mid-day cannot repeat a label.

### FR-2 Token life cycle

**FR-2.1** States: `waiting` → (`called`) → `serving` → (`completed`) → `completed`. `waiting` or `serving` → (`skipped`) → `skipped` → (`requeued`) → `waiting`.

**FR-2.2** A token SHALL NOT be completed before it is called. A completed token SHALL never return to waiting or serving. Events that are not allowed in the current state SHALL be ignored.

**FR-2.3** Events SHALL be applied in time order (`at`, then `createdAt`, then id), so the derived state is the same whatever order records arrive in from sync.

### FR-3 Today's Queue (home)

**FR-3.1** Show counts for waiting, now serving and completed today.

**FR-3.2** Show the token being served now (large), with Skip and "Notes / complete" actions.

**FR-3.3** Show the next patient ("Up next") with a WhatsApp / SMS notify action when a phone number is known.

**FR-3.4** Show the waiting list in queue order with position, token label, patient name and waiting time. Tapping a row opens that token.

**FR-3.5** A large primary button SHALL call the next patient. When someone is already being served it SHALL read "Complete & call next" and do both. With no one waiting it SHALL complete the current patient, or be disabled when there is nothing to do.

**FR-3.6** Skipped tokens SHALL be listed with a Re-queue action.

**FR-3.7** With no tokens today, show a friendly empty state with an "Issue token" action.

### FR-4 Issue Token (floating + button)

**FR-4.1** The floating + button on Queue and Patients SHALL open Issue Token.

**FR-4.2** The user SHALL search patients by name or phone, or quickly register a new patient (name required; phone, age, gender optional).

**FR-4.3** An optional reason for the visit can be entered.

**FR-4.4** A patient who already has a waiting or serving token today SHALL NOT get a second one; the existing token is shown instead.

**FR-4.5** After issuing, the token label SHALL be shown very large with the number of people ahead, a notify action and "Issue another".

### FR-5 Now Serving display

**FR-5.1** A full-screen view (opened from the Queue screen, in a new tab or window) SHALL show the clinic name, the current token very large, and the next 3 tokens, readable from across a room.

**FR-5.2** It SHALL update automatically (when data changes on this device, in another tab of this device, or through sync) without user action.

**FR-5.3** It SHALL offer full screen and exit, follow the app language, and work offline.

### FR-6 Doctor actions

Call next, call a specific token, complete with optional notes, skip, and re-queue a skipped token. Every action SHALL be safe against double taps.

### FR-7 Patients

**FR-7.1** A searchable list (name or phone) with age, gender, phone (shown as `0300-1234567`) and last visit date.

**FR-7.2** Add a patient. The same name **and** phone twice SHALL be refused.

**FR-7.3** A patient's page SHALL show their details, an "Issue token" action and all past visits with date, token, status, reason and doctor notes.

### FR-8 Notify patient

A WhatsApp (`wa.me`) link with a pre-filled message in the current language, for example "Your token A-12 at City Clinic is next. Please come to the clinic.", and an SMS fallback. No paid API, no server.

### FR-9 Today's Summary

For a chosen day (default today): patients seen, average waiting time (issue to first call), tokens issued, skipped, waiting now, and a bar chart of patients per hour (arrived and seen).

### FR-10 Settings

Clinic name, language, this device's token letter, CSV export (patients and tokens), demo data (realistic Pakistani names, loads only once), and "Clear all data" behind a confirmation dialog.

### FR-11 Navigation

Bottom navigation: Queue, Patients, Summary, Settings. The Android back button steps back through screens.

---

## Non-Functional Requirements

**NFR-1 Offline-first.** Every feature works with no network after the first visit, including the Urdu font.

**NFR-2 Skeleton reuse.** The app SHALL use only `@skeleton/core` for storage, sync, i18n, the app shell, UI components, phone and date helpers, CSV export and the demo-data pattern. It SHALL NOT import Dexie, i18next or react-i18next, nor call IndexedDB or the network. Reusable code goes in `packages/skeleton`.

**NFR-3 Mobile and RTL.** 360px first, 44px+ touch targets, Tailwind logical classes only, correct mirroring in Urdu.

**NFR-4 i18n.** Every visible string is a key in both `en.json` and `ur.json`, in simple Urdu.

**NFR-5 Quality.** Strict TypeScript, no `any`, Khata-level polish, and Khata's tests keep passing.

---

## Testing Requirements

**TR-1 (property)** Token labels are never duplicated across several offline devices with different letters, for any interleaving of issuing and syncing.

**TR-2 (property)** Queue order and token states are identical regardless of record arrival order.

**TR-3 (property)** A token is never completed before it is called, and a completed token never returns to waiting or serving.

**TR-4 (property)** Summary counts always match the token states (issued = waiting + serving + completed + skipped; per-hour bars add up to the totals).

**TR-5 (unit)** The notification message in English and Urdu, with the international phone format and the SMS fallback.

**TR-6 (unit)** Demo data loads only once.
