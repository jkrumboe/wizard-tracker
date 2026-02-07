# ELO Rating System

This document describes how to set up and use the ELO rating system for Wizard Tracker.

## Overview

The ELO system provides competitive rankings for players based on their game performance. Key features:

- **Multi-player support**: Handles 3-6 player games using pairwise comparisons
- **Dynamic K-factor**: Rating volatility decreases as players complete more games
- **Score margin bonuses**: Decisive wins earn extra rating points
- **Win streak bonuses**: Consecutive wins provide small additional gains

## Configuration

Default ELO parameters (configurable in `backend/utils/eloService.js`):

| Parameter | Value | Description |
|-----------|-------|-------------|
| Default Rating | 1000 | Starting ELO for new players |
| Minimum Rating | 100 | Floor to prevent negative ratings |
| Min Games for Ranking | 5 | Games required to appear on leaderboard |
| K-factor (new) | 40 | < 10 games |
| K-factor (developing) | 32 | 10-30 games |
| K-factor (established) | 24 | 30-100 games |
| K-factor (veteran) | 16 | 100+ games |

## Development Setup with Production Data

Three databases in the same MongoDB instance:

| Database | Purpose |
|----------|---------|
| `wizard-tracker` | Production (live data) |
| `wizard-tracker-dev` | Development (copy of prod for testing) |
| `wizard-tracker-backup` | Backup storage |

### Step 1: Configure Environment

Add to `backend/.env`:

```env
# Production (or remote prod)
MONGO_URI_PROD=mongodb://100.95.118.43:27017/wizard-tracker

# Development database (same MongoDB, different db name)
MONGO_URI_DEV=mongodb://localhost:27017/wizard-tracker-dev
```

### Step 2: Copy Production Data to Dev

```bash
cd backend

# Copy essential collections (wizard, users, playeridentities)
npm run db:copy-prod

# Or copy all collections
node scripts/copy-prod-to-dev.js --all

# Also create a backup
node scripts/copy-prod-to-dev.js --backup
```

### Step 3: Calculate ELO Ratings

```bash
cd backend

# Dry run first (no changes)
npm run elo:calculate:dry

# Calculate ELO on dev database
npm run elo:dev
```

### Step 4: Test the Backend Against Dev DB

```bash
# Start backend pointing to dev database
npm run dev:local

# Or manually:
# PowerShell
$env:MONGO_URI = "mongodb://localhost:27017/wizard-tracker-dev"
npm run dev
```

### Step 5: View Data

Open Mongo Express at http://localhost:18081 and select `wizard-tracker-dev` database.

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/identities/elo/rankings` | GET | No | Get ELO leaderboard |
| `/api/identities/elo/history/:id` | GET | No | Get rating history for identity |
| `/api/identities/elo/me` | GET | Yes | Get current user's ELO |
| `/api/identities/elo/config` | GET | No | Get ELO configuration |
| `/api/identities/elo/recalculate` | POST | Admin | Recalculate all ratings |

### Example: Get Rankings

```bash
curl http://localhost:5000/api/identities/elo/rankings?page=1&limit=10
```

Response:
```json
{
  "rankings": [
    {
      "rank": 1,
      "identityId": "...",
      "displayName": "PlayerOne",
      "rating": 1245,
      "peak": 1250,
      "gamesPlayed": 42,
      "streak": 3,
      "winRate": "45.2"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15
  }
}
```

## How ELO is Calculated

### Pairwise Comparison

Each player's rating is compared against every other player in the game:

1. **Expected Score** vs opponent: `E = 1 / (1 + 10^((Rb - Ra) / 400))`
2. **Actual Score**: 1 for win, 0.5 for tie, 0 for loss
3. **Rating Change**: `ΔR = K × (Actual - Expected) × Multipliers`

### Multipliers

- **Score Margin**: +25% for 50+ point wins, +15% for 30-49, +5% for 10-29
- **Win Streak**: +2 rating per consecutive win (max +10)

### Example

A 1200-rated player beats a 1000-rated player by 40 points:
- Expected: 0.76 (76% chance to win)
- Actual: 1.0 (won)
- Margin bonus: 1.15 (decisive win)
- K-factor: 24 (established player)
- Change: `24 × (1.0 - 0.76) × 1.15 ≈ +7 rating`

## Production Deployment

Once ELO is tested and working:

1. **Disable auto-updates during migration**:
   ```bash
   SKIP_ELO_UPDATES=true node scripts/calculate-initial-elo.js
   ```

2. **Run migration on production**:
   ```bash
   MONGO_URI=$PROD_MONGO_URI node scripts/calculate-initial-elo.js
   ```

3. **Remove SKIP_ELO_UPDATES** and restart backend

4. **ELO will update automatically** when games finish

## Database Schema Changes

The `PlayerIdentity` model now includes:

```javascript
elo: {
  rating: Number,        // Current ELO (default: 1000)
  peak: Number,          // Highest achieved
  floor: Number,         // Lowest achieved
  gamesPlayed: Number,   // Games counted for ELO
  lastUpdated: Date,     // Last rating update
  streak: Number,        // Win/loss streak (positive = wins)
  history: [{            // Last 50 rating changes
    rating: Number,
    change: Number,
    gameId: ObjectId,
    opponents: [String],
    placement: Number,
    date: Date
  }]
}
```

## Troubleshooting

### ELO not updating after games
- Check that `gameData.gameFinished` is `true`
- Ensure players have `identityId` linked
- Check `SKIP_ELO_UPDATES` is not set

### Rankings showing no players
- Ensure `minGames` threshold is met (default: 5)
- Use `?minGames=1` for testing

### Recalculation seems wrong
- Games are processed chronologically by `gameData.created_at`
- Check for games with missing `final_scores` or `winner_id`
