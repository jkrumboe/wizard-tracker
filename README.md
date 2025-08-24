# KeepWiz

![Version](https://img.shields.io/badge/version-1.1.10.5-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen)

A full-stack application for tracking and managing Wizard card game scores, player statistics, and hosting multiplayer games.

## Features

- Track player stats and game history
- Comprehensive player leaderboards and statistics
- Appwrite backend for authentication and real-time features
- User authentication and authorization
- Mobile-friendly responsive design with PWA support

## Getting Started

## Environment Variables

Before running the application, set up your environment variables:

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Update the values in `.env` with your Appwrite configuration:

   - `VITE_APPWRITE_PUBLIC_ENDPOINT`: Your Appwrite server endpoint
   - `VITE_APPWRITE_PROJECT_ID`: Your Appwrite project ID

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

# Start the frontend (it connects to Appwrite)
docker compose up
```

The application will be available at:

### Vite:

Frontend: <http://localhost:3000>

### Docker:

Frontend: <http://localhost:8088>

## Online/Offline Mode

KeepWiz uses Appwrite's real-time database to control online/offline mode. When set to `false`, multiplayer features are disabled while local gameplay remains available. This allows toggling maintenance mode through the Appwrite console.

### Toggle Online/Offline Mode

Control the online status through the Appwrite console:

- Access your Appwrite console
- Navigate to the databases section  
- Toggle the online status document as needed
- Changes are applied in real-time across all connected clients

## Documentation

For setting up the React frontend with Appwrite see [`frontend/src/docs/Frontend-Setup.md`](frontend/src/docs/Frontend-Setup.md).

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
- [PostgreSQL](https://www.postgresql.org/)
- [Appwrite](https://appwrite.io/)
