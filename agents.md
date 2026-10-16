# AI Agent Guidelines for KeepWiz

This document provides guidance for AI coding agents (GitHub Copilot, Claude, etc.) working on the KeepWiz codebase.

## Project Overview

**KeepWiz** is a full-stack Progressive Web Application (PWA) for tracking card game scores, specifically designed for the Wizard card game. It features offline-first capabilities, player statistics, and real-time sync.

| Aspect | Details |
|--------|---------|
| **Version** | 1.20.1 |
| **Frontend** | React 19 + Vite + React Router 7 |
| **Backend** | Node.js 18+ + Express.js |
| **Database** | MongoDB 7.x with Mongoose ODM |
| **Local Storage** | IndexedDB via Dexie.js |
| **Containerization** | Docker + Docker Compose |

## Repository Structure

```
wizard-tracker/
├── backend/                 # Express.js REST API
│   ├── middleware/          # Auth, error handling, rate limiting
│   ├── models/              # Mongoose schemas (User, Game, etc.)
│   ├── routes/              # API endpoint handlers
│   ├── schemas/             # Validation schemas
│   ├── scripts/             # Runtime migrations and utility scripts
│   ├── tests/               # Jest API tests
│   └── utils/               # Helper utilities
├── frontend/                # React SPA
│   ├── public/              # Static assets, PWA manifest, service worker
│   ├── scripts/             # Build scripts (version injection)
│   └── src/
│       ├── app/             # App entry, routing
│       ├── components/      # UI components (common, game, layout, modals, stats, ui)
│       ├── pages/           # Route-level page components
│       ├── shared/          # Shared logic
│       │   ├── api/         # API client functions
│       │   ├── contexts/    # React Context providers
│       │   ├── db/          # IndexedDB/Dexie configuration
│       │   ├── hooks/       # Custom React hooks
│       │   ├── i18n/        # i18next setup + locales (en, de)
│       │   ├── schemas/     # Frontend validation schemas
│       │   ├── sync/        # Offline sync logic
│       │   ├── theme/       # Accent palette generation
│       │   └── utils/       # Utility functions
│       └── styles/          # CSS stylesheets
├── docs/                    # Project documentation (md files)
├── scripts/                 # Root-level setup/health/env scripts
└── game_descriptions/       # Game rule documentation
```

## Key Technologies & Patterns

### Frontend Patterns
- **State Management**: React Context API + custom hooks (no Redux)
- **Data Fetching**: TanStack React Query for server state
- **Local Database**: Dexie.js wrapping IndexedDB for offline storage
- **Routing**: React Router v7 with nested routes
- **Styling**: Plain CSS in `src/styles/` (no CSS Modules/Tailwind/styled-components), mobile-first; `src/styles/__tests__/cssDebt.test.js` fails on new `max-width` queries, non-standard breakpoints (only 600/768/1024) or `!important`
- **i18n**: react-i18next; add every new key to both `en.json` and `de.json`
- **Imports**: `@` aliases `frontend/src`
- **PWA**: Custom service worker with caching strategies
- **Icons**: Lucide React icons
- **Charts**: Chart.js with react-chartjs-2 and Recharts

### Backend Patterns
- **Authentication**: JWT tokens with bcrypt password hashing
- **Middleware**: Custom auth, error handler, and rate limiter
- **Validation**: express-validator
- **ODM**: Mongoose with schema definitions in `/models`
- **Caching**: Redis for rate limiting and session caching

### Database Models
| Model | Purpose |
|-------|---------|
| `User` | User accounts and authentication |
| `Game` | Generic game records |
| `WizardGame` | Wizard-specific game data |
| `TableGame` | Table-based game tracking |
| `GameEvent` | Game action events for sync |
| `GameSnapshot` | Point-in-time game state |
| `PlayerIdentity` | Player identification system |
| `PlayerAlias` | Alternate player names |
| `GameTemplate` | Custom game configurations |
| `SystemGameTemplate` | Built-in game templates |
| `UserGameTemplate` | User-created templates |
| `TemplateSuggestion` | User-submitted template suggestions for admin review |
| `FriendRequest` | Friend requests between users |
| `Migration` | Tracks which `runMigrations.js` migrations have run |

## Development Commands

