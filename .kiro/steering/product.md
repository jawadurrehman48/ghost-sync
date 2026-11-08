# Product

Ghost Sync is an offline-first PWA skeleton for low-connectivity regions like Pakistan, where internet drops and load-shedding are common. It is a reusable foundation that two apps are built on:

- **apps/khata** — a digital credit ledger (udhaar book) for small kiryana shops, replacing the paper notebook shopkeepers use to track what customers owe.
- **apps/clinic-queue** — a patient token system for small clinics, replacing the paper token queue.

## Target Users

Small shopkeepers and clinic staff on cheap Android phones. Screens are as small as ~360px wide. Many users prefer Urdu over English. Internet is unreliable — connections drop frequently and power cuts (load-shedding) are common.

## Core Principles

1. **Every feature works fully offline.** No screen, no action, no calculation should require a network connection. Sync is a background concern, never a blocker.

2. **Data is never lost.** Every record is saved to local IndexedDB first, then synced when online. Failed syncs retry with backoff. Records are append-only — mistakes are fixed with reversal records, never by editing or deleting.

3. **Every string is bilingual.** English and Urdu, with correct right-to-left (RTL) layout for Urdu. Language choice persists across app restarts.

4. **Screens are simple with large touch targets.** Mobile-first, targeting 360px screens. Interactive elements have a minimum 44x44px touch target. No clutter, no tiny buttons, no dense tables.

5. **Apps are trustworthy.** Money is stored as integer paisa to avoid floating-point errors. Balances always reconcile. The app is installable as a PWA and works after a force-close.
