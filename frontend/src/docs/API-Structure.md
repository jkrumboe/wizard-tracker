# API Structure

This document outlines the backend API endpoints available in the Wizard Tracker application, their functionality, and usage examples.

## Base URL

All API endpoints are prefixed with `/api`.

For local development: `http://localhost:5000/api`
For production: `https://wizard.jkrumboe.dev/api`

## Authentication

Most endpoints require authentication via JWT tokens. The token should be included in:

1. HTTP-only cookies (recommended for web apps)
2. Authorization header: `Authorization: Bearer <token>` (for API clients)

## Online/Offline Mode

The application supports online/offline mode functionality:

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/online/status` | GET | Get current online status | No |

## Authentication Endpoints

### User Authentication

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/login` | POST | User login | No |
| `/register` | POST | User registration | No |
| `/refresh` | POST | Refresh access token | Yes (refresh token) |
| `/logout` | POST | User logout | No |
| `/me` | GET | Get current user info | Yes |
| `/profile` | GET | Get current user profile | Yes |

### Admin Authentication

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/admin/login` | POST | Admin login | No |
| `/admin/logout` | POST | Admin logout | No |
| `/setup-admin` | POST | Create default admin (first-time only) | No |

## Player Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/players` | GET | Get all players | No |
| `/players` | POST | Create a new player | No |
| `/players/:id` | GET | Get player by ID | No |
| `/players/:id` | PUT | Update player | Yes |
| `/players/:id` | DELETE | Delete player | Yes |
| `/players/:id/games` | GET | Get player's game history | Yes |
| `/players/:id/stats` | GET | Get player's statistics | Yes |
| `/players/:id/tags` | GET | Get player's tags | No |
| `/players/:id/tags` | PUT | Update player's tags | Yes |
| `/players/:id/elo-history` | GET | Get player's ELO history | No |
| `/players/search/:tag` | GET | Search players by tag | No |

## Game Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/games` | GET | Get all games | No |
| `/games` | POST | Create a new game | No |
| `/games/:id` | GET | Get game by ID | No |
| `/games/recent` | GET | Get recent games | No |
| `/games/multiplayer` | GET | Get multiplayer game history | No |

## Tag Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/tags` | GET | Get all tags | No |

## Room Endpoints (Multiplayer)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/rooms/active` | GET | Get active game rooms | No |
| `/rooms/:roomId` | GET | Get room details by ID | No |
| `/rooms` | POST | Create a new game room | Yes |
| `/rooms/:roomId/colyseus` | PUT | Update room with Colyseus ID | No |
| `/rooms/:roomId/join` | POST | Join a room | Yes |
| `/rooms/:roomId/leave` | POST | Leave a room | Yes |
| `/player/session` | GET | Get player's current session | Yes |
| `/player/status` | POST | Update player online status | Yes |
| `/rooms/:roomId/verify-password` | POST | Verify password for private room | No |

## Protected/Admin Endpoints

| Endpoint | Method | Description | Auth Required | Roles |
|----------|--------|-------------|--------------|-------|
| `/protected` | GET | Example protected route | Yes | Admin |
| `/admin/players` | GET | Admin: Get all players | Yes | Admin |
| `/admin/players` | POST | Admin: Create player | Yes | Admin |
| `/admin/games` | GET | Admin: Get all games | Yes | Admin |

## Request and Response Examples

### Login

Request:

```json
POST /api/login
{
  "username": "player1",
  "password": "securePassword123"
}
```

Response:

```json
{
  "user": {
    "id": 1,
    "username": "player1",
    "role": 1,
    "player_id": 1
  },
  "message": "Login successful"
}
```

### Getting Player Information

Request:

```http
GET /api/players/1
```

Response:

```json
{
  "id": 1,
  "name": "player1",
  "display_name": "Player One",
  "avatar": "https://example.com/avatar.png",
  "elo": 1200,
  "win_rate": 0.65,
  "total_games": 20,
  "total_wins": 13,
  "total_losses": 7
}
```

### Creating a Game

Request:

```json
POST /api/games
{
  "players": [1, 2, 3, 4],
  "scores": {"1": 80, "2": 60, "3": 45, "4": 30},
  "winner": 1,
  "rounds": [...],
  "duration": 1800,
  "mode": "Ranked"
}
```

Response:

```json
{
  "message": "Game saved and Elo updated",
  "newEloMap": {
    "1": 1225,
    "2": 1190,
    "3": 980,
    "4": 1005
  }
}
```

## Error Handling

The API uses standard HTTP status codes for error responses:

- 200: Success
- 201: Resource created
- 400: Bad request
- 401: Unauthorized
- 403: Forbidden
- 404: Resource not found
- 409: Conflict
- 500: Internal server error

Error responses follow the format:

```json
{
  "error": "Error message description"
}
```

## Rate Limiting

API endpoints are protected by rate limiting:

- General API routes: 300 requests per 15-minute window per IP
- Authentication routes: 5 login attempts per 15-minute window per IP

When rate limit is exceeded, the server returns a 429 status code.

## Security Features

- JWT-based authentication with refresh tokens
- HTTP-only secure cookies for token storage  
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration for cross-origin requests
- Audit logging for authentication events
- Rate limiting for API protection

## Database Features

The backend uses PostgreSQL with the following key features:

- **Players Table**: Stores player information, ELO ratings, statistics
- **Games Table**: Game records with participant data and results
- **Users Table**: User accounts with role-based authentication
- **Game Rooms**: Multiplayer room management with Colyseus integration
- **ELO History**: Tracks rating changes over time
- **Tags System**: Player categorization and search functionality
- **Audit Logs**: Security and authentication event tracking

## Multiplayer Architecture

The application uses **Colyseus** for real-time multiplayer functionality:

- **Room Management**: Create, join, and leave game rooms
- **Real-time Communication**: WebSocket-based game state synchronization
- **Session Management**: Player online status and session tracking
- **Private Rooms**: Password-protected rooms for private games

## API Versioning

Currently, the API does not use explicit versioning in the URL paths. Future versions may be introduced using URL prefixes like `/api/v2/`.

## Development Notes

- **Port**: Backend runs on port 5000 (default) or configurable via PORT environment variable
- **CORS**: Configured for development (localhost:3000) and production domains
- **Environment**: Supports both development and production configurations
- **Database**: Uses connection pooling with retry logic for reliability