### Essential Commands
```bash
# Initial setup
npm run setup              # Full first-time setup

# Development
npm run dev                # Start all services via Docker
npm run dev:manual         # Start backend + frontend manually
docker compose up          # Start Docker containers

# Testing
npm test                   # Run all tests
npm run test:backend       # Backend tests only
npm run test:frontend      # Frontend tests only
cd backend && npm test -- tests/elo.test.js          # Single backend test file
cd frontend && npx vitest run path/to/file.test.js   # Single frontend test file

# Code Quality
npm run lint:frontend      # Run ESLint (the backend has no lint script, so root `npm run lint` fails)
npm run format             # Format with Prettier

# Versioning
cd frontend && npm run update-version   # Sync version (from .env VITE_APP_VERSION) across all files
```

Git hooks (husky): pre-commit runs the frontend lint when frontend files are staged; pre-push runs frontend lint + tests.

### VS Code Tasks
- **Run Tests**: Execute all tests (`Ctrl+Shift+P` → "Tasks: Run Test Task")
- **Update Version**: Update version numbers and run tests
- **Start Frontend Dev**: Start frontend with hot reload
- **Docker Compose Up**: Full rebuild with no cache

## Code Style Guidelines

### JavaScript/React
- Use functional components with hooks
- Prefer named exports over default exports for utilities
- Use destructuring for props and imports
- Follow existing patterns in adjacent files
- Use `async/await` over `.then()` chains

### File Naming
- Components: `PascalCase.jsx` (e.g., `GameCard.jsx`)
- Utilities: `camelCase.js` (e.g., `gameUtils.js`)
- Styles: `ComponentName.css` or `component-name.css`
- Tests: `*.test.js` in `__tests__` folders or `tests/` directory

### Component Structure
```jsx
// Imports
import { useState, useEffect } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';

// Component
export function ComponentName({ prop1, prop2 }) {
  // Hooks
  const [state, setState] = useState(null);
  const { user } = useAuth();
  
  // Effects
  useEffect(() => { /* ... */ }, []);
  
  // Handlers
  const handleAction = () => { /* ... */ };
  
  // Render
  return ( /* JSX */ );
}
```

## Backend Scripts (`backend/scripts/`)

| Script | Purpose | How to run |
|--------|---------|-----------|
| `runMigrations.js` | Auto-runs DB migrations on server start (`SKIP_MIGRATIONS` / `FORCE_MIGRATIONS` env flags); status via `GET /api/users/admin/migrations` | Runs automatically |
| `dedupe-games.js` | Finds duplicate games (dry run by default) | `npm run games:dedupe` / `npm run games:dedupe:apply` |
| `calculate-initial-elo.js` | Recalculates ELO ratings for all historical games | `npm run elo:calculate` |
| `copy-prod-to-dev.js` | Copies production data to dev database | `npm run db:copy-prod` |
| `diagnose-failed-migrations.js` | Diagnostic tool for failed migration records | `node scripts/diagnose-failed-migrations.js` |
| `ensure-indexes.js` | Ensures all MongoDB indexes exist | `node scripts/ensure-indexes.js` |
| `monitor-performance.js` | Monitors MongoDB query performance | `node scripts/monitor-performance.js` |
| `unlink-all-identities.js` | Removes all player identity links (use with caution) | `node scripts/unlink-all-identities.js` |

## Root Scripts (`scripts/`)

| Script | Purpose | How to run |
|--------|---------|-----------|
| `init.js` | Interactive first-time setup wizard | `npm run init` |
| `setup-env.js` | Generates/rotates JWT secret in `.env` | `npm run setup-env` |
| `verify-setup.js` | Validates prerequisites and environment | `npm run verify` |
| `health-check.js` | Checks all running services are healthy | `npm run health` |
| `test-redis.ps1` / `test-redis.sh` | Manual Redis connectivity diagnostic | Run directly (PowerShell/bash) |

## Common Tasks for Agents

### Adding a New API Endpoint
1. Create/modify route handler in `backend/routes/`
2. Add middleware if needed in `backend/middleware/`
3. Update or create Mongoose model in `backend/models/`
4. Add corresponding frontend API function in `frontend/src/shared/api/`
5. Write tests in `backend/tests/`

