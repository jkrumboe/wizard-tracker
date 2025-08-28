# Wizard Tracker Backend

A Node.js/Express backend API for the Wizard Tracker application with MongoDB and JWT authentication.

## Features

- **User Authentication**: Register and login with JWT tokens
- **Game Management**: Create and retrieve games for authenticated users
- **Security**: Password hashing with bcrypt, JWT token verification
- **Error Handling**: Comprehensive error handling and validation
- **Database**: MongoDB with Mongoose ODM

## API Endpoints

### Authentication

#### POST `/api/users/register`
Create a new user account.
```json
{
  "username": "string",
  "password": "string"
}
```

#### POST `/api/users/login`
Login with existing credentials.
```json
{
  "username": "string",
  "password": "string"
}
```

### Games (Authentication Required)

#### POST `/api/games`
Create a new game record.
```json
{
  "score": "number"
}
```

#### GET `/api/games`
Get all games for the authenticated user.
Query parameters:
- `page` (default: 1)
- `limit` (default: 10, max: 100)
- `sortOrder` (default: 'desc', options: 'asc', 'desc')

#### GET `/api/games/stats`
Get game statistics for the authenticated user.

### Health Check

#### GET `/api/health`
Check if the server is running.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment setup:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set:
   - `MONGO_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A secure random string for JWT signing

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Start production server:**
   ```bash
   npm start
   ```

## Authentication

All `/api/games` endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Models

### User
- `username`: Unique string (3-50 characters)
- `passwordHash`: Bcrypt hashed password
- `timestamps`: Auto-generated created/updated dates

### Game
- `userId`: Reference to User
- `score`: Non-negative number
- `createdAt`: Date of game creation
- `timestamps`: Auto-generated created/updated dates

## Error Handling

The API returns appropriate HTTP status codes and error messages:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication required)
- `404`: Not Found
- `500`: Internal Server Error

## Development

- Uses `nodemon` for development with auto-reload
- CORS enabled for frontend integration
- Comprehensive input validation
- Database indexes for performance
