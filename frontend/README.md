# KeepWiz Frontend

This directory contains the React code for the KeepWiz score tracking application. It is built with [Vite](https://vitejs.dev/) and integrates with a MongoDB backend.

## Development

1. Copy `env-config.js.template` to `env-config.js` and fill in your configuration if needed.
2. Install dependencies with `npm install`.
3. Start the development server:
   ```bash
   npm run dev
   ```
   The app runs on <http://localhost:5173> by default.

## Building for Production

Run `npm run build` to create optimized static files in the `dist/` folder. You can serve these with any static file server or via Docker using the provided `Dockerfile`.

See [`src/docs/Frontend-Setup.md`](src/docs/Frontend-Setup.md) for more details on configuration and usage.