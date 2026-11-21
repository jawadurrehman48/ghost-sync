# Ghost Sync

**Offline-first apps for places where the internet keeps disappearing.**

Ghost Sync is a reusable foundation for Progressive Web Apps that must keep working on cheap Android phones with unreliable internet and daily power cuts. It was built for Pakistan, where small shopkeepers and clinic staff run their business from a 360px phone and many prefer Urdu. Every app built on it works fully offline, never loses data, and speaks English and Urdu with a proper right-to-left layout.

The repository is a monorepo with one shared library and two apps:

| Part | What it is | Status |
| --- | --- | --- |
| [`packages/skeleton`](packages/skeleton/README.md) (`@skeleton/core`) | The foundation: append-only local storage, a sync engine with optional Supabase cloud sync and device pairing, English/Urdu with RTL, money/phone/date helpers, and a mobile UI kit | Complete |
| [`apps/khata`](apps/khata/README.md) | **Khata**, a digital credit ledger (udhaar book) for kiryana shops | Complete |
| [`apps/clinic-queue`](apps/clinic-queue/README.md) | **Clinic Queue**, a patient token and queue system for small clinics | Complete |

## Why "Ghost Sync"

The data is saved on the phone first and syncs in the background when a connection appears, without the user noticing. Three rules make that safe:

1. **Local first.** Every action writes to IndexedDB on the phone, so the network is never required.
2. **Append-only.** Records are never edited or deleted. Mistakes are fixed with a reversal record, and current state (a balance, a queue) is derived from the full record history.
3. **Order doesn't matter.** Records carry UUIDs and are merged by id, so phones can sync in any order, any number of times, and still converge. Property-based tests prove this for thousands of generated cases.

## Khata in one minute

```bash
npm install
npm run dev:khata        # open http://localhost:5173
```

Go to **Settings → Load Demo Data**, then try the dashboard, the `+` quick-entry button, a customer page (WhatsApp reminder, Correct Mistake), Reports, and the **اردو** toggle in the header. See [apps/khata/README.md](apps/khata/README.md) for the full feature list and how to test it offline.

## Clinic Queue in one minute

```bash
npm run dev:clinic       # open http://localhost:5174
```

Go to **Settings → Load demo data**, then on **Queue** press **Complete & call next**, open the **Waiting-room display** (it follows the queue by itself), issue a token with the `+` button, open a patient's history, and check **Summary**. Token numbers carry a device letter (`A-12`, `B-3`) so two phones can issue tokens offline without clashing. See [apps/clinic-queue/README.md](apps/clinic-queue/README.md) for details.

## Cloud sync with Supabase (optional)

Without any setup both apps run **local-only**: everything works offline on one device and the sync badge says **Local only** (**صرف اس ڈیوائس پر**). With a free Supabase project, phones and tablets of the same shop or clinic share their data.

### 1. Create a Supabase project

