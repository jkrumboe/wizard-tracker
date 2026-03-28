# KeepWiz Frontend

This directory contains the React code for the KeepWiz score tracking application. It is built with [Vite](https://vitejs.dev/) and integrates with a MongoDB backend.

## Development

### Local Development with Backend

To develop the frontend while connecting to the backend running in Docker:

1. Start the backend services (from root directory):
   ```bash
   docker compose up -d backend mongodb
   ```

2. The `.env.development` file is already configured to connect to `http://localhost:5000`

3. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```
   The app runs on <http://localhost:5173> by default.

4. **Important**: After creating or modifying `.env.development`, you must restart the dev server for changes to take effect.

### Frontend-Only Development (Offline Mode)

To develop without a backend (using local storage only):

1. Remove or rename `.env.development`
2. Start the dev server:
   ```bash
   npm run dev
   ```

The app will operate in offline mode using browser storage.

## Building for Production

Run `npm run build` to create optimized static files in the `dist/` folder. You can serve these with any static file server or via Docker using the provided `Dockerfile`.

## Deployment Safety (Service Worker + Cached Assets)

To avoid `bad-precaching-response` errors during updates:

1. Deploy atomically: publish the full `dist/` output in one switch-over.
2. Do not publish `index.html` or `service-worker.js` before all hashed files under `dist/assets/` are available.
3. Keep the previous release's assets available briefly during rollout (or use blue/green release switching).
4. Use cache headers:
   - `index.html`: `Cache-Control: no-cache, must-revalidate`
   - `service-worker.js`: `Cache-Control: no-cache, must-revalidate`
   - hashed files in `assets/`: `Cache-Control: public, max-age=31536000, immutable`

This repository enforces build-output integrity with `scripts/verify-dist-integrity.js` as part of `npm run build`.

See [`src/docs/Frontend-Setup.md`](src/docs/Frontend-Setup.md) for more details on configuration and usage.