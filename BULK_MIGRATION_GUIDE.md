# Bulk Migration Guide

This guide explains how to migrate all games from the legacy `games` collection to the new `wizard` collection with v3.0 format.

## 🎯 Migration Options

### Option 1: Standalone Script (Recommended for Admin)

**Migrate ALL games:**
```bash
cd backend
node scripts/migrate-all-games.js
```

**Dry run first (test without saving):**
```bash
cd backend
DRY_RUN=true node scripts/migrate-all-games.js
```

**Features:**
- ✅ Processes all games in batches (100 at a time)
- ✅ Shows progress and detailed statistics
- ✅ Validates all migrated games
- ✅ Skips already migrated games
- ✅ Preserves originals in `games` collection
- ✅ Safe: Dry run mode available

---

### Option 2: Migrate Specific User's Games

**Migrate one user's games:**
```bash
cd backend
node scripts/migrate-user-games.js <userId>
```

**Example:**
```bash
node scripts/migrate-user-games.js 68b6434852044fa6096ee4cf
```

**Dry run:**
```bash
DRY_RUN=true node scripts/migrate-user-games.js 68b6434852044fa6096ee4cf
```

---

### Option 3: API Endpoint (For Authenticated Users)

**Migrate all games for current user:**
```bash
curl -X POST http://localhost:5000/api/wizard-games/migrate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"migrateAll": true}'
```

**Migrate specific games:**
```bash
curl -X POST http://localhost:5000/api/wizard-games/migrate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"gameIds": ["gameId1", "gameId2", "gameId3"]}'
```

**Response:**
```json
{
  "message": "Migration completed",
  "results": {
    "total": 150,
    "successful": 145,
    "failed": 2,
    "skipped": 3,
    "details": [...]
  }
}
```

---

### Option 4: MongoDB Shell Script

For direct database manipulation:

```javascript
// Connect to MongoDB
use wizard_tracker

// Count games to migrate
db.games.countDocuments()

// Preview first game structure
db.games.findOne()

// Export games for backup (recommended before bulk operations)
mongoexport --db=wizard_tracker --collection=games --out=games_backup.json
```

---

## 📋 Step-by-Step Migration Process

### 1. Pre-Migration Checklist

- [ ] **Backup Database**
  ```bash
  mongodump --db=wizard_tracker --out=backup_$(date +%Y%m%d)
  ```

- [ ] **Test with Dry Run**
  ```bash
  cd backend
  DRY_RUN=true node scripts/migrate-all-games.js
  ```

- [ ] **Check Current Stats**
  ```bash
  # In MongoDB shell
  db.games.countDocuments()        # Legacy games
  db.wizard.countDocuments()       # Already migrated
  ```

### 2. Run Migration

**For Production:**
```bash
cd backend
node scripts/migrate-all-games.js > migration_log_$(date +%Y%m%d_%H%M%S).txt 2>&1
```

**Watch Progress:**
The script will show:
- Current batch being processed
- Success/failure per game
- Overall progress percentage
- Final statistics

### 3. Verify Results

**Check migration statistics:**
```javascript
// MongoDB shell
use wizard_tracker

// Count migrated games
db.wizard.countDocuments()

// Check migration metadata
db.wizard.aggregate([
  {
    $group: {
      _id: "$migratedFrom",
      count: { $sum: 1 }
    }
  }
])

// Sample migrated game
db.wizard.findOne()
```

**API Stats Endpoint:**
```bash
curl http://localhost:5000/api/wizard-games/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Understanding Migration Output

### Console Output

```
🚀 Starting bulk migration of wizard games...
   Mode: LIVE MIGRATION
   Batch size: 100

✅ Connected to MongoDB

📊 Found 1500 total games in 'games' collection
📊 Currently 0 games in 'wizard' collection

📦 Processing batch 1 (games 1-100)...
  ✅ Migrated: game_123_abc (v1.0 → v3.0)
  ✅ Migrated: game_456_def (v2.0 → v3.0)
  ⏭️  Skipped: game_789_ghi (already migrated)
  ❌ Failed: game_012_jkl - Unknown format

📈 Progress: 6.7% (100/1500 games processed)

...

═══════════════════════════════════════════════════════════
📊 MIGRATION COMPLETE
═══════════════════════════════════════════════════════════
Total games processed:    1500
✅ Successfully migrated: 1450
⏭️  Skipped (existing):    45
❌ Failed:                5

By version:
  v1.0 (nested gameState):  580
  v2.0 (flat player_ids):   820
  v3.0 (already clean):     50
  Unknown format:           5

