# Frontend Setup

This guide explains how to run the KeepWiz React frontend against your own MongoDB backend.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A MongoDB backend instance (see backend setup)

## Configuration

1. Copy the example environment file and fill in your configuration if needed:

```bash
cp env-config.js.template env-config.js
```

2. Edit `env-config.js` and set any required environment variables:

```javascript
window._env_ = {
  VITE_APP_VERSION: '1.1.11'
};
```

## Development

Install dependencies and start the Vite dev server:

```bash
npm install
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173) by default.

## Production Build

To create a production build, run:

```bash
npm run build
```

The output will be in the `dist/` folder. You can serve this with any static file server or containerize it using the provided `Dockerfile`.

---

At the moment the multiplayer logic that previously relied on Colyseus is being replaced with Supabase. Until that work is completed the application focuses on local features and Supabase authentication.
