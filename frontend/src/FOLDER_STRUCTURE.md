# Frontend Folder Structure

This document explains the reorganized frontend folder structure for better maintainability and developer experience.

## 📁 Structure Overview

```text
src/
├── app/                          # Application-level configuration and setup
│   ├── App.jsx                   # Main App component
│   ├── main.jsx                  # Entry point
│   └── serviceWorkerRegistration.js
├── components/                   # Reusable UI components (organized by type)
│   ├── ui/                      # Basic UI components
│   │   ├── Icon.jsx             # Icon component
│   │   ├── SearchBar.jsx        # Search functionality
│   │   ├── ThemeToggle.jsx      # Theme switching
│   │   ├── StatCard.jsx         # Statistics display
│   │   ├── Notification.jsx     # Notification system
│   │   └── index.js            # Barrel exports
│   ├── layout/                  # Layout components
│   │   ├── Navbar.jsx          # Navigation bar
│   │   └── index.js            # Barrel exports
│   ├── game/                    # Game-specific components
│   │   ├── PlayerCard.jsx      # Player information display
│   │   ├── GameHistoryItem.jsx # Game history entries
│   │   ├── StatsChart.jsx      # Statistics charts
│   │   └── index.js            # Barrel exports
│   ├── modals/                  # Modal/dialog components
│   │   ├── CreateGameModal.jsx # Game creation dialog
│   │   ├── GameMenuModal.jsx   # Game menu options
│   │   ├── LoadGameDialog.jsx  # Load game dialog
│   │   ├── SaveGameDialog.jsx  # Save game dialog
│   │   ├── PauseConfirmationModal.jsx # Pause confirmation
│   │   └── index.js            # Barrel exports
│   └── common/                  # Common utility components
│       ├── FilterTags.jsx      # Tag filtering
│       ├── OnlineOnlyRoute.jsx # Online-only routing
│       ├── OnlineProtectedRoute.jsx # Protected routing
│       ├── PageTransition.jsx  # Page transitions
│       ├── PerformanceMetric.jsx # Performance monitoring
│       └── index.js            # Barrel exports
├── pages/                       # Page components (organized by feature area)
│   ├── auth/                    # Authentication pages
│   │   └── Login.jsx           # Login page
│   ├── game/                    # Game-related pages
│   │   ├── GameDetails.jsx     # Game detail view
│   │   ├── GameInProgress.jsx  # Active game view
│   │   ├── MultiplayerGame.jsx # Multiplayer game view
│   │   ├── NewGame.jsx         # New game creation
│   │   └── Lobby.jsx           # Game lobby
│   ├── profile/                 # Profile/user pages
│   │   ├── Profile.jsx         # User profile
│   │   ├── Stats.jsx           # User statistics
│   │   └── Leaderboard.jsx     # Leaderboards
│   ├── admin/                   # Admin pages
│   │   ├── AdminDashboard.jsx  # Admin dashboard
│   │   └── AdminLogin.jsx      # Admin login
│   ├── Home.jsx                # Home page
│   └── Settings.jsx            # Settings page
├── shared/                      # Shared utilities and services
│   ├── api/                     # API services and client code
│   │   ├── api.js              # Main API client
│   │   ├── authService.js      # Authentication service
│   │   ├── colyseusClient.js   # Colyseus client
│   │   ├── gameService.js      # Game-related API calls
│   │   ├── localGameStorage.js # Local storage management
│   │   ├── onlineStatusService.js # Online status service
│   │   ├── playerService.js    # Player management
│   │   └── index.js            # Barrel exports
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.jsx         # Authentication hook
│   │   ├── useCacheInvalidation.js # Cache management hook
│   │   ├── useGameState.jsx    # Game state management
│   │   ├── useOnlineStatus.jsx # Online status hook
│   │   ├── usePlayers.jsx      # Player management hook
│   │   ├── useTheme.jsx        # Theme management hook
│   │   ├── useUser.jsx         # User management hook
│   │   └── index.js            # Barrel exports
│   ├── contexts/                # React contexts
│   │   ├── OnlineStatusContext.jsx # Online status context
│   │   ├── ThemeContext.jsx    # Theme context
│   │   ├── UserContext.jsx     # User context
│   │   └── index.js            # Barrel exports
│   ├── utils/                   # Utility functions
│   └── constants/               # Constants and configuration
├── styles/                      # CSS files (organized by scope)
│   ├── base/                    # Base styles and themes
│   │   ├── index.css           # Global base styles
│   │   └── theme.css           # Theme definitions
│   ├── components/              # Component-specific styles
│   │   ├── components.css      # General component styles
│   │   ├── modal.css           # Modal component styles
│   │   ├── notification.css    # Notification styles
│   │   ├── players.css         # Player component styles
│   │   └── statsChart.css      # Chart component styles
│   ├── pages/                   # Page-specific styles
│   │   ├── admin.css           # Admin pages styles
│   │   ├── gameDetails.css     # Game details styles
│   │   ├── gameInProgress.css  # Game in progress styles
│   │   ├── Lobby.css           # Lobby styles
│   │   ├── MultiplayerGame.css # Multiplayer game styles
│   │   ├── settings.css        # Settings page styles
│   │   └── stats.css           # Statistics page styles
│   └── utils/                   # Utility CSS classes
│       ├── pageTransition.css  # Transition utilities
│       └── performanceMetrics.css # Performance metric styles
├── assets/                      # Static assets
└── docs/                       # Documentation files
```

## 🎯 Benefits of This Structure

### 1. **Clear Separation of Concerns**

- **Components** are organized by their purpose (UI, layout, game, modals, common)
- **Pages** are grouped by feature area (auth, game, profile, admin)
- **Shared** resources are centralized for easy access

### 2. **Easier Navigation**

- Developers can quickly find what they need
- Related files are grouped together
- Clear naming conventions

### 3. **Better Maintainability**

- Changes to specific features are contained within their folders
- Easier to refactor and update
- Reduced coupling between different parts of the app

### 4. **Scalability**

- Easy to add new components in the right location
- Structure supports team collaboration
- Clear patterns for new developers

## 📦 Import Patterns

### Using Barrel Exports

```javascript
// Instead of multiple imports:
import Icon from '../components/ui/Icon.jsx';
import SearchBar from '../components/ui/SearchBar.jsx';

// Use barrel exports:
import { Icon, SearchBar } from '../components/ui';
```

### Absolute Imports (Recommended Setup)

```javascript
// Set up path mapping in vite.config.js for cleaner imports:
import { useAuth } from '@/shared/hooks';
import { PlayerCard } from '@/components/game';
import { CreateGameModal } from '@/components/modals';
```

## 🚀 Best Practices

1. **Component Organization**: Place components in the most specific folder that applies
2. **Barrel Exports**: Use index.js files for clean imports
3. **Co-location**: Keep related CSS files near their components
4. **Naming**: Use clear, descriptive names for files and folders
5. **Documentation**: Update this README when adding new major folders

## 🔧 Migration Notes

All existing imports will need to be updated to reflect the new file locations. Consider using VS Code's "Find and Replace in Files" feature with regex patterns to update import statements efficiently.

Example migration patterns:

- `from '../services/` → `from '../shared/api/`
- `from '../hooks/` → `from '../shared/hooks/`
- `from '../contexts/` → `from '../shared/contexts/`