### Adding a New Component
1. Create component file in appropriate `frontend/src/components/` subfolder
2. Add styles in `frontend/src/styles/` or co-located CSS file
3. Import and use in parent component or page
4. Follow existing component patterns in the same directory

### Adding a New Page
1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/app/App.jsx`
3. Add navigation link if needed in layout components

### Working with Game Data
- Game state flows: Frontend → IndexedDB (offline) → Sync → Backend → MongoDB
- Saved/finished games also live in localStorage via `frontend/src/shared/api/local*Storage.js`
- IndexedDB schema changes (`shared/db/database.js`) need a new Dexie `version(n)`, never an edit to an existing one
- Use hooks in `frontend/src/shared/hooks/` for game operations
- Use contexts in `frontend/src/shared/contexts/` for global game state

## Testing Requirements

### Before Committing
1. Run `npm run lint:frontend` - ensure no linting errors
2. Run `npm test` - ensure all tests pass
3. Run `npm run format:check` - ensure code is formatted

### Test Locations
- Backend: `backend/tests/*.test.js` (Jest + Supertest)
- Frontend: `frontend/src/**/__tests__/*.test.js`

### Test Dependencies
- Backend tests require MongoDB and Redis (use `docker compose up -d`)
- Tests auto-skip if services unavailable

## Important Files

### Configuration
- `docker-compose.yml` - Container orchestration
- `.env` (root, used by Docker Compose) / `backend/.env` / `frontend/.env` - Environment variables
- `frontend/vite.config.js` - Vite build configuration
- `frontend/eslint.config.js` - ESLint rules

### Entry Points
- `backend/server.js` - Backend application entry
- `frontend/src/app/main.jsx` / `App.jsx` - Frontend app entry and routing
- `frontend/public/service-worker.js` - PWA service worker (built via VitePWA `injectManifest`)

### Key Contexts (Frontend, `shared/contexts/`)
- `UserContext` - User authentication state (consume via `useAuth` / `useUser` hooks)
- `GameSyncContext` - Offline sync status
- `ThemeContext` - Light/dark theme and accent color

## Do's and Don'ts

### Do
- ✅ Check existing patterns before implementing new features
- ✅ Use existing hooks and utilities when available
- ✅ Maintain offline-first approach (IndexedDB → sync → API)
- ✅ Add proper error handling with try/catch
- ✅ Use TypeScript-style JSDoc comments for complex functions
- ✅ Test API changes with the existing test suite
- ✅ Follow the existing folder structure conventions

### Don't
- ❌ Install new major dependencies without justification
- ❌ Break offline functionality
- ❌ Skip error handling in async operations
- ❌ Modify database schemas without migration scripts
- ❌ Hardcode API URLs (use environment variables)
- ❌ Commit `.env` files or secrets
- ❌ Ignore existing abstractions (contexts, hooks, utils)

## Documentation References

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and data flow |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development workflow |
| [SETUP.md](docs/SETUP.md) | Installation instructions |
| [TESTING.md](docs/TESTING.md) | Test infrastructure |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | Contribution guidelines |
| [SECURITY.md](docs/SECURITY.md) | Security policies |
| [SCRIPTS.md](docs/SCRIPTS.md) | NPM scripts reference |
| [backend/API_EXAMPLES.md](backend/API_EXAMPLES.md) | API documentation |

## Environment Variables

### Backend (`.env`)
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT signing
- `JWT_EXPIRES_IN_DAYS` - Token lifetime
- `REDIS_URL` - Redis connection for caching
- `PORT` - Server port (default: 5000)
- `SKIP_MIGRATIONS` / `FORCE_MIGRATIONS` - Control startup migrations
- `GAMEUPC_API_KEY` / `BGG_API_TOKEN` - Barcode lookup and BoardGameGeek metadata (optional)

### Frontend (`.env`)
- `VITE_API_BASE_URL` - Backend API base URL
- `VITE_APP_VERSION` - Application version
- `VITE_LOG_LEVEL` - Client log level
- `VITE_SEO_*` - SEO metadata (see `.env.seo.example`)

## Contact & Support

- **Repository**: https://github.com/jkrumboe/wizard-tracker
- **Issues**: Use GitHub Issues for bug reports and features
- **Security**: See [SECURITY.md](docs/SECURITY.md) for vulnerability reporting
