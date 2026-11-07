# Ghost Sync

A reusable offline-first PWA skeleton for building apps that work reliably on cheap Android phones with unreliable internet connectivity.

## Project Structure

```
ghost-sync/
├── packages/
│   └── skeleton/          # @skeleton/core - Shared library
│       └── src/
│           ├── i18n/      # i18next setup (English/Urdu with RTL)
│           └── index.ts   # Main exports
├── apps/
│   ├── khata/            # Credit ledger app for small shops
│   └── clinic-queue/     # Patient token system for clinics
└── tests/                # Root-level test suites
```

## Tech Stack

- **React** + **TypeScript** + **Vite** - Fast modern development
- **vite-plugin-pwa** - Installable PWA with offline support
- **Dexie.js** - IndexedDB wrapper for local storage
- **i18next** - Internationalization (English/Urdu with RTL)
- **Tailwind CSS v4** - Utility-first styling
- **Vitest** + **fast-check** - Unit and property-based testing

## Features

✅ Offline-first architecture with service workers  
✅ Local IndexedDB storage via Dexie.js  
✅ Bilingual support (English/Urdu) with RTL layout  
✅ Installable PWA on Android devices  
✅ Monorepo structure with shared skeleton library  
✅ Property-based testing for robust validation  

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

Run the **Khata** app (credit ledger):
```bash
npm run dev:khata
```

Run the **Clinic Queue** app (patient tokens):
```bash
npm run dev:clinic
```

### Build

Build all workspaces:
```bash
npm run build
```

### Testing

Run all tests:
```bash
npm test
```

## Workspace Commands

| Command | Description |
|---------|-------------|
| `npm run dev:khata` | Start Khata app dev server |
| `npm run dev:clinic` | Start Clinic Queue app dev server |
| `npm run build` | Build all apps and packages |
| `npm test` | Run Vitest test suites |

## Apps

### Khata
A credit ledger for small shops to track customer credit/debit transactions offline.

### Clinic Queue
A patient token management system for small clinics to manage queues without internet.

## License

See [LICENSE](LICENSE) file for details.
