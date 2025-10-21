# Architecture Overview

This document provides a comprehensive overview of KeepWiz's architecture, including system design, data flow, and key components.

## Table of Contents

- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Application Layers](#application-layers)
- [Data Architecture](#data-architecture)
- [Authentication & Authorization](#authentication--authorization)
- [Sync Architecture](#sync-architecture)
- [API Design](#api-design)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Deployment Architecture](#deployment-architecture)

## System Architecture

KeepWiz is a full-stack Progressive Web Application (PWA) with both online and offline capabilities.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │         React SPA (Vite + React Router)          │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │     Service Worker (PWA + Caching)       │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │  IndexedDB (Dexie.js) - Local Storage   │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         ↕ HTTP/REST
┌─────────────────────────────────────────────────────────┐
│                   Backend Layer                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │        Node.js + Express REST API                │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │   JWT Authentication Middleware          │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │   Mongoose ODM + Business Logic          │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         ↕ MongoDB Protocol
┌─────────────────────────────────────────────────────────┐
│                  Database Layer                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         MongoDB (Document Database)              │   │
│  │  - Users, Games, GameEvents, GameSnapshots       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 18.3+
- **Build Tool**: Vite 5.x
- **Routing**: React Router v6
- **State Management**: React Context API + Custom Hooks
- **Local Database**: Dexie.js (IndexedDB wrapper)
- **HTTP Client**: Fetch API with custom wrapper
- **Styling**: CSS3 with CSS Modules
- **PWA**: Service Worker API, Workbox

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database ODM**: Mongoose 8.x
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: express-validator

### Database
- **Primary DB**: MongoDB 7.x
- **Admin UI**: Mongo Express

### DevOps
- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx (production frontend)
- **Version Control**: Git

## Application Layers

### 1. Presentation Layer (Frontend)
- **Components**: Reusable UI components
- **Pages**: Route-level components
- **Layouts**: Common layout structures (Navbar, etc.)
- **Styles**: Modular CSS and themes

### 2. Application Layer (Frontend Logic)
- **Hooks**: Custom React hooks for logic reuse
- **Contexts**: Global state management
- **Utils**: Helper functions and utilities
- **Validation**: Schema validation with Zod/Yup

### 3. API Layer (Frontend/Backend Interface)
- **API Client**: Centralized HTTP client
- **Endpoints**: Typed API endpoint definitions
- **Error Handling**: Consistent error responses

### 4. Business Logic Layer (Backend)
- **Routes**: Request handlers and routing
- **Middleware**: Authentication, validation, error handling
- **Services**: Business logic and data manipulation

### 5. Data Access Layer (Backend)
- **Models**: Mongoose schemas and models
- **Repositories**: Data access patterns
- **Migrations**: Database schema changes

### 6. Persistence Layer
- **MongoDB**: Primary data store (online mode)
- **IndexedDB**: Local data store (offline mode)

## Data Architecture

### Database Schema

#### Users Collection
```javascript
{
  _id: ObjectId,
  username: String (unique, indexed),
  passwordHash: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Games Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, indexed),
  gameMode: String,
  players: Array<Player>,
  rounds: Array<Round>,
  status: String (enum: 'active', 'completed', 'paused'),
  winner: ObjectId (ref: Player),
  startTime: Date,
  endTime: Date,
  createdAt: Date,
  updatedAt: Date,
  syncVersion: Number
}
```

#### GameEvents Collection
```javascript
{
  _id: ObjectId,
  gameId: ObjectId (ref: Game, indexed),
  userId: ObjectId (ref: User),
  eventType: String,
  eventData: Mixed,
  timestamp: Date,
  sequenceNumber: Number
}
```

#### GameSnapshots Collection
```javascript
{
  _id: ObjectId,
  gameId: ObjectId (ref: Game, indexed),
  snapshotData: Mixed,
  version: Number,
  createdAt: Date
}
```

#### OnlineStatus Collection
```javascript
{
  _id: ObjectId,
  isOnline: Boolean,
  message: String,
  lastUpdated: Date
}
```

### IndexedDB Schema (Offline Storage)

The frontend uses Dexie.js to manage IndexedDB with the following stores:

- **games**: Local game data
- **players**: Player information
- **syncQueue**: Pending sync operations
- **settings**: User preferences

### Data Flow

#### Online Mode
```
User Action → React Component → API Client → Backend API 
→ MongoDB → Response → Update UI
```

#### Offline Mode
```
User Action → React Component → Local State → IndexedDB 
→ Update UI → Queue for Sync
```

#### Sync Process
```
Network Available → Sync Manager → Check Conflicts 
→ Resolve → Send to Backend → Update Local → Clear Queue
```

## Authentication & Authorization

### Authentication Flow

1. **Registration**:
   - User submits username and password
   - Backend hashes password with bcrypt (10 salt rounds)
   - User record created in MongoDB
   - JWT token generated and returned

2. **Login**:
   - User submits credentials
   - Backend validates password hash
   - JWT token generated with user ID and username
   - Token stored in localStorage (frontend)

3. **Authenticated Requests**:
   - Token sent in Authorization header: `Bearer <token>`
   - Backend middleware validates token
   - User ID extracted and attached to request
   - Request processed with user context

### JWT Token Structure
```javascript
{
  userId: ObjectId,
  username: String,
  iat: Timestamp (issued at),
  exp: Timestamp (expires - 24 hours)
}
```

### Authorization

- **Route Protection**: Frontend routes protected by `AuthProtectedRoute`
- **API Protection**: Backend middleware `verifyToken` checks authentication
- **Resource Ownership**: Users can only access/modify their own data

## Sync Architecture

KeepWiz implements a sophisticated event-sourcing sync system for online/offline transitions.

### Sync Components

#### 1. Sync Manager (`syncManager.js`)
- Coordinates sync operations
- Manages sync queue
- Handles network state changes
- Triggers conflict resolution

#### 2. Event Replayer (`eventReplayer.js`)
- Reconstructs game state from events
- Applies local changes to server state
- Ensures deterministic state

#### 3. Conflict Resolver (`conflictResolver.js`)
- Detects sync conflicts
- Applies resolution strategies
- Merges local and server changes

#### 4. Persistence Middleware (`persistenceMiddleware.js`)
- Intercepts state changes
- Persists to IndexedDB
- Queues sync operations

### Sync Strategies

#### Last Write Wins (LWW)
- Simple conflict resolution
- Uses timestamp to determine winner
- Suitable for user preferences

#### Event Sourcing
- All changes stored as events
- State reconstructed from event log
- Enables precise conflict resolution
- Used for game state

#### Optimistic UI Updates
- UI updates immediately
- Sync happens in background
- Rollback on conflict/error

### Sync Flow

```
┌─────────────────────────────────────────┐
│  User makes change while offline        │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Event logged in IndexedDB sync queue   │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Network becomes available              │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Sync Manager starts sync process       │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Fetch latest server state              │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Detect conflicts (version mismatch)    │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Resolve conflicts (Event Sourcing)     │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Send merged events to server           │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Update local state with server response│
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Clear sync queue                       │
└─────────────────────────────────────────┘
```

## API Design

### RESTful Principles

The backend API follows REST conventions:

- **Resources**: Nouns (users, games, events)
- **HTTP Methods**: GET (read), POST (create), PUT/PATCH (update), DELETE (delete)
- **Status Codes**: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 404 (not found), 500 (server error)
- **Pagination**: Query params (page, limit)
- **Filtering**: Query params (status, date range)

### API Structure

```
/api
├── /users
│   ├── POST   /register          # Create new user
│   ├── POST   /login             # Authenticate user
│   ├── GET    /profile           # Get user profile
│   └── PATCH  /profile           # Update profile
├── /games
│   ├── GET    /                  # List user's games
│   ├── POST   /                  # Create new game
│   ├── GET    /:id               # Get game details
│   ├── PATCH  /:id               # Update game
│   ├── DELETE /:id               # Delete game
│   └── GET    /stats             # Get game statistics
├── /game-sync
│   ├── POST   /events            # Submit game events
│   ├── GET    /events/:gameId    # Get game events
│   └── GET    /snapshot/:gameId  # Get game snapshot
└── /online
    ├── GET    /status            # Get online status
    └── POST   /status            # Update online status (admin)
```

### Response Format

Success:
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

Error:
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

## Frontend Architecture

### Component Structure

```
components/
├── common/          # Shared components
├── layout/          # Layout components
├── game/            # Game-specific components
├── ui/              # UI primitives
└── modals/          # Modal dialogs
```

### State Management

- **Local State**: `useState` for component-specific state
- **Shared State**: Context API for app-wide state
- **Server State**: React Query patterns for API data
- **Persistent State**: IndexedDB for offline data

### Routing

Protected routes ensure authentication:

```jsx
<Route path="/profile" element={
  <AuthProtectedRoute>
    <Profile />
  </AuthProtectedRoute>
} />
```

Online-only features:

```jsx
<Route path="/multiplayer" element={
  <OnlineProtectedRoute>
    <MultiplayerGame />
  </OnlineProtectedRoute>
} />
```

## Backend Architecture

### Middleware Stack

```
Request
  ↓
CORS Middleware
  ↓
Body Parser
  ↓
Auth Middleware (if protected route)
  ↓
Validation Middleware
  ↓
Route Handler
  ↓
Error Handler
  ↓
Response
```

### Error Handling

Centralized error handling middleware:
- Catches all errors
- Formats error responses
- Logs errors for debugging
- Sanitizes sensitive information

### Security

- **Password Security**: bcrypt hashing
- **JWT Tokens**: Signed and expiring tokens
- **Input Validation**: Express-validator
- **CORS**: Configured for allowed origins
- **Rate Limiting**: (Recommended for production)
- **Helmet**: Security headers (Recommended)

## Deployment Architecture

### Docker Compose Stack

```
┌──────────────────────────────────────────┐
│              Nginx (Frontend)             │
│         Port 8088 (external)              │
│    - Serves static React build           │
│    - Proxies /api to backend             │
└────────────┬─────────────────────────────┘
             │
┌────────────▼─────────────────────────────┐
│      Node.js/Express (Backend)           │
│         Port 5000 (internal)             │
│    - REST API                            │
│    - JWT authentication                  │
└────────────┬─────────────────────────────┘
             │
┌────────────▼─────────────────────────────┐
│           MongoDB                         │
│         Port 27017 (internal)            │
│    - Document store                      │
│    - Persistent volume                   │
└────────────┬─────────────────────────────┘
             │
┌────────────▼─────────────────────────────┐
│         Mongo Express (Admin)            │
│         Port 8081 (external)             │
│    - Database administration UI          │
└──────────────────────────────────────────┘
```

### Container Communication

All services communicate via Docker network:
- Frontend container calls backend at `http://backend:5000`
- Backend container calls MongoDB at `mongodb://mongodb:27017`

### Volumes

- **mongodb_data**: Persistent MongoDB storage
- **node_modules**: Cached for faster builds

### Health Checks

Each service has health checks:
- MongoDB: `mongosh` ping
- Backend: HTTP request to `/api/health`
- Frontend: Nginx running check

## Performance Considerations

### Frontend Optimization

- **Code Splitting**: Route-based chunks
- **Lazy Loading**: Components and images
- **Memoization**: `React.memo`, `useMemo`, `useCallback`
- **Service Worker**: Cache static assets
- **Image Optimization**: Responsive images, WebP

### Backend Optimization

- **Database Indexing**: userId, gameId indexed
- **Connection Pooling**: MongoDB connection pool
- **Query Optimization**: Projection to limit fields
- **Caching**: Consider Redis for hot data

### Network Optimization

- **Compression**: Gzip/Brotli compression
- **CDN**: Static assets on CDN (production)
- **HTTP/2**: Multiplexed connections
- **Request Batching**: Combine API calls

## Scalability

### Horizontal Scaling

- **Frontend**: Stateless, scale with load balancer
- **Backend**: Stateless API, multiple instances
- **Database**: MongoDB replica sets and sharding

### Vertical Scaling

- Increase container resources (CPU, memory)
- Optimize database queries and indexes
- Use caching layers

## Monitoring and Observability

### Recommended Tools

- **Application Monitoring**: New Relic, Datadog
- **Log Aggregation**: ELK Stack, Splunk
- **Error Tracking**: Sentry
- **Uptime Monitoring**: Pingdom, UptimeRobot
- **Analytics**: Google Analytics, Mixpanel

### Key Metrics

- **Frontend**: Page load time, TTI, FCP, CLS
- **Backend**: Response time, error rate, throughput
- **Database**: Query time, connection pool usage
- **Infrastructure**: CPU, memory, disk usage

## Security Best Practices

1. **Environment Variables**: Never commit secrets
2. **HTTPS**: Always use SSL/TLS in production
3. **Input Validation**: Validate all user input
4. **Output Encoding**: Prevent XSS attacks
5. **SQL/NoSQL Injection**: Use parameterized queries
6. **CSRF Protection**: Implement CSRF tokens for state-changing operations
7. **Rate Limiting**: Prevent abuse
8. **Security Headers**: Use Helmet.js
9. **Dependency Scanning**: Regular security audits
10. **Backup Strategy**: Regular database backups

## Future Architecture Considerations

### Potential Enhancements

- **WebSockets**: Real-time multiplayer with Socket.io
- **GraphQL**: More flexible API queries
- **TypeScript**: Type safety across the stack
- **Microservices**: Separate game logic, user management, etc.
- **Caching Layer**: Redis for session and data caching
- **Message Queue**: RabbitMQ/Kafka for async processing
- **Serverless Functions**: AWS Lambda for specific tasks

## Additional Resources

- [Development Guide](DEVELOPMENT.md)
- [Setup Guide](SETUP.md)
- [API Documentation](backend/API_EXAMPLES.md)
- [Contributing Guidelines](CONTRIBUTING.md)
