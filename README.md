# Ghost Sync

**Offline-first apps for places where the internet keeps disappearing.**

Ghost Sync is a reusable foundation for Progressive Web Apps that must keep working on cheap Android phones with unreliable internet and daily power cuts. It was built for Pakistan, where small shopkeepers and clinic staff run their business from a 360px phone and many prefer Urdu. Every app built on it works fully offline, never loses data, and speaks English and Urdu with a proper right-to-left layout.

The repository is a monorepo with one shared library and two apps:

| Part | What it is | Status |
| --- | --- | --- |
| [`packages/skeleton`](packages/skeleton/README.md) (`@skeleton/core`) | The foundation: append-only local storage, a sync engine, English/Urdu with RTL, money/phone/date helpers, and a mobile UI kit | Complete |
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

## Tech stack

React 19 · TypeScript (strict) · Vite 5 · vite-plugin-pwa (Workbox) · Dexie (IndexedDB) · i18next · Tailwind CSS v4 · Vitest + fast-check · Playwright (real-browser check)

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
├── tests/               # Vitest suites for the skeleton, Khata and Clinic Queue
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
