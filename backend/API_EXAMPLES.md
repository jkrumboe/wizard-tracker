# API Usage Examples

This document provides examples of how to use the Wizard Tracker backend API.

## Base URL
```
http://localhost:5000/api
```

## Authentication Examples

### Register a New User

```bash
curl -X POST http://localhost:5000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "securepassword123"
  }'
```

**Response:**
```json
{
  "message": "User created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64f8a1b2c3d4e5f6g7h8i9j0",
    "username": "johndoe",
    "createdAt": "2023-09-06T10:30:00.000Z"
  }
}
```

### Login

```bash
curl -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "securepassword123"
  }'
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64f8a1b2c3d4e5f6g7h8i9j0",
    "username": "johndoe",
    "createdAt": "2023-09-06T10:30:00.000Z"
  }
}
```

## Game Management Examples

> **Note:** All game endpoints require authentication. Include the token in the Authorization header.

### Create a Game

```bash
curl -X POST http://localhost:5000/api/games \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "score": 150
  }'
```

**Response:**
```json
{
  "message": "Game created successfully",
  "game": {
    "id": "64f8a1b2c3d4e5f6g7h8i9j1",
    "userId": "64f8a1b2c3d4e5f6g7h8i9j0",
    "username": "johndoe",
    "score": 150,
    "createdAt": "2023-09-06T10:35:00.000Z"
  }
}
```

### Get All Games

```bash
curl -X GET http://localhost:5000/api/games \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "games": [
    {
      "id": "64f8a1b2c3d4e5f6g7h8i9j1",
      "userId": "64f8a1b2c3d4e5f6g7h8i9j0",
      "username": "johndoe",
      "score": 150,
      "createdAt": "2023-09-06T10:35:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalGames": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### Get Games with Pagination

```bash
curl -X GET "http://localhost:5000/api/games?page=1&limit=5&sortOrder=desc" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Get Game Statistics

```bash
curl -X GET http://localhost:5000/api/games/stats \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "username": "johndoe",
  "stats": {
    "totalGames": 5,
    "averageScore": 142.6,
    "highestScore": 200,
    "lowestScore": 85,
    "totalScore": 713
  }
}
```

## JavaScript/Frontend Integration

### Using Fetch API

```javascript
// Register
const registerUser = async (username, password) => {
  const response = await fetch('http://localhost:5000/api/users/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('token', data.token);
    return data;
  }
  throw new Error(data.error);
};

// Login
const loginUser = async (username, password) => {
  const response = await fetch('http://localhost:5000/api/users/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('token', data.token);
    return data;
  }
  throw new Error(data.error);
};

// Create Game
const createGame = async (score) => {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:5000/api/games', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ score })
  });
  
  const data = await response.json();
  if (response.ok) {
    return data;
  }
  throw new Error(data.error);
};

// Get Games
const getGames = async (page = 1, limit = 10) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`http://localhost:5000/api/games?page=${page}&limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  if (response.ok) {
    return data;
  }
  throw new Error(data.error);
};
```

## Error Handling

The API returns standardized error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created successfully
- `400`: Bad request (validation error)
- `401`: Unauthorized (authentication required or invalid)
- `404`: Not found
- `500`: Internal server error

### Example Error Responses

**Validation Error:**
```json
{
  "error": "Validation Error",
  "details": ["Username is required", "Password must be at least 6 characters long"]
}
```

**Authentication Error:**
```json
{
  "error": "Invalid token"
}
```

**Duplicate Username:**
```json
{
  "error": "username already exists"
}
```
