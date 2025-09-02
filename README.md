# KeepWiz

![Version](https://img.shields.io/badge/version-1.2.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen)

A full-stack application for tracking and managing Wizard card game scores, player statistics, and hosting multiplayer games.

## Features

- Track player stats and game history
- Comprehensive player leaderboards and statistics
- MongoDB backend for authentication and real-time features
- User authentication and authorization
- Mobile-friendly responsive design with PWA support

## Getting Started

## Environment Variables

The application uses environment variables for configuration. There are two types:

### Development Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

1. For development, the defaults in `.env` work out of the box.

1. (Optional) Generate a secure JWT secret:

```bash
npm run setup-env
```

### Production Deployment

The Docker Compose setup uses environment variables with sensible defaults:

- **Build-time variables**: `VITE_APP_VERSION`, `VITE_BUILD_DATE` are baked into the Docker image
- **Runtime variables**: Can be overridden with environment variables or a production `.env` file

For production, override these critical variables:

```bash
# Set these in your production environment
JWT_SECRET=your-secure-production-jwt-secret
ME_CONFIG_BASICAUTH_USERNAME=your-admin-username  
ME_CONFIG_BASICAUTH_PASSWORD=your-secure-password
```

The Docker Compose file provides secure defaults that work for development and can be easily overridden for production without rebuilding images.

## Installation & Usage

### Option 1: Manual Setup (Recommended)

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Option 2: Docker Compose

The easiest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/jkrumboe/wizard-tracker.git
cd wizard-tracker

# Start the full application stack
docker compose up
```

The application will be available at:

### Vite:

Frontend: <http://localhost:3000>

### Docker:

Frontend: <http://localhost:8088>
Backend API: <http://localhost:5000>
MongoDB Admin: <http://localhost:8081> (admin/admin123)

## Online/Offline Mode

KeepWiz uses the MongoDB backend to control online/offline mode. When set to `false`, multiplayer features are disabled while local gameplay remains available. This allows toggling maintenance mode through the backend API.

### Toggle Online/Offline Mode

Control the online status through the backend API:

- Access the backend API endpoints
- Navigate to the online status endpoints  
- Toggle the online status as needed
- Changes are applied in real-time across all connected clients

## Documentation

For setting up the React frontend see [`frontend/src/docs/Frontend-Setup.md`](frontend/src/docs/Frontend-Setup.md).

Key documentation pages:

- [Getting Started](https://github.com/jkrumboe/wizard-tracker/wiki/Getting-Started)
- [Architecture Overview](https://github.com/jkrumboe/wizard-tracker/wiki/Architecture-Overview)
- [API Structure](https://github.com/jkrumboe/wizard-tracker/wiki/API-Structure)
- [How to Contribute](https://github.com/jkrumboe/wizard-tracker/wiki/How-to-Contribute)

## Development

For local development, see the [Development Guide](https://github.com/jkrumboe/wizard-tracker/wiki/Development-Guide).

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more information on how to get started.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [React](https://reactjs.org/)
- [MongoDB](https://www.mongodb.com/)
- [Node.js](https://nodejs.org/)
