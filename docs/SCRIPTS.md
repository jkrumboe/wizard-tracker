# NPM Scripts Reference

This document provides a comprehensive reference for all available npm scripts in the Wizard Tracker project.

## Table of Contents

- [Quick Start](#quick-start)
- [Setup & Initialization](#setup--initialization)
- [Development](#development)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Build & Deploy](#build--deploy)
- [Docker Management](#docker-management)
- [Health & Utilities](#health--utilities)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### First Time Setup

```bash
# Clone the repository
git clone https://github.com/jkrumboe/wizard-tracker.git
cd wizard-tracker

# Run interactive setup wizard
npm run init

# Start the application
npm start

# Verify everything is working
npm run health
```

### Quick Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start all services with Docker |
| `npm stop` | Stop all services |
| `npm run logs` | View application logs |
| `npm run health` | Check service health |
| `npm run verify` | Verify setup configuration |

---

## Setup & Initialization

### `npm run init`

**Interactive first-time setup wizard**

Guides you through the initial project setup with a friendly CLI interface.

**What it does:**
- Checks Node.js version (>= 18.0.0 required)
- Creates `.env` files from templates
- Asks about deployment preference (Docker vs Manual)
- Optionally generates JWT secrets
- Optionally runs setup verification

**Example:**
```bash
npm run init
```

**When to use:**
- First time setting up the project
- After cloning the repository
- When helping new contributors get started

---

### `npm run setup`

**Complete automated setup**

Runs the full setup process including initialization, dependency installation, and secret generation.

**What it does:**
1. Runs `npm run init`
2. Installs all dependencies (`npm run install:all`)
3. Generates secure JWT secrets (`npm run setup-env`)

**Example:**
```bash
npm run setup
```

**When to use:**
- Automated setup in CI/CD pipelines
- Quick setup without interactive prompts
- Setting up multiple environments

---

### `npm run verify`

**Comprehensive environment validation**

Validates that all prerequisites and configuration are correct before running the application.

**What it checks:**
- ✓ Node.js version (>= 18.0.0)
- ✓ npm installation
- ✓ Git installation and repository status
- ✓ Docker and Docker Compose availability
- ✓ Environment files existence
- ✓ JWT_SECRET configuration
- ✓ Dependencies installation
- ✓ Port availability (8088, 3000, 27017, 8081)
- ✓ MongoDB connection status

**Example:**
```bash
npm run verify
```

**Output:**
```
╔═══════════════════════════════════════════╗
║   Wizard Tracker Setup Verification      ║
╚═══════════════════════════════════════════╝

Checking Node.js Version
========================
✓ Node.js v18.19.0 (required: >= 18.0.0)

Checking npm
============
✓ npm 10.2.3 installed

...

Summary
=======
✓ All checks passed! ✨
```

**When to use:**
- Before starting development
- After environment changes
- Troubleshooting setup issues
- In CI/CD to validate environment

---

### `npm run install:all`

**Install all project dependencies**

Installs dependencies for root, backend, and frontend packages.

**Example:**
```bash
npm run install:all
```

**Equivalent to:**
```bash
npm ci
cd backend && npm ci
cd ../frontend && npm ci
```

**When to use:**
- After cloning the repository
- After pulling changes that update dependencies
- When node_modules folders are deleted

---

### `npm run setup-env`

**Generate secure JWT secrets**

Creates a cryptographically secure JWT secret and updates the `.env` file.

**Example:**
```bash
npm run setup-env
```

**Output:**
```
Wizard Tracker - Environment Setup

✓ New JWT secret generated and saved to .env
⚠ Keep this secret secure and never commit it to version control
ℹ Restart your application to use the new secret
```

**When to use:**
- First time setup
- Rotating security credentials
- After copying `.env.example` to `.env`
- When JWT_SECRET is compromised

**Also available as:**
```bash
npm run update-secrets  # Alias for setup-env
```

---

## Development

### `npm start`

**Start all services with Docker (recommended)**

Starts the entire application stack using Docker Compose.

**What it starts:**
- Frontend (http://localhost:8088)
- Backend API (http://localhost:3000)
- MongoDB (localhost:27017)
- Mongo Express (http://localhost:8081)

**Example:**
```bash
npm start
```

**When to use:**
- Daily development work
- Testing the full application
- When you want the complete environment

**See also:**
- `npm run start:verbose` - Shows real-time logs instead of detaching

---

### `npm run start:verbose`

**Start services with visible logs**

Same as `npm start` but shows logs in the current terminal (doesn't detach).

**Example:**
```bash
npm run start:verbose
```

**Output:**
```
frontend  | VITE v6.2.0  ready in 1234 ms
backend   | Server running on port 3000
mongodb   | [initandlisten] MongoDB starting
```

**When to use:**
- Debugging startup issues
- Monitoring service initialization
- When you want to see logs immediately

---

### `npm stop`

**Stop all Docker services**

Stops and removes all containers created by `npm start`.

**Example:**
```bash
npm stop
```

**When to use:**
- End of development session
- Before system restart
- Freeing up system resources

---

### `npm restart`

**Restart all services**

Stops and then starts all Docker containers.

**Example:**
```bash
npm restart
```

**Equivalent to:**
```bash
npm stop && npm start
```

**When to use:**
- After configuration changes
- When services become unresponsive
- After environment variable updates

---

### `npm run dev`

**Start development environment with Docker**

Generates secrets and starts all services in development mode.

**Example:**
```bash
npm run dev
```

**What it does:**
1. Runs `npm run setup-env` to ensure secrets are configured
2. Starts Docker containers with `docker compose up -d`

**When to use:**
- Starting a new development session
- When you want to ensure secrets are fresh

---

### `npm run dev:manual`

**Start development without Docker**

Runs backend and frontend in development mode manually (without containers).

**Prerequisites:**
- MongoDB installed and running locally
- All dependencies installed (`npm run install:all`)
- Environment configured

**Example:**
```bash
# Start MongoDB first (in separate terminal or as service)
mongod

# Then start dev
npm run dev:manual
```

**What it does:**
- Verifies setup with `npm run verify`
- Starts backend on port 3000
- Starts frontend dev server on port 5173 (Vite)

**When to use:**
- Development without Docker
- Faster hot-reload during development
- Debugging backend/frontend individually
- When Docker is not available

---

### `npm run logs`

**View logs from all services**

Shows live logs from all Docker containers.

**Example:**
```bash
npm run logs
```

**Output:**
```
frontend  | [vite] hmr update /src/App.jsx
backend   | GET /api/games 200 45ms
mongodb   | connection accepted from 172.18.0.3:54321
```

**When to use:**
- Debugging issues
- Monitoring application behavior
- Watching for errors

**Specific logs:**
```bash
npm run logs:backend   # Backend API logs only
npm run logs:frontend  # Frontend logs only
```

---

## Testing

### `npm test`

**Run all tests**

Executes test suites for both backend and frontend.

**Example:**
```bash
npm test
```

**Output:**
```
> test:backend
✓ API health check
✓ User authentication
...

> test:frontend
✓ Component renders
✓ User interactions
...

Tests: 45 passed, 45 total
```

**When to use:**
- Before committing code
- In CI/CD pipelines
- Before creating pull requests

---

### `npm run test:backend`

**Run backend tests only**

**Example:**
```bash
npm run test:backend
```

**When to use:**
- Testing API changes
- Backend-specific development

---

### `npm run test:frontend`

**Run frontend tests only**

**Example:**
```bash
npm run test:frontend
```

**When to use:**
- Testing UI components
- Frontend-specific development

---

### `npm run test:watch`

**Run tests in watch mode**

Automatically re-runs tests when files change.

**Example:**
```bash
npm run test:watch
```

**When to use:**
- During active test-driven development
- When writing new tests
- Continuous feedback while coding

---

## Code Quality

### `npm run lint`

**Lint all code**

Checks code for style issues and potential errors in both backend and frontend.

**Example:**
```bash
npm run lint
```

**Output:**
```
✓ backend/server.js
✓ frontend/src/App.jsx
...
✔ No linting errors found
```

**When to use:**
- Before committing
- In pre-commit hooks
- In CI/CD pipelines

---

### `npm run lint:fix`

**Auto-fix linting issues**

Automatically fixes linting problems where possible.

**Example:**
```bash
npm run lint:fix
```

**What it fixes:**
- Semicolon placement
- Indentation
- Spacing
- Import order
- Other auto-fixable rules

**When to use:**
- Before committing
- Cleaning up code style
- After refactoring

---

### `npm run format`

**Format all code with Prettier**

Formats JavaScript, JSX, JSON, Markdown, and CSS files.

**Example:**
```bash
npm run format
```

**Output:**
```
Checking formatting...
All matched files use Prettier code style!
```

**When to use:**
- Before committing
- Ensuring consistent code style
- After major refactoring

---

### `npm run format:check`

**Check code formatting without making changes**

Validates that all files are properly formatted.

**Example:**
```bash
npm run format:check
```

**When to use:**
- In CI/CD pipelines
- Pre-commit verification
- Code review preparation

---

### `npm run precommit`

**Pre-commit validation**

Runs linting, formatting checks, and tests before committing.

**Example:**
```bash
npm run precommit
```

**What it runs:**
1. `npm run lint` - Check code quality
2. `npm run format:check` - Verify formatting
3. `npm test` - Run all tests

**When to use:**
- Manually before commits
- In Git hooks (husky)
- Before creating pull requests

---

## Build & Deploy

### `npm run build`

**Build Docker images**

Builds production Docker images for all services.

**Example:**
```bash
npm run build
```

**When to use:**
- Preparing for deployment
- Testing production builds
- Creating release images

---

### `npm run build:frontend`

**Build frontend for production**

Creates optimized production build of the frontend.

**Example:**
```bash
npm run build:frontend
```

**Output location:** `frontend/dist/`

**When to use:**
- Deploying frontend separately
- Testing production frontend build
- Static hosting deployment

---

### `npm run build:backend`

**Build backend**

Prepares backend for production deployment.

**Example:**
```bash
npm run build:backend
```

**When to use:**
- Deploying backend separately
- Creating production backend package

---

## Docker Management

### `npm run clean`

**Clean Docker resources**

Removes containers and volumes, then prunes unused Docker resources.

**Example:**
```bash
npm run clean
```

**⚠️ Warning:** This removes all data in volumes (including database data).

**When to use:**
- Starting fresh
- Clearing disk space
- After major changes

---

### `npm run clean:all`

**Complete cleanup**

Removes all Docker resources AND node_modules folders.

**Example:**
```bash
npm run clean:all
```

**⚠️ Warning:** Requires running `npm run install:all` afterwards.

**When to use:**
- Complete fresh start
- Resolving dependency conflicts
- Maximum cleanup

---

### `npm run clean:deps`

**Remove all node_modules**

Deletes node_modules from root, backend, and frontend.

**Example:**
```bash
npm run clean:deps
```

**When to use:**
- Resolving dependency issues
- Before reinstalling dependencies
- Freeing up disk space

---

### `npm run docker:prune`

**Aggressive Docker cleanup**

Removes all unused Docker resources (images, containers, volumes, networks).

**Example:**
```bash
npm run docker:prune
```

**⚠️ Warning:** This affects ALL Docker resources, not just this project.

**When to use:**
- Reclaiming significant disk space
- Cleaning up after many builds
- System maintenance

---

### `npm run docker:rebuild`

**Complete Docker rebuild**

Stops containers, rebuilds images from scratch (no cache), and restarts.

**Example:**
```bash
npm run docker:rebuild
```

**When to use:**
- After Dockerfile changes
- Clearing cached layers
- Troubleshooting build issues

---

## Health & Utilities

### `npm run health`

**Check service health**

Verifies that all services are running and responding correctly.

**Example:**
```bash
npm run health
```

**Output:**
```
Wizard Tracker Health Check

Checking Services
=================
✓ Frontend is healthy (45ms)
✓ Backend API is healthy (23ms)
✓ Mongo Express is healthy (67ms)

Summary
=======
✓ All services are healthy! ✨

Access URLs:
  • Frontend:      http://localhost:8088
  • Backend API:   http://localhost:3000
  • Mongo Express: http://localhost:8081
```

**Exit codes:**
- `0` - All services healthy
- `1` - One or more services unhealthy

**When to use:**
- After starting services
- Troubleshooting connectivity
- In CI/CD health checks
- Monitoring deployments

---

## Troubleshooting

### Common Issues and Solutions

#### Port Already in Use

**Problem:** Services fail to start because ports are in use.

**Solution:**
```bash
# Check what's using the ports
netstat -ano | findstr :8088
netstat -ano | findstr :3000
netstat -ano | findstr :27017

# Stop existing containers
npm stop

# Or use different ports in .env file
```

---

#### Docker Not Running

**Problem:** `npm start` fails with "Cannot connect to Docker daemon"

**Solution:**
```bash
# Check Docker status
docker ps

# Start Docker Desktop (Windows/Mac)
# Or start Docker service (Linux)
sudo systemctl start docker

# Verify Docker is running
npm run verify
```

---

#### Missing Dependencies

**Problem:** Application fails with "Cannot find module"

**Solution:**
```bash
# Reinstall all dependencies
npm run clean:deps
npm run install:all

# Verify setup
npm run verify
```

---

#### Environment Configuration Issues

**Problem:** "JWT_SECRET not configured" or similar errors

**Solution:**
```bash
# Check environment files exist
npm run verify

# Regenerate secrets
npm run setup-env

# Restart services
npm restart
```

---

#### Database Connection Errors

**Problem:** Backend can't connect to MongoDB

**Solution:**
```bash
# Check if MongoDB container is running
docker ps | grep mongo

# View MongoDB logs
docker compose logs mongodb

# Restart services
npm restart

# Check MongoDB is healthy
npm run health
```

---

#### Tests Failing

**Problem:** Tests fail unexpectedly

**Solution:**
```bash
# Run specific test suite
npm run test:backend
npm run test:frontend

# Run tests in watch mode for debugging
npm run test:watch

# Check for linting issues
npm run lint
```

---

## Workflow Examples

### Daily Development Workflow

```bash
# Morning: Start work
git pull origin main
npm run verify
npm start
npm run logs

# During development
npm run test:watch        # In one terminal
npm run dev:manual        # For hot-reload

# Before committing
npm run precommit
git add .
git commit -m "feat: add new feature"
git push

# End of day
npm stop
```

---

### First-Time Contributor Workflow

```bash
# 1. Clone repository
git clone https://github.com/jkrumboe/wizard-tracker.git
cd wizard-tracker

# 2. Setup
npm run init

# 3. Start application
npm start

# 4. Verify it's working
npm run health

# 5. Open in browser
# http://localhost:8088
```

---

### CI/CD Pipeline Example

```bash
# 1. Verify environment
npm run verify || exit 1

# 2. Install dependencies
npm run install:all

# 3. Lint and format check
npm run lint
npm run format:check

# 4. Run tests
npm test

# 5. Build for production
npm run build

# 6. Health check
npm start
npm run health || exit 1
```

---

### Debugging Workflow

```bash
# 1. Check setup
npm run verify

# 2. Start with verbose logging
npm run start:verbose

# 3. In another terminal, watch logs
npm run logs:backend    # or logs:frontend

# 4. Check service health
npm run health

# 5. Clean restart if needed
npm run clean
npm start
```

---

## Tips and Best Practices

### Performance Tips

- Use `npm ci` in CI/CD (faster, more reliable than `npm install`)
- Use `npm run dev:manual` for faster hot-reload during frontend development
- Run `npm run docker:prune` periodically to free disk space
- Use `npm run test:watch` during test-driven development

### Security Best Practices

- Run `npm run setup-env` on first deployment and when rotating secrets
- Never commit `.env` files to version control
- Use strong passwords for MongoDB in production
- Regularly update dependencies with `npm audit fix`

### Development Best Practices

- Run `npm run verify` before starting work
- Use `npm run precommit` before creating pull requests
- Keep Docker Desktop running during development
- Use `npm run logs` to debug issues before asking for help

---

## Additional Resources

- [README.md](../README.md) - Project overview
- [SETUP.md](SETUP.md) - Detailed setup instructions
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development guidelines
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

> Note: All docs are in the `docs/` folder. Links above are relative within that folder.

---

## Getting Help

If you encounter issues:

1. Run `npm run verify` to check your setup
2. Check the [Troubleshooting](#troubleshooting) section
3. View logs with `npm run logs`
4. Search existing [GitHub issues](https://github.com/jkrumboe/wizard-tracker/issues)
5. Create a new issue with details from `npm run verify` output

**Need immediate help?**
- 📖 Check [SETUP.md](SETUP.md) for detailed instructions

- 💬 Open a [GitHub Discussion](https://github.com/jkrumboe/wizard-tracker/discussions)
- 🐛 Report bugs via [GitHub Issues](https://github.com/jkrumboe/wizard-tracker/issues/new?template=bug_report.md)