✅ Games have been migrated to wizard collection
⚠️  Original games remain in games collection for safety
═══════════════════════════════════════════════════════════
```

---

## ⚠️ Important Notes

### Safety Features

1. **Original Preservation**: Legacy games remain in `games` collection
2. **Duplicate Detection**: Already migrated games are skipped automatically
3. **Validation**: Triple-layer validation (migration, schema, model)
4. **Dry Run**: Test migrations without saving changes
5. **Batch Processing**: Memory-efficient processing of large datasets

### What Gets Migrated

**Copied Fields:**
- `userId` - User who owns the game
- `localId` - Unique game identifier
- `gameData` - Game data (migrated to v3.0 format)
- `isShared` - Sharing status
- `shareId` - Share identifier (if shared)
- `sharedAt` - Share timestamp (if shared)

**Added Fields:**
- `migratedFrom` - Original version (1.0, 2.0, 3.0)
- `migratedAt` - Migration timestamp
- `originalGameId` - Reference to original game in legacy collection
- `version` - In gameData (set to "3.0")

**Removed Fields (from gameData):**
- `isVerified` (players) - No longer needed
- `round`, `cards` (round_data) - Redundant metadata
- `totalScore`, `name` (player round data) - Redundant

**Normalized:**
- `winner_id` - Always stored as array (supports ties)
- `isDealer`, `isCaller` - Added to players (replaces isVerified)

---

## 🔧 Troubleshooting

### Migration Fails for Some Games

**Check error details:**
```javascript
// Find failed games
db.games.find({
  localId: { $nin: db.wizard.distinct("localId") }
})
```

**Common issues:**
- Missing required fields (created_at, players, round_data)
- Invalid player counts (< 2 or > 6)
- Corrupted game data
- Unknown format

**Solution:** Review failed game data, fix manually if needed, or exclude

### Memory Issues with Large Datasets

**Reduce batch size:**
```bash
# Edit backend/scripts/migrate-all-games.js
# Change: const BATCH_SIZE = 100;
# To: const BATCH_SIZE = 50;
```

### Connection Timeouts

**Increase timeout in script:**
```javascript
await mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000
});
```

### Need to Re-run Migration

**Clear wizard collection and start over:**
```javascript
// MongoDB shell - CAUTION: This deletes all migrated games!
db.wizard.deleteMany({})

// Or delete just failed migrations
db.wizard.deleteMany({ migratedFrom: { $exists: false } })
```

---

## 📈 Post-Migration Tasks

### 1. Verify Data Integrity

**Sample check:**
```javascript
// Count comparison
const legacyCount = db.games.countDocuments();
const migratedCount = db.wizard.countDocuments();
const skippedCount = db.wizard.countDocuments({ migratedFrom: null });

print(`Legacy games: ${legacyCount}`);
print(`Migrated games: ${migratedCount}`);
print(`Created as v3.0: ${skippedCount}`);
```

**Validate sample games:**
```bash
curl http://localhost:5000/api/wizard-games?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### 2. Update Application

**Switch to new endpoint:**
- Frontend should use `/api/wizard-games` instead of `/api/games`
- Update game fetch/create calls
- Test thoroughly

### 3. Monitor Performance

**Check query performance:**
```javascript
// Explain query on wizard collection
db.wizard.find({ userId: ObjectId("...") })
  .sort({ createdAt: -1 })
  .explain("executionStats")

// Ensure indexes are used
db.wizard.getIndexes()
```

### 4. Optional: Archive Legacy Games

**After successful migration and verification:**

```javascript
// Option A: Archive to separate collection
db.games.aggregate([
  { $out: "games_archive_20251212" }
])

// Option B: Export and remove
mongoexport --db=wizard_tracker --collection=games --out=games_legacy.json
// Then optionally: db.games.deleteMany({})
```

⚠️ **WARNING**: Only archive/delete after thorough verification!

---

## 🎉 Success Criteria

Migration is successful when:

- ✅ All games (or acceptable percentage) migrated
- ✅ Failed games documented and reviewed
- ✅ API stats show correct counts
- ✅ Sample games validate correctly
- ✅ Application works with new collection
- ✅ Performance is acceptable
- ✅ Backup created and verified

---

## 📞 Need Help?

If migration fails or you encounter issues:

1. Check `migration_log_*.txt` for detailed errors
2. Review failed games in output
3. Test with single game first: `migrate-user-games.js`
4. Use DRY_RUN mode to diagnose
5. Check database connectivity and permissions

For specific game format issues, see [WIZARD_GAME_MIGRATION.md](WIZARD_GAME_MIGRATION.md)
