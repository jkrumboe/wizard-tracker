# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

KeepWiz (repo: wizard-tracker) is an offline-first PWA for tracking card game scores (Wizard plus generic table/scoreboard games). `agents.md` holds the general conventions and overview. This file covers what you can only learn by reading several files. Where docs disagree with the code, the code is right. `docs/ARCHITECTURE.md` in particular lists outdated versions (React 18/Vite 5). The real stack is React 19, Vite 6, React Router 7, Mongoose 7 and Express 4.

## Commands

There are three separate npm packages: the root (orchestration + husky), `backend/` (CommonJS, Jest), and `frontend/` (ESM, Vite + Vitest). Each has its own `node_modules` and lockfile.

```bash
npm run dev                 # setup-env + docker compose up -d (mongo, redis, backend :5000, frontend :8088, mongo-express :18081)
npm run dev:manual          # backend (nodemon) + frontend (vite) without Docker
cd frontend && npm run dev  # Vite dev server only

npm test                    # backend jest, then frontend vitest
cd backend && npm test -- tests/elo.test.js                       # single backend test file
cd backend && npm test -- -t "name of test"                       # single backend test by name
cd frontend && npx vitest run src/shared/sync/__tests__/foo.test.js # single frontend test file

cd frontend && npm run lint # ESLint (frontend only)
cd frontend && npm run build  # vite build + inject SW version + verify dist integrity
```

- **Lint:** the backend has no `lint` script, so the root `npm run lint` / `npm run precommit` fail at the backend step. Lint the frontend directly.
- **Git hooks:** pre-commit runs lint-staged, which runs the full frontend lint whenever a `frontend/src/**/*.{js,jsx}` file is staged. Pre-push runs `lint:frontend` and `test:frontend`.
- **Backend tests and services:** backend tests need MongoDB and Redis (`docker compose up -d`). The server's `initializeServer()` (exported from `server.js`) doesn't call `listen` when `NODE_ENV=test`. DB-dependent tests skip themselves if Mongo is unreachable.
- **Backend env var:** the backend reads **`MONGO_URI`**, not `MONGODB_URI`.
- **Version bumps:** the version appears in every `package.json`, `.env` `VITE_APP_VERSION`, the service worker cache names, README, docker-compose and the workflows. Bump it with `cd frontend && npm run update-version`, which reads the version from `.env`. Don't hand-edit a single file.

## Architecture

### Backend (`backend/`)
- `server.js` wires all routes under `/api/*`, each behind `apiLimiter`:
  - `users`
  - `games` (plus the sync endpoints from `gameSync.js`)
  - `wizard-games`
  - `table-games`
  - `game-templates`
  - `identities`
  - `admin/games`
- On startup the server connects to Redis (`utils/redis.js`, optional and degrades gracefully) and to Mongo, then runs `scripts/runMigrations.js`.
- **Migrations** are code-defined entries in the `migrations` array in `runMigrations.js`, tracked in the `Migration` collection. They run automatically on boot. Set `SKIP_MIGRATIONS=true` to skip them or `FORCE_MIGRATIONS=true` to re-run them. A schema change needs a new entry here.
- **Game collections:** game types live in separate collections:
  - `WizardGame`: validated v3.0 `gameData`, keyed by the client's `localId`.
  - `TableGame`: generic games, typed by `gameTypeName`.
  - `Game`: legacy games.
  - `GameEvent` / `GameSnapshot`: these back the event-sourced sync.
- **Player identity:** `PlayerIdentity` and `PlayerAlias` decouple player names in games from `User` accounts. Linking/unlinking logic is in `utils/identityService.js`, `utils/gameUserLinkage.js` and `utils/identityHelpers.js`. ELO (`utils/eloService.js`, see `docs/ELO_SYSTEM.md`) and leaderboards are computed over identities.
- **Business logic** lives in `utils/*Service.js`; routes stay thin. Wrap async handlers with `utils/catchAsync.js`, and errors flow to `middleware/errorHandler.js`.
- **Auth:** `middleware/auth.js` verifies the Bearer JWT and caches user lookups in Redis (`user:<id>`). `utils/authToken.js` handles refreshing tokens near expiry.

