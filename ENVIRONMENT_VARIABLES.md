# Environment Variables Update

This document outlines the changes made to support the new Appwrite environment variables in production builds.

## Added Environment Variables

The following environment variables have been added to support Appwrite database and collection configuration:

- `VITE_APPWRITE_DATABASE_ID` - The Appwrite database ID for storing application data
- `VITE_APPWRITE_GAMES_COLLECTION_ID` - The Appwrite collection ID for storing game data

## Updated Files

### 1. Docker Configuration
- **docker-compose.yml**: Added the new environment variables as build arguments
- **frontend/Dockerfile**: Added ARG and ENV declarations for the new variables

### 2. CI/CD Pipeline
- **.github/workflows/docker-build.yml**: Updated to include the new environment variables in both the environment section and build-args

### 3. Environment Configuration
- **/.env**: Cleaned up formatting and added the new variables for local development
- **/.env.example**: Updated template with all required environment variables
- **frontend/env-config.js.template**: Added the new variables for runtime configuration

## Production Deployment

When deploying to production, ensure these environment variables are set:

```bash
VITE_APPWRITE_PUBLIC_ENDPOINT=https://appwrite.jkrumboe.dev/v1
VITE_APPWRITE_PROJECT_ID=688cd65e00060f0e4d43
VITE_APPWRITE_DATABASE_ID=688cfb4b002d001bc2e5
VITE_APPWRITE_GAMES_COLLECTION_ID=6894f3030007a5fb47b8
VITE_APP_VERSION=1.1.7
```

## Docker Build

To build with the updated environment variables:

```bash
# Using docker-compose (recommended)
docker-compose build

# Or manually with docker build
docker build \
  --build-arg VITE_APPWRITE_PUBLIC_ENDPOINT=https://appwrite.jkrumboe.dev/v1 \
  --build-arg VITE_APPWRITE_PROJECT_ID=688cd65e00060f0e4d43 \
  --build-arg VITE_APPWRITE_DATABASE_ID=688cfb4b002d001bc2e5 \
  --build-arg VITE_APPWRITE_GAMES_COLLECTION_ID=6894f3030007a5fb47b8 \
  --build-arg VITE_APP_VERSION=1.1.7 \
  -t wizard-frontend ./frontend
```

## Notes

- All environment variables are now properly passed through the entire build pipeline
- The CI/CD workflow will automatically use the correct values for production builds
- Local development will use the values from the `.env` file in the project root
