# Frontend Folder Structure Documentation

## Overview
This document describes the reorganized folder structure for the frontend, designed to improve maintainability and make it easier to find files.

## Structure

```
src/
├── app/                          # Application-level configuration
│   ├── App.jsx                   # Main application component
│   ├── main.jsx                  # Application entry point
│   └── serviceWorkerRegistration.js
│
├── components/                   # Reusable UI components organized by purpose
│   ├── ui/                       # Basic UI elements
│   │   ├── Icon.jsx
│   │   ├── Notification.jsx
│   │   ├── ThemeToggle.jsx
│   │   └── index.js              # Barrel export
│   ├── layout/                   # Layout components
│   │   ├── Navbar.jsx
│   │   ├── PageTransition.jsx
│   │   └── index.js              # Barrel export
│   ├── game/                     # Game-specific components
│   │   ├── PlayerCard.jsx
│   │   ├── GameHistoryItem.jsx
│   │   ├── PerformanceMetric.jsx
│   │   ├── StatCard.jsx
│   │   ├── StatsChart.jsx
│   │   └── index.js              # Barrel export
│   ├── modals/                   # Modal components
│   │   ├── CreateGameModal.jsx
│   │   ├── GameMenuModal.jsx
│   │   ├── LoadGameDialog.jsx
│   │   ├── PauseConfirmationModal.jsx
│   │   ├── SaveGameDialog.jsx
│   │   └── index.js              # Barrel export
│   ├── common/                   # Common/shared components
│   │   ├── FilterTags.jsx
│   │   ├── SearchBar.jsx
│   │   └── index.js              # Barrel export
│   └── index.js                  # Main component barrel export
│
├── pages/                        # Page-level components grouped by feature
│   ├── auth/                     # Authentication pages
│   │   ├── Login.jsx
│   │   └── index.js              # Barrel export
│   ├── game/                     # Game-related pages
│   │   ├── GameDetails.jsx
│   │   ├── GameInProgress.jsx
│   │   ├── Lobby.jsx
│   │   └── index.js              # Barrel export
│   ├── profile/                  # User profile pages
│   │   ├── Profile.jsx
│   │   ├── UserProfile.jsx
│   │   ├── Leaderboard.jsx
│   │   └── index.js              # Barrel export
│   ├── admin/                    # Admin pages
│   │   ├── Admin.jsx
│   │   ├── GameManagement.jsx
│   │   ├── UserManagement.jsx
│   │   └── index.js              # Barrel export
│   ├── Home.jsx                  # Main landing page
│   ├── NotFound.jsx              # 404 page
│   └── index.js                  # Main pages barrel export
│
├── shared/                       # Shared resources used across the app
│   ├── api/                      # API services
│   │   ├── apiService.js
│   │   ├── gameService.js
│   │   ├── playerService.js
│   │   ├── userService.js
│   │   └── index.js              # Barrel export
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.jsx
│   │   ├── useGameState.jsx
│   │   ├── useOnlineStatus.jsx
│   │   ├── usePlayers.jsx
│   │   ├── useTheme.jsx
│   │   ├── useUser.jsx
│   │   ├── useCacheInvalidation.js
│   │   └── index.js              # Barrel export
│   ├── contexts/                 # React context providers
│   │   ├── OnlineStatusContext.jsx
│   │   ├── ThemeContext.jsx      # Named exports: ThemeContext, ThemeProvider
│   │   ├── UserContext.jsx
│   │   └── index.js              # Barrel export
│   ├── utils/                    # Utility functions
│   │   ├── [utility files]
│   │   └── index.js              # Barrel export
│   └── index.js                  # Main shared barrel export
│
├── styles/                       # CSS organized by scope
│   ├── base/                     # Base/global styles
│   │   ├── globals.css
│   │   └── variables.css
│   ├── components/               # Component-specific styles
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── game/
│   │   ├── modals/
│   │   └── common/
│   ├── pages/                    # Page-specific styles
│   │   ├── auth/
│   │   ├── game/
│   │   ├── profile/
│   │   └── admin/
│   └── utils/                    # Utility classes
│       └── responsive.css
│
└── assets/                       # Static assets
    ├── default-avatar.png
    └── react.svg
```

## Barrel Export System

The new structure implements a comprehensive barrel export system for cleaner imports:

### How Barrel Exports Work

Each folder contains an `index.js` file that re-exports all components/functions from that folder:

```javascript
// Example: components/ui/index.js
export { default as Icon } from './Icon.jsx';
export { default as Notification } from './Notification.jsx';
export { default as ThemeToggle } from './ThemeToggle.jsx';
```

### Usage Examples

Instead of:
```javascript
import Icon from '../../../components/ui/Icon.jsx';
import Notification from '../../../components/ui/Notification.jsx';
import PlayerCard from '../../../components/game/PlayerCard.jsx';
```

You can now use:
```javascript
import { Icon, Notification } from '@/components/ui';
import { PlayerCard } from '@/components/game';
```

### Special Cases

#### ThemeContext (Named Exports)
The `ThemeContext.jsx` file uses named exports, so the barrel export is:
```javascript
// contexts/index.js
export { ThemeContext, ThemeProvider } from './ThemeContext.jsx';
```

### Import Aliases

The project uses Vite path aliases configured in `vite.config.js`:
- `@/` → `src/`
- `@/components` → `src/components`
- `@/shared` → `src/shared`

## Benefits

1. **Cleaner Imports**: Shorter, more readable import statements
2. **Better Organization**: Logical grouping of related components
3. **Easier Navigation**: Clear folder structure makes finding files intuitive
4. **Maintainability**: Changes to file locations only require updating barrel exports
5. **Scalability**: Easy to add new components to existing categories

## Migration Notes

All existing imports have been updated to use the new structure and barrel exports. The development server supports hot module replacement (HMR) so changes are reflected immediately during development.