Sign in at [supabase.com](https://supabase.com), choose **New project**, and pick the region closest to your users (for Pakistan, Mumbai or Singapore).

### 2. Run the migration

Open **SQL Editor** in the project, paste the whole of [`supabase/migrations/20261107000000_records_sync.sql`](supabase/migrations/20261107000000_records_sync.sql) and press **Run**. It creates:

- a `records` table (one row per app record: workspace, app, collection, JSON payload, device, created and received times) with an index for incremental pulls;
- row level security switched on with **no policies**, and no table privileges for the browser role, so the table cannot be read or written directly;
- two `SECURITY DEFINER` functions with a fixed `search_path`, the only things the browser (`anon` role) may call:
  - `push_records(workspace, app, records)` validates the batch (max 500 records, 16 KB payloads) and inserts it, ignoring ids the workspace already has;
  - `pull_records(workspace, app, since, after_id, limit)` returns one page (max 1,000) of that workspace's records for that app, oldest first.

The script is safe to run again. With the Supabase CLI, `supabase db push` does the same.

### 3. Set the environment variables

In each app, copy `.env.example` to `.env.local` and fill in the two values from the Supabase dashboard:

| Variable | Where to find it | Looks like |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Project Settings → **Data API** → Project URL | `https://abcdefghijklmnop.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Project Settings → **API Keys** → Publishable key | `sb_publishable_...` |

```bash
cp apps/khata/.env.example apps/khata/.env.local
cp apps/clinic-queue/.env.example apps/clinic-queue/.env.local
# edit both files, then restart the dev servers
```

Use the **project URL**, not the address of the dashboard page. The app checks the values at start-up: a dashboard URL, a non-https URL or any key that is not the publishable (or legacy anon) key is refused with a console warning that says what to fix, and the app keeps running local-only. `.env.local` is ignored by git; never commit it, and never put any other Supabase key in a frontend app.

### 4. Pair two devices

1. On the first device open **Settings → Sync devices**. It shows this shop's **sync code** with a **Copy code** button and a QR code.
2. On the second device, either scan the QR code with the camera (it opens the app at Settings and asks to join), or open **Settings → Sync devices**, paste or type the code under **Join another device** and press **Join**.
3. Confirm the dialog. It explains that this device will receive all of that workspace's data (and that data already on this device is added to it too). The device then pulls everything.
4. From now on every entry syncs in the background whenever there is internet. Offline entries wait on the phone and go up when the connection returns (with retry and backoff).

Each app has its own workspace and code: pair Khata with Khata and Clinic Queue with Clinic Queue. **Clear all data** erases the device and gives it a new code; paired devices keep their copy.

### How sync works

- Every record is written to IndexedDB first. The engine pulls, saves, then pushes pending records; failures (no network, server errors, timeouts) are retried with exponential backoff and never block the app.
- A sync runs after every change, when the connection returns, when the app comes back to the foreground, when the badge is tapped, and every 15 seconds while the app is open, so a device that only watches (such as the clinic's waiting-room display on another tablet) stays current.
- Records are kept per workspace **and** per app. The primary key is `(workspace_id, id)`, so pushing the same record again changes nothing, and a device that joins another workspace can share records it synced before.
- Pulls are incremental by the server's `received_at`. The position (`received_at`, `id`) is saved per workspace and app **only after** the pulled records are stored, pages continue strictly after the last row (so rows with the same `received_at` are never skipped), and each new pull re-reads a 2-minute window so a slow push that commits late is not missed either.
- `@supabase/supabase-js` is loaded on demand in its own chunk (about 58 kB gzipped), so it never slows down the first screen and is not loaded at all in local-only mode. The QR code library (`uqr`) adds about 4 kB gzipped.

## Security notes

- **The sync code is a shared secret.** It is a random UUID (122 random bits), so it cannot be guessed, but anyone who has it can read that workspace's data and add records to it. Share it only with staff you trust, in person or by QR code, not in public groups. If a code leaks, use **Clear all data** on each device (after a CSV backup) to start a new workspace, then pair the devices again.
- The browser only ever has the **publishable key**, and requests run as Supabase's `anon` role. That role cannot touch the `records` table at all; it can only call the two functions, and they only return records for the workspace code they are given.
- Records are append-only in the database too: there is no update or delete function.
- **A production version should add proper user login** (for example Supabase Auth with a `workspace_members` table and RLS policies by `auth.uid()`), so access depends on an account that can be removed, not on a code that can be copied. This matters most for **Clinic Queue, which stores patient information** (names, phone numbers, ages, visit notes). Health data deserves accounts, an audit trail, data-retention rules and compliance with local privacy law before real use.

## Tech stack

React 19 · TypeScript (strict) · Vite 5 · vite-plugin-pwa (Workbox) · Dexie (IndexedDB) · Supabase (optional cloud sync) · i18next · Tailwind CSS v4 · Vitest + fast-check · PGlite (tests the SQL) · Playwright (real-browser check)

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install everything (npm workspaces; `package-lock.json` pins versions) |
| `npm run dev:khata` | Khata dev server on port 5173 |
| `npm run dev:clinic` | Clinic Queue dev server on port 5174 |
| `npm test` | All unit and property-based tests (skeleton, Khata and Clinic Queue) |
| `npm run typecheck` | Strict type-check of the test code |
| `npm run build` | Type-check and build every workspace |
| `npm run e2e` | Real-browser offline / Urdu / 360px check of a Khata production preview on port 4173 (see the Khata README) |
| `npm run e2e:clinic` | The same for a Clinic Queue preview on port 4174, plus the waiting-room display (see the Clinic Queue README) |

## Repository layout

```
ghost-sync/
├── packages/skeleton/   # @skeleton/core: storage, sync, i18n, utils, hooks, ui, theme.css
├── apps/khata/          # credit ledger app
├── apps/clinic-queue/   # patient token app
├── supabase/migrations/ # records table, RLS, push_records / pull_records (cloud sync)
├── tests/               # Vitest suites for the skeleton, Khata, Clinic Queue and the SQL (PGlite)
├── scripts/             # e2e-khata.mjs, e2e-clinic.mjs (real-browser checks)
└── .kiro/
    ├── steering/        # product, tech and structure rules followed by every change
    ├── specs/           # skeleton-core, khata and clinic-queue specs (requirements, design, tasks)
    └── hooks/           # auto-test on skeleton changes, translation key checker
```

## Built with Kiro

The project was planned and built with Kiro using **specs** (requirements → design → tasks for the skeleton, Khata and Clinic Queue), **steering docs** (offline-first, append-only, paisa integers, logical RTL classes, strict TypeScript, property-based tests), and **agent hooks** (tests run whenever the skeleton changes, and translation files are checked for matching keys). Several of those rules are also enforced by tests: `tests/khata.rtl.test.ts` fails on physical left/right classes and `tests/khata.architecture.test.ts` fails if either app touches IndexedDB or the network directly, or imports from the other app. Clinic Queue was built from its spec while those tests already existed, and the code it shared with Khata (CSV, WhatsApp/SMS links, time and text helpers, `StatCard`, `ChoiceGroup`, `useNow`) was moved into the skeleton rather than copied.

## License

See [LICENSE](LICENSE).
