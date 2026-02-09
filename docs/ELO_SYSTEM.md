# ELO Rating System

This document describes how to set up and use the ELO rating system for Wizard Tracker.

## Overview

The ELO system provides competitive rankings for players based on their game performance. Key features:

- **Multi-player support**: Handles 3-6 player games using pairwise comparisons
- **Dynamic K-factor**: Rating volatility decreases as players complete more games
- **Placement-based scoring**: Fractional scores based on placement gap, not binary win/loss
- **Score margin bonuses**: Decisive wins earn extra rating points (capped penalty for losers)
- **Player count scaling**: Normalized to 4-player baseline (6 players = 1.5x, 3 players = 0.75x)
- **Provisional dampening**: Reduced impact when established players face new players

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
| Loss Margin Cap | 10% | Max loss penalty regardless of score margin |
| Player Count Baseline | 4 | Rating changes scale by √(numPlayers/4) |
| Provisional Dampening | 50% | Reduced impact vs players with < 10 games |

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
2. **Actual Score**: Placement-based (fractional, not binary) — e.g. 2nd vs 1st in a 6-player game = 0.4 instead of 0
3. **Rating Change**: `ΔR = K × (Actual - Expected) × MarginMultiplier × PlayerCountFactor`

### Placement-Based Scoring

Instead of binary win/loss (1 or 0) per opponent, scores are calculated from placement gap:

- **Player ranked higher** than opponent: `0.5 + (gap / maxGap) × 0.5` (range 0.5 to 1.0)
- **Player ranked lower** than opponent: `0.5 - (gap / maxGap) × 0.5` (range 0.0 to 0.5)
- **Tied placement**: 0.5

Examples in a 6-player game:
| Matchup | Old (Binary) | New (Placement) |
|---------|-------------|------------------|
| 2nd vs 1st | 0.0 | 0.4 |
| 6th vs 1st | 0.0 | 0.0 |
| 1st vs 6th | 1.0 | 1.0 |
| 3rd vs 5th | 1.0 | 0.7 |

### Multipliers

- **Score Margin (winners)**: +25% for 50+ point wins, +15% for 30-49, +5% for 10-29
- **Score Margin (losers)**: Capped at -10% maximum, regardless of margin
- **Player Count**: Rating change × √(numPlayers / 4). Diminishing returns for larger games:
  - 3 players = 0.87x, 4 players = 1.0x, 5 players = 1.12x, 6 players = 1.22x, 8 players = 1.41x

### Provisional Dampening

When an established player (10+ games) faces a provisional player (< 10 games), the impact on the established player's rating is reduced by 50%. This prevents new players with volatile K-factors from disrupting established ratings.

### Example

A 1200-rated established player beats a 1000-rated player by 40 points in a 5-player game:
- Expected: 0.76 (76% chance to win)
- Actual: ~0.88 (placement-based, 1st vs 3rd in 5 players)
- Margin bonus: 1.15 (decisive win)
- Player count factor: √(5/4) ≈ 1.12
- K-factor: 24 (established player)
- Change: `24 × (0.88 - 0.76) × 1.15 × 1.12 ≈ +4 rating`

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
