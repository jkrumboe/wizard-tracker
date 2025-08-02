# Frontend Setup

This guide explains how to run the KeepWiz React frontend against your own Supabase instance. The backend is still under development so only the client-side setup is covered here.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A self‑hosted [Supabase](https://supabase.com/) project

## Configuration

1. Copy the example environment file and fill in your Supabase details:

```bash
cp env-config.js.template env-config.js
```

2. Edit `env-config.js` and set:

```javascript
window._env_ = {
  VITE_APPWRITE_PUBLIC_ENDPOINT: 'https://your-appwrite-endpoint',
  VITE_APPWRITE_PROJECT_ID: 'your-project-id'
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
