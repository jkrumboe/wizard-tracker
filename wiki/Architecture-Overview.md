# Architecture Overview

KeepWiz is built using a modern web application architecture, combining a React frontend with a Node.js backend and PostgreSQL database. This document provides a high-level overview of the system's components and their interactions.

## System Architecture

The application consists of three main components:

1. **Frontend**: React-based web application
2. **Backend**: Node.js Express REST API server
3. **Database**: PostgreSQL database for persistent storage

![Architecture Diagram](https://via.placeholder.com/800x400?text=Wizard+Tracker+Architecture+Diagram)

### Docker Containerization

The system is containerized using Docker, with the following containers:

- **Frontend container**: Serves the React application through an Nginx web server
- **Backend container**: Runs the Node.js Express API server
- **Database container**: Runs the PostgreSQL database

Docker Compose orchestrates these containers, handling networking and volume management.

## Frontend Architecture

The frontend is built using:

- **React**: UI component library
- **Vite**: Build tool and development server
- **CSS**: Styling with modular CSS files
- **PWA Support**: Progressive Web App capabilities

### Frontend Structure

```
frontend/
├── public/                 # Static assets and PWA files
├── src/
│   ├── assets/             # Images and other static resources
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React contexts for state sharing
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Application page components
│   ├── services/           # API service functions
│   └── styles/             # CSS style files
├── App.jsx                 # Main application component
└── main.jsx               # Application entry point
```

## Backend Architecture

The backend follows a RESTful API architecture:

- **Express.js**: Web framework for handling HTTP requests
- **JWT Authentication**: Token-based user authentication
- **Colyseus**: Real-time game server for multiplayer support
- **PostgreSQL**: Database for persistent storage

### Backend Structure

```
backend/
├── src/
│   ├── db/                 # Database adapter and utilities
│   ├── middleware/         # Express middleware functions
│   ├── migrations/         # Database migration scripts
│   ├── rooms/              # Colyseus room definitions
│   │   ├── LobbyRoom.js    # Lobby management
│   │   └── WizardGameRoom.js # Game room logic
│   ├── routes/             # API route definitions
│   └── utils/              # Helper utilities
├── index.js                # Application entry point
└── schema-v2.sql           # Database schema definition
```

## Database Schema

The PostgreSQL database includes tables for:

- **Users**: User authentication and profile data
- **Players**: Player statistics and game history
- **Games**: Game records and results
- **Game_Participants**: Player participation in games
- **Game_Rounds**: Individual round data
- **Round_Performances**: Per-player results for each round
- **Tags**: Player classification tags
- **Player_Tags**: Mapping between players and tags
- **Rooms**: Active and historical game rooms

## Authentication Flow

1. User registers or logs in
2. Backend validates credentials and issues JWT tokens
3. Frontend stores tokens and includes them with API requests
4. Backend validates tokens on protected endpoints

## Real-time Game Flow

1. Host creates a game room
2. Room is registered in the database and with Colyseus
3. Players join the room
4. Game state is synchronized in real-time during play
5. Game results are saved to the database upon completion

## Data Flow

1. Frontend components request data through service classes
2. Service classes make HTTP requests to the backend API
3. Backend processes requests, interacts with the database
4. Backend returns responses to the frontend
5. Frontend updates UI based on the received data

## Security Considerations

- JWT tokens for authentication
- HTTP-only cookies for token storage
- CORS protection for API endpoints
- Rate limiting to prevent abuse
- Password hashing for secure storage
- Role-based access control
