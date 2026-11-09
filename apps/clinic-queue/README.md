# Clinic Queue (coming soon)

A patient-token system for small clinics, to be built on `@skeleton/core`, the same foundation as [Khata](../khata/README.md).

The app is a placeholder for now, but it is already set up the way a Ghost Sync app should be:

- installable PWA (manifest, icons, service worker) that precaches everything, including the Urdu font
- the shared theme from `packages/skeleton/src/theme.css`, with its own teal brand colour set in `src/index.css`

```bash
npm run dev:clinic   # http://localhost:5174
```

To build it, follow `packages/skeleton/README.md`: define the record types, write reducers, register `en` and `ur` translations, and compose the screens from the skeleton UI kit.
