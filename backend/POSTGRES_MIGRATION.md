# PostgreSQL Migration Guide

This guide covers the migration from MongoDB to PostgreSQL for the KeepWiz backend.

## Overview

The migration uses a **dual-database approach** where both MongoDB and PostgreSQL run simultaneously, allowing for gradual migration and safe rollback.

## Current Status

**Phase 1 Complete**: Foundation setup includes:
- ✅ Prisma ORM installed and configured
- ✅ PostgreSQL service added to Docker Compose
- ✅ Prisma schema defined for all models
- ✅ Repository layer created (UserRepository, PlayerIdentityRepository, FriendRequestRepository)
- ✅ Dual-database connection manager
- ✅ Updated server.js for dual connections

## Architecture

### Database Selection

The `USE_POSTGRES` environment variable controls which database is used:
- `USE_POSTGRES=false` (default): Uses MongoDB
- `USE_POSTGRES=true`: Uses PostgreSQL

### Data Model

**Relational Tables** (structured data):
- User, PlayerIdentity, FriendRequest, PlayerAlias
- GameTemplate models (System, User, Suggestion)

**JSONB Columns** (flexible data):
- `Game.gameData`, `WizardGame.gameData`, `TableGame.gameData`
- `GameEvent.payload`, `GameSnapshot.gameState`
- `PlayerIdentity.eloData`, `PlayerIdentity.nameHistory`, `PlayerIdentity.aliases`

## Quick Start

### 1. Install Dependencies

From the backend directory:
```bash
npm install
```

This installs:
- `@prisma/client` - Query builder for PostgreSQL
- `prisma` (dev) - CLI tools for migrations

### 2. Start PostgreSQL

Start all services including the new PostgreSQL container:
```bash
# From project root
docker compose up -d
```

Services started:
- MongoDB (port 27017)
- PostgreSQL (port 5432)
- Redis (port 6379)
- Backend (port 5000)
- Frontend (port 8088)
- mongo-express (port 18081)
- pgadmin (port 15432)

### 3. Run Initial Migration

Create the PostgreSQL schema:
```bash
cd backend
npx prisma migrate dev --name init
```

This creates all tables defined in `prisma/schema.prisma`.

### 4. Generate Prisma Client

Generate the TypeScript-friendly Prisma client:
```bash
npx prisma generate
```

### 5. Verify Connections

Check that both databases are connected:
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Server is running",
  "database": {
    "active": "mongodb",
    "mongodb": { "healthy": true, "latency": 5 },
    "postgres": { "healthy": true, "latency": 3 }
  }
}
```

## Development Workflow

### Working with Prisma

**View database in Prisma Studio:**
```bash
npx prisma studio
```
Opens GUI at http://localhost:5555

**Reset database (dev only):**
```bash
npx prisma migrate reset
```

**Create new migration:**
```bash
npx prisma migrate dev --name your_migration_name
```

**Apply migrations (production):**
```bash
npx prisma migrate deploy
```

**Format schema:**
```bash
npx prisma format
```

### Accessing Databases

**MongoDB:**
- mongo-express UI: http://localhost:18081
- Credentials: admin / admin123

**PostgreSQL:**
- pgAdmin UI: http://localhost:15432
- Login: admin@wizard.local / admin123
- Server connection:
  - Host: postgres (within Docker network) or localhost
  - Port: 5432
  - Database: wizard_tracker
  - User: wizard
  - Password: wizard123

## Repository Pattern

Instead of using Mongoose models directly, use repositories for PostgreSQL operations:

### Old Pattern (Mongoose):
```javascript
const User = require('../models/User');
const user = await User.findOne({ username: 'john' });
```

### New Pattern (Prisma Repository):
```javascript
const { getPrisma } = require('../database');
const UserRepository = require('../repositories/UserRepository');

const prisma = getPrisma();
const user = await UserRepository.findByUsername(prisma, 'john');
```

### Using Transactions:
```javascript
const { getPrisma } = require('../database');

const prisma = getPrisma();

await prisma.$transaction(async (tx) => {
  // All operations use 'tx' instead of 'prisma'
  await UserRepository.create(tx, userData);
  await PlayerIdentityRepository.create(tx, identityData);
});
```

## Environment Variables

Add to your `.env` file:

```bash
# PostgreSQL Connection
DATABASE_URL=postgresql://wizard:wizard123@localhost:5432/wizard_tracker?schema=public

# PostgreSQL Credentials (for docker-compose)
POSTGRES_USER=wizard
POSTGRES_PASSWORD=wizard123
POSTGRES_DB=wizard_tracker

# Database Selection (false = MongoDB, true = PostgreSQL)
USE_POSTGRES=false
```

## Next Steps (Phase 2)

The next phase involves migrating core entities:

1. **Migrate Users** - Dual-write user operations to both databases
2. **Migrate PlayerIdentities** - Convert identity system to PostgreSQL
3. **Migrate FriendRequests** - Use transactions for atomic updates
4. **Update Routes** - Replace Mongoose populate() with Prisma includes
5. **Sync Data** - Backfill PostgreSQL with existing MongoDB data

See the main migration plan document for detailed steps.

## Troubleshooting

### PostgreSQL Connection Fails

Check if PostgreSQL is running:
```bash
docker ps | grep postgres
```

Check logs:
```bash
docker logs wizard-postgres
```

### Prisma Migration Fails

Reset database and try again:
```bash
npx prisma migrate reset
npx prisma migrate dev
```

### Port Conflicts

If PostgreSQL port 5432 is busy, modify `docker-compose.yml`:
```yaml
postgres:
  ports:
    - "5433:5432"  # Use different external port
```

Update DATABASE_URL accordingly.

## Database Comparison

| Feature | MongoDB | PostgreSQL |
|---------|---------|------------|
| **Joins** | Manual populate() | Native JOINs |
| **Transactions** | Requires replica set | Built-in ACID |
| **Schema** | Flexible (no schema) | Strict schema with migrations |
| **Relationships** | ObjectId references | Foreign keys with constraints |
| **Queries** | Aggregate pipelines | SQL / Prisma Query Builder |
| **Indexing** | Document indexes | B-tree indexes, partial indexes |
| **Performance** | Good for documents | Excellent for relational data |

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Migration Plan](../../docs/POSTGRES_MIGRATION.md) - Detailed week-by-week plan

## Support

For issues or questions during migration:
1. Check this guide first
2. Review Prisma documentation
3. Check GitHub Issues
4. Contact the development team
