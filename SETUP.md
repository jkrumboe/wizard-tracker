# Setup and Deployment Guide

This guide covers the setup and deployment of KeepWiz for both development and production environments.

## Environment Variables

The application uses environment variables for configuration. There are two types:

- **Build-time variables**: `VITE_APP_VERSION`, `VITE_BUILD_DATE` are baked into the Docker image
- **Runtime variables**: Can be overridden with environment variables or a production `.env` file

## Development Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB (for backend features)
- Docker and Docker Compose (optional)

### Steps

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. For development, the defaults in `.env` work out of the box.

3. (Optional) Generate a secure JWT secret:

```bash
npm run setup-env
```

## Installation & Usage

### Option 1: Manual Setup (Recommended)

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at: <http://localhost:3000>

#### Backend Setup

```bash
cd backend
npm install
npm start
```

The backend API will be available at: <http://localhost:5000>

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

- Frontend: <http://localhost:8088>
- Backend API: <http://localhost:5000>
- MongoDB Admin: <http://localhost:8081> (admin/admin123)

## Production Deployment

### Environment Variables

For production, override these critical variables:

```bash
# Set these in your production environment
JWT_SECRET=your-secure-production-jwt-secret
ME_CONFIG_BASICAUTH_USERNAME=your-admin-username  
ME_CONFIG_BASICAUTH_PASSWORD=your-secure-password
```

### Production Best Practices

1. **Security**: Always use strong, unique passwords and JWT secrets
2. **Environment Files**: Never commit `.env` files with production credentials
3. **MongoDB**: Use a managed MongoDB service or secure your MongoDB instance
4. **SSL/TLS**: Use HTTPS in production with valid SSL certificates
5. **Monitoring**: Set up logging and monitoring for your production environment

### Docker Production Deployment

The Docker Compose file provides secure defaults that work for development and can be easily overridden for production without rebuilding images.

```bash
# Build with production environment variables
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Manual Production Deployment

1. Build the frontend:

```bash
cd frontend
npm install
npm run build
```

2. Set up the backend:

```bash
cd backend
npm install
NODE_ENV=production npm start
```

3. Configure a reverse proxy (nginx, Apache) to serve the frontend and proxy API requests to the backend.

## Troubleshooting

### Common Issues

- **Port conflicts**: Ensure ports 3000, 5000, 8081, and 8088 are available
- **MongoDB connection**: Verify MongoDB is running and accessible
- **Environment variables**: Double-check your `.env` file configuration
- **Docker issues**: Try `docker compose down` and `docker compose up --build`

### Getting Help

- Check the [Development Guide](https://github.com/jkrumboe/wizard-tracker/wiki/Development-Guide)
- Review the [Architecture Overview](https://github.com/jkrumboe/wizard-tracker/wiki/Architecture-Overview)
- Open an issue on GitHub if you encounter problems
