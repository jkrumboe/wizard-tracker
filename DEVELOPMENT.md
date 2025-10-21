# Development Guide

This guide provides detailed information for developers working on KeepWiz.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style and Standards](#code-style-and-standards)
- [Common Development Tasks](#common-development-tasks)
- [Debugging](#debugging)
- [Performance Optimization](#performance-optimization)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (comes with Node.js)
- **Git**: For version control
- **MongoDB**: v7.0 or higher (or use Docker)
- **Docker & Docker Compose**: (Optional) For containerized development

### Recommended Tools

- **VS Code**: With recommended extensions:
  - ESLint
  - Prettier
  - ES7+ React/Redux/React-Native snippets
  - MongoDB for VS Code
  - Docker

## Development Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/jkrumboe/wizard-tracker.git
cd wizard-tracker
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Generate a secure JWT secret:

```bash
npm run setup-env
```

### 3. Choose Your Development Setup

#### Option A: Full Stack with Docker (Recommended)

Start all services (MongoDB, Backend, Frontend):

```bash
docker compose up
```

Access points:
- Frontend: http://localhost:8088
- Backend API: http://localhost:5000
- MongoDB Admin: http://localhost:8081

#### Option B: Manual Setup (More Control)

**Backend Development:**

```bash
cd backend
npm install
npm run dev
```

The backend will run on http://localhost:5000 with hot reload.

**Frontend Development:**

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on http://localhost:3000 with hot module replacement (HMR).

#### Option C: Hybrid Setup

Run backend and MongoDB in Docker, frontend locally:

```bash
# Start backend services
docker compose up -d backend mongodb

# In a separate terminal
cd frontend
npm install
npm run dev
```

This provides the best of both worlds: stable backend services and fast frontend development.

## Project Structure

```
wizard-tracker/
├── backend/                 # Node.js/Express backend
│   ├── models/             # MongoDB models (Mongoose)
│   ├── routes/             # API route handlers
│   ├── middleware/         # Express middleware (auth, error handling)
│   ├── tests/              # Backend tests
│   └── server.js           # Entry point
├── frontend/               # React frontend (Vite)
│   ├── src/
│   │   ├── app/           # App initialization and routing
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── shared/        # Shared utilities and logic
│   │   │   ├── api/       # API client and endpoints
│   │   │   ├── contexts/  # React contexts
│   │   │   ├── db/        # IndexedDB/Dexie setup
│   │   │   ├── hooks/     # Custom React hooks
│   │   │   ├── schemas/   # Data schemas and validation
│   │   │   ├── sync/      # Sync engine (online/offline)
│   │   │   └── utils/     # Utility functions
│   │   └── styles/        # CSS/SCSS styles
│   └── public/            # Static assets
├── scripts/               # Build and utility scripts
└── docker-compose.yml     # Docker orchestration
```

## Development Workflow

### 1. Feature Development

Create a new branch for your feature:

```bash
git checkout -b feature/your-feature-name
```

### 2. Making Changes

- **Backend**: Edit files in `backend/`, server auto-restarts with nodemon
- **Frontend**: Edit files in `frontend/src/`, HMR updates the browser automatically
- **Models**: Changes to MongoDB models require backend restart

### 3. Running Tests

**Backend Tests:**

```bash
cd backend
npm test
```

**Frontend Tests:**

```bash
cd frontend
npm test
```

### 4. Code Quality Checks

Run linting:

```bash
# Frontend
cd frontend
npm run lint

# Backend
cd backend
npm run lint
```

Fix linting issues automatically:

```bash
npm run lint:fix
```

### 5. Commit Your Changes

Follow conventional commit messages:

```bash
git add .
git commit -m "feat: add new game mode"
git commit -m "fix: resolve sync conflict issue"
git commit -m "docs: update API documentation"
```

Commit types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

## Testing

### Backend Testing

The backend uses Jest for testing:

```bash
cd backend
npm test                    # Run all tests
npm test -- --watch        # Run tests in watch mode
npm test -- --coverage     # Run tests with coverage report
```

### Frontend Testing

The frontend uses Vitest and React Testing Library:

```bash
cd frontend
npm test                    # Run all tests
npm test -- --watch        # Run tests in watch mode
npm test -- --coverage     # Run tests with coverage report
```

### Manual Testing

Test the application manually by:
1. Creating test users
2. Creating and playing games
3. Testing online/offline transitions
4. Testing sync conflicts
5. Testing PWA features (offline mode, install prompt)

## Code Style and Standards

### JavaScript/React Standards

- Use **ES6+** syntax
- Use **functional components** with hooks
- Use **async/await** for asynchronous code
- Follow **React hooks** best practices
- Use **prop-types** or **TypeScript** for type checking

### File Organization

- One component per file
- Co-locate related files (component + styles + tests)
- Use index.js for clean exports
- Keep components small and focused

### Naming Conventions

- **Components**: PascalCase (e.g., `GameCard.jsx`)
- **Hooks**: camelCase with 'use' prefix (e.g., `useGameState.js`)
- **Utils**: camelCase (e.g., `formatDate.js`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)

### CSS Standards

- Use CSS Modules or styled-components
- Follow BEM methodology for class naming
- Use CSS custom properties for theming
- Mobile-first responsive design

## Common Development Tasks

### Adding a New API Endpoint

1. Create route handler in `backend/routes/`
2. Add validation middleware if needed
3. Update API documentation
4. Add tests for the endpoint
5. Update frontend API client in `frontend/src/shared/api/`

### Adding a New Page

1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/app/App.jsx`
3. Update navigation in `frontend/src/components/layout/Navbar.jsx`
4. Add tests for the page

### Adding a New Database Model

1. Create model in `backend/models/`
2. Add any necessary indexes
3. Update related API endpoints
4. Add migration if needed
5. Update documentation

### Updating Version

```bash
cd frontend
npm run update-version
```

This script updates version numbers in:
- `package.json`
- `manifest.json`
- README badges

## Debugging

### Backend Debugging

**Using VS Code Debugger:**

1. Set breakpoints in your code
2. Start the debugger with Node.js configuration
3. Send requests to the API

**Console Logging:**

```javascript
console.log('Debug info:', variable);
console.error('Error occurred:', error);
```

### Frontend Debugging

**React DevTools:**

Install the React DevTools browser extension for component inspection.

**Redux DevTools:** (if using Redux)

Install Redux DevTools extension for state debugging.

**Console Debugging:**

```javascript
console.log('State:', state);
console.table(arrayData);
```

**Network Tab:**

Monitor API calls in browser DevTools Network tab.

### Database Debugging

**MongoDB Compass:**

Connect to `mongodb://localhost:27017` to browse and query data.

**Mongo Express:**

Access MongoDB admin interface at http://localhost:8081

### Docker Debugging

View container logs:

```bash
docker compose logs -f              # All containers
docker compose logs -f backend      # Specific container
```

Enter a running container:

```bash
docker exec -it wizard-backend sh
```

## Performance Optimization

### Frontend Performance

- **Code Splitting**: Use dynamic imports for route-based splitting
- **Lazy Loading**: Load components and images on demand
- **Memoization**: Use `React.memo`, `useMemo`, `useCallback`
- **Virtual Scrolling**: For large lists
- **Image Optimization**: Use WebP format, lazy loading
- **Bundle Analysis**: Run `npm run build -- --analyze`

### Backend Performance

- **Database Indexing**: Add indexes to frequently queried fields
- **Query Optimization**: Use projection to limit returned fields
- **Caching**: Implement Redis for frequently accessed data
- **Connection Pooling**: Configure MongoDB connection pool
- **Compression**: Use gzip compression middleware

### Network Performance

- **API Response Compression**: Enable gzip on backend
- **Request Batching**: Combine multiple API calls
- **Debouncing**: Debounce search and input handlers
- **Service Worker**: Cache static assets and API responses

## Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill
```

**Docker Issues:**
```bash
docker compose down -v           # Remove volumes
docker system prune -f           # Clean up
docker compose build --no-cache  # Rebuild without cache
```

**Node Modules Issues:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Hot Reload Not Working:**
- Check if files are saved
- Restart the dev server
- Clear browser cache
- Check file watchers limit (Linux)

## Additional Resources

- [Architecture Overview](ARCHITECTURE.md)
- [Setup Guide](SETUP.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [API Documentation](backend/API_EXAMPLES.md)
- [Frontend Setup](frontend/README.md)

## Getting Help

- Check existing documentation first
- Search GitHub issues for similar problems
- Create a new issue with detailed description
- Join the project discussions on GitHub
