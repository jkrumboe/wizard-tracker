# Getting Started with Wizard Tracker

Welcome to Wizard Tracker! This guide will help you get the application up and running for both development and production use.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (for containerized setup)
- [Node.js](https://nodejs.org/) v18 or higher (for local development)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/) (included with Node.js)
- [Git](https://git-scm.com/)

## Quick Start with Docker Compose

The simplest way to get Wizard Tracker running is with Docker Compose:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/wizard-tracker.git
   cd wizard-tracker
   ```

2. Start all services:
   ```bash
   docker compose up
   ```

3. Access the application:
   - Frontend: [http://localhost:8088](http://localhost:8088)
   - Backend API: [http://localhost:5055/api](http://localhost:5055/api)

4. (Optional) Rebuild the containers for changes:
   ```bash
   docker compose build --no-cache
   docker compose up
   ```
   
   Or use the VS Code task "Docker Compose Up (No Cache, Remove Previous)"

## Local Development Setup

If you prefer to run the services locally for development:

### Database Setup

1. You can still use the Docker container for the PostgreSQL database:
   ```bash
   docker compose up db
   ```

2. Or install PostgreSQL locally and create a new database:
   ```bash
   createuser wizard
   createdb -O wizard wizard_db
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following content:
   ```
   DATABASE_URL=postgres://wizard:geheim@localhost:5433/wizard_db
   JWT_SECRET=your_jwt_secret_here
   JWT_REFRESH_SECRET=your_refresh_secret_here
   JWT_ADMIN_SECRET=your_admin_secret_here
   NODE_ENV=development
   ```

4. Start the backend server:
   ```bash
   npm start
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create an environment configuration:
   ```bash
   cp env-config.js.template env-config.js
   ```
   
4. Edit `env-config.js` to point to your local backend:
   ```javascript
   window.ENV = {
     API_URL: 'http://localhost:5055/api',
   };
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```
   
   Or use the VS Code task "Start Frontend Dev"

6. Access the frontend at [http://localhost:3000](http://localhost:3000)

## Initial Login

After setting up the application, you can:

1. Register a new user account through the registration page
2. Set up the default admin account by sending a POST request to `/api/setup-admin`
   ```bash
   curl -X POST http://localhost:5055/api/setup-admin
   ```
   
   This creates an admin user with:
   - Username: admin
   - Password: admin123

## Next Steps

- Check out the [Architecture Overview](Architecture-Overview) to understand how the system is structured
- See the [API Structure](API-Structure) for details on backend endpoints
- Read [How to Contribute](How-to-Contribute) if you want to help develop the project
