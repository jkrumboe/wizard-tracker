# Wizard Tracker

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen)

A full-stack application for tracking and managing Wizard card game scores, player statistics, and hosting multiplayer games.

## 🔮 Features

- Track player stats, ELO ratings, and game history
- Real-time multiplayer game support via Colyseus
- Comprehensive player leaderboards and statistics
- User authentication and authorization
- Mobile-friendly responsive design with PWA support
- Admin dashboard for system management

## 🚀 Getting Started

### Option 1: Docker Compose (Recommended)

The easiest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/jkrumboe/wizard-tracker.git
cd wizard-tracker

# Start all services (database, backend, frontend)
docker compose up
```

The application will be available at:
- Frontend: http://localhost:8088
- Backend API: http://localhost:5055
- Database: localhost:5433 (PostgreSQL)

### Option 2: Manual Setup

#### Backend Setup
```bash
cd backend
npm install
npm start
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 📚 Documentation

Full documentation is available in our [Wiki](https://github.com/yourusername/wizard-tracker/wiki).

Key documentation pages:
- [Getting Started](https://github.com/yourusername/wizard-tracker/wiki/Getting-Started)
- [Architecture Overview](https://github.com/yourusername/wizard-tracker/wiki/Architecture-Overview)
- [API Structure](https://github.com/yourusername/wizard-tracker/wiki/API-Structure)
- [How to Contribute](https://github.com/yourusername/wizard-tracker/wiki/How-to-Contribute)

## 🛠️ Development

For local development, see the [Development Guide](https://github.com/yourusername/wizard-tracker/wiki/Development-Guide).

## 👥 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more information on how to get started.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [React](https://reactjs.org/)
- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Colyseus](https://colyseus.io/)
