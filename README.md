# Gitara

All-in-one jamming utility app for guitarists (other instruments later). Free, no ads.

The full plan lives in [`docs/aboutproject.md`](docs/aboutproject.md) (the project bible: every feature and decision). Open questions are in [`docs/questions.md`](docs/questions.md).

## Run it (Windows)

Needs Node.js 22 or newer (you have it).

```powershell
cd C:\Users\Admin\VS-IDE\Gitara
npm install
npm run dev
```

Open the address it prints (`http://localhost:5173`). To open it on your iPhone, use the `Network:` address it prints; the phone and the PC must be on the same Wi-Fi.

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | runs the tests |
| `npm run typecheck` | checks the TypeScript without building |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serves the production build (the offline/PWA behaviour only works here, not in `dev`) |

## Connect Supabase (guest accounts and the cloud database)

1. Copy `.env.example` to `.env.local`.
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your Supabase project (Project Settings, API).
3. In the Supabase dashboard, turn on **Anonymous sign-ins** (Authentication, Sign In / Providers).
4. Apply `supabase/migrations/0001_init.sql` (SQL editor, or the Supabase CLI).

Without the keys the app still runs, local-only.

## Layout

```
docs/                 project bible and open questions
src/core/             instruments/tunings, domain model (no UI, no network)
src/data/             on-device database (Dexie), Supabase client, guest session
src/styles/           design tokens ("Ember on Teal") and base styles
src/App.tsx           Phase 0 build-check page, not the real UI
supabase/migrations/  database schema and row-level security
```

## Status

Phase 0 (foundations). Done: toolchain, installable-app setup, instrument core with tests, domain model, on-device database, guest-session plumbing, database schema with security rules (tested against a Postgres engine). Next: the design system, then Phase 1 (songbook).

Not done on purpose: app icons and logo (a design task), real sign-in screens (Phase 5), sync between device and cloud (Phase 5).
