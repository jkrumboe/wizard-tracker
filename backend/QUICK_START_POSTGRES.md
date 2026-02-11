# Quick Start: PostgreSQL Migration

## Prerequisites Check

Before running setup, verify:

```powershell
# 1. PostgreSQL container is running
docker ps | findstr postgres

# 2. Dependencies are installed  
cd backend
npm install

# 3. DATABASE_URL is set in .env
cat .env | findstr DATABASE_URL
```

## Setup Steps

### 1. Install Dependencies (if not already done)
```powershell
cd backend
npm install
```

### 2. Start PostgreSQL
```powershell
cd ..
docker compose up -d postgres

# Wait a few seconds for container to be healthy
Start-Sleep -Seconds 5

# Verify it's running
docker ps | findstr postgres
docker logs wizard-postgres
```

### 3. Run Setup Script
```powershell
cd backend
npm run prisma:setup
```

This will:
- ✅ Check environment variables
- ✅ Verify PostgreSQL container is running
- ✅ Generate Prisma Client
- ✅ Run initial migration (create tables)
- ✅ Test the connection

### 4. Test Connection (optional)
```powershell
npm run postgres:test
```

### 5. View Database
```powershell
npm run prisma:studio
```
Opens GUI at http://localhost:5555

## Troubleshooting

### "Cannot connect to PostgreSQL"

Check if container is actually running:
```powershell
docker ps
```

Check container logs:
```powershell
docker logs wizard-postgres
```

Manually test connection:
```powershell
docker exec -it wizard-postgres psql -U wizard -d wizard_tracker
# Should open psql prompt. Type \q to exit.
```

### "Prisma not found"

Install dependencies:
```powershell
npm install
```

### "Port 5432 already in use"

Check what's using the port:
```powershell
netstat -ano | findstr :5432
```

Either:
- Stop the other PostgreSQL instance
- Or change the port in docker-compose.yml (e.g., "5433:5432")

### Reset Everything

If you want to start fresh:
```powershell
# Stop and remove container and volume
docker compose down postgres
docker volume rm wizard-tracker_postgres_data

# Start again
docker compose up -d postgres

# Wait and setup
Start-Sleep -Seconds 5
npm run prisma:setup
```

## Verify Setup

After successful setup, verify both databases are connected:

```powershell
# Start the backend server
npm run dev

# In another terminal/PowerShell, check health
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "OK",
  "database": {
    "active": "mongodb",
    "mongodb": { "healthy": true, "latency": 5 },
    "postgres": { "healthy": true, "latency": 3 }
  }
}
```

## What Was Created

After successful setup:

**Database:**
- Tables: User, PlayerIdentity, FriendRequest, Game, WizardGame, TableGame, etc.
- Indexes: All optimized for common queries
- Foreign keys: Automatic referential integrity

**Files:**
- `prisma/migrations/` - Migration history (committed to git)
- `node_modules/.prisma/` - Generated Prisma Client (not in git)

## Next Steps

1. Read the full migration guide: [POSTGRES_MIGRATION.md](./POSTGRES_MIGRATION.md)
2. Explore the database: `npm run prisma:studio`
3. Start Phase 2: Dual-write implementation