### Frontend (`frontend/src/`)
- **Imports:** the `@` alias maps to `src/`. Entry points are `app/main.jsx` → `app/App.jsx`, which holds all routes, including the nested `/admin/*` behind `AdminProtectedRoute`.
- **Game types:**
  - Wizard games: `/game/current` while in progress, `/game/:id` for details.
  - Table games: `/table/:id`, details at `/table-game/:id`.
  - Scoreboard games: `/scoreboard/:id`, details at `/scoreboard-game/:id`.

  Templates (`shared/constants/gameTemplates.js`, `utils/templateResolver.js`, backend `SystemGameTemplate` and `UserGameTemplate`) define how table and scoreboard games score. The barcode scanner (`utils/barcodeScanner.js`, `barcodeTemplateMap.js`) maps scanned box barcodes to templates.
- **Two local persistence layers.** Know which one you're touching:
  1. **localStorage:** `shared/api/local*Storage.js`. Keys include `wizardTracker_localGames`, `wizardTracker_tableGames` and `wizardTracker_currentUserId`. These hold the user's saved and finished games.
  2. **IndexedDB (Dexie):** `shared/db/database.js`. Tables are `gameSnapshots`, `gameEvents`, `syncMetadata`, `clientState` and `friends`. Change the schema only by adding a new `this.version(n)`. Never edit an existing version.
- **Sync:** `shared/sync/` (`syncManager`, `eventReplayer`, `conflictResolver`, `uploadQueueRunner`, `pendingUploads`, `persistenceMiddleware`) replays local game events and snapshots to the backend through `api/syncApiClient.js`. It retries when the client comes back online. `contexts/GameSyncContext.jsx` exposes the sync state to the UI.
- **Server state:** TanStack Query handles server state. Contexts (`UserContext`, `ThemeContext`, `GameSyncContext`) plus hooks in `shared/hooks/` (exported from `index.js`) handle app state. `components/ui/index.js` and `shared/hooks/index.js` are barrel exports. Add new items to them.
- **i18n:** react-i18next with `shared/i18n/locales/en.json` and `de.json`. User-facing strings go through `t()`, and new keys must go in **both** locale files.
- **Theming:** `shared/theme/palettes.js` expands one accent seed color into all `--primary*` CSS custom properties for light and dark themes, using OKLCH with contrast guarantees (`colorUtils.js`). Use those variables and don't hardcode accent colors.
- **Service worker:** the build uses `public/service-worker.js` (VitePWA `injectManifest`). `src/service-worker.js` is only touched by the version script. Registration is in `app/serviceWorkerRegistration.js`. The build injects the version into it.

### CSS rules (enforced by a test)
Styles are plain CSS in `src/styles/` (`base/`, `components/`, `pages/`, `modals/`, `devices/`, `utils/`) and are being migrated to **mobile-first**. `src/styles/__tests__/cssDebt.test.js` counts three kinds of debt in every stylesheet:
- `max-width` media queries
- non-standard breakpoints (only `min-width` 600/768/1024, or `max-width` 599/767/1023, are allowed)
- `!important` declarations

The test fails if a count **rises or falls** compared with `cssDebt.baseline.json`. New CSS files must be at zero. After reducing debt, regenerate the baseline in the same change:

```bash
cd frontend && UPDATE_CSS_DEBT=1 npx vitest run src/styles/__tests__/cssDebt.test.js
```

## CI
`.github/workflows/test.yml` runs backend Jest (with Mongo 7 + Redis 7 services) and frontend Vitest + ESLint on Node 18, for pushes and PRs to `main`/`develop`.
