# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Enhanced test coverage for frontend and backend
- Interactive onboarding tutorial for first-time users
- Internationalization support
- Additional game statistics and visualizations
- Social features expansion (leaderboards, achievements)

## [1.6.7] - 2025-11-14

### Added
- Progressive Web App (PWA) functionality with service worker
- Offline-first architecture with IndexedDB storage
- Online/offline sync with MongoDB backend
- JWT-based authentication system
- User registration and login
- Game score tracking for Wizard card game
- Real-time bid and trick tracking
- Advanced player statistics (win rates, streaks, bid accuracy)
- Game history with filtering and search
- Game sharing via URL with security validation
- Game templates for quick setup
- Multiple game modes (local, online, table games)
- Dark mode and light theme support
- Responsive mobile-first design
- Docker and Docker Compose deployment
- Friend system with friend requests
- Online status indicators
- Game snapshots and event sourcing
- Conflict resolution for sync
- Schema migration system
- Network recovery handling
- Auto-logout functionality
- Performance metrics tracking

### Technical
- React 19.0 with functional components and hooks
- Vite 6.2 build system
- Node.js/Express backend
- MongoDB 7.x database with Mongoose ODM
- Dexie.js for IndexedDB management
- Chart.js and Recharts for data visualization
- GitHub Actions CI/CD for Docker image builds
- Comprehensive documentation (ARCHITECTURE.md, DEVELOPMENT.md, SETUP.md)

### Security
- Password hashing with bcrypt
- JWT token authentication
- Input validation with express-validator
- XSS prevention with DOMPurify
- CORS configuration
- Security validation for shared games

## [1.0.0] - Initial Release

### Added
- Basic game tracking functionality
- Core application structure
- Initial documentation

---

## Types of Changes

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** in case of vulnerabilities

## Links

- [Unreleased]: https://github.com/jkrumboe/wizard-tracker/compare/v1.6.7...HEAD
- [1.6.7]: https://github.com/jkrumboe/wizard-tracker/releases/tag/v1.6.7
