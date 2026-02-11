/**
 * Game Dual-Write Service
 * 
 * Mirrors game write operations to PostgreSQL during the migration period.
 * Used by all game routes (Game, WizardGame, TableGame, GameSync).
 * All mirroring is non-blocking — PostgreSQL failures are logged but don't throw.
 */

const { getPrisma, usePostgres } = require('../database');
const GameRepo = require('../repositories/GameRepository');
const WizardGameRepo = require('../repositories/WizardGameRepository');
const TableGameRepo = require('../repositories/TableGameRepository');
const GameEventRepo = require('../repositories/GameEventRepository');
const GameSnapshotRepo = require('../repositories/GameSnapshotRepository');

// ========================================
// Legacy Game mirroring
// ========================================

/**
 * Mirror a legacy Game creation to PostgreSQL
 */
async function mirrorGameCreate(mongoGame) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgGame = await GameRepo.create(prisma, {
      userId: mongoGame.userId?.toString() || mongoGame.userId,
      localId: mongoGame.localId,
      gameData: mongoGame.gameData || {},
      shareId: mongoGame.shareId || null,
      isShared: mongoGame.isShared || false,
      sharedAt: mongoGame.sharedAt || null
    });
    console.log(`[GameDualWrite] ✅ Mirrored game create: ${mongoGame.localId} → PG:${pgGame.id}`);
    return pgGame;
  } catch (error) {
    console.warn(`[GameDualWrite] ⚠️  Failed to mirror game create (${mongoGame.localId}):`, error.message);
    return null;
  }
}

/**
 * Mirror a legacy Game update to PostgreSQL
 */
async function mirrorGameUpdate(mongoGame, updates) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgGame = await GameRepo.findByLocalId(prisma, mongoGame.localId);
    if (!pgGame) {
      // Game doesn't exist in PG yet — create it
      return await mirrorGameCreate(mongoGame);
    }
    const updated = await GameRepo.update(prisma, pgGame.id, updates);
    console.log(`[GameDualWrite] ✅ Mirrored game update: ${mongoGame.localId}`);
    return updated;
  } catch (error) {
    console.warn(`[GameDualWrite] ⚠️  Failed to mirror game update (${mongoGame.localId}):`, error.message);
    return null;
  }
}

/**
 * Mirror a legacy Game share to PostgreSQL
 */
async function mirrorGameShare(mongoGame) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgGame = await GameRepo.findByLocalId(prisma, mongoGame.localId);
    if (!pgGame) {
      return await mirrorGameCreate(mongoGame);
    }
    const updated = await GameRepo.updateShare(prisma, pgGame.id, {
      shareId: mongoGame.shareId,
      isShared: mongoGame.isShared,
      sharedAt: mongoGame.sharedAt
    });
    console.log(`[GameDualWrite] ✅ Mirrored game share: ${mongoGame.localId}`);
    return updated;
  } catch (error) {
    console.warn(`[GameDualWrite] ⚠️  Failed to mirror game share (${mongoGame.localId}):`, error.message);
    return null;
  }
}

// ========================================
// WizardGame mirroring
// ========================================

/**
 * Mirror a WizardGame creation to PostgreSQL
 */
async function mirrorWizardGameCreate(mongoGame) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgGame = await WizardGameRepo.create(prisma, {
      userId: mongoGame.userId?.toString() || mongoGame.userId,
      localId: mongoGame.localId,
      gameData: mongoGame.gameData || {},
      migratedFrom: mongoGame.migratedFrom || null,
      migratedAt: mongoGame.migratedAt || null,
      originalGameId: mongoGame.originalGameId?.toString() || null,
      shareId: mongoGame.shareId || null,
      isShared: mongoGame.isShared || false,
      sharedAt: mongoGame.sharedAt || null
    });
    console.log(`[GameDualWrite] ✅ Mirrored wizard game create: ${mongoGame.localId} → PG:${pgGame.id}`);
    return pgGame;
  } catch (error) {
    console.warn(`[GameDualWrite] ⚠️  Failed to mirror wizard game create (${mongoGame.localId}):`, error.message);
    return null;
  }
}

// ========================================
// TableGame mirroring
// ========================================

/**
 * Mirror a TableGame creation to PostgreSQL
 */
async function mirrorTableGameCreate(mongoGame) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgGame = await TableGameRepo.create(prisma, {
      userId: mongoGame.userId?.toString() || mongoGame.userId,
      localId: mongoGame.localId,
      name: mongoGame.name || 'Untitled',
      gameTypeName: mongoGame.gameTypeName || null,
      gameData: mongoGame.gameData || {},
      gameType: mongoGame.gameType || 'table',
      gameFinished: mongoGame.gameFinished || false,
      playerCount: mongoGame.playerCount || 0,
      totalRounds: mongoGame.totalRounds || 0,
      targetNumber: mongoGame.targetNumber || null,
      lowIsBetter: mongoGame.lowIsBetter || false,
      identitiesMigrated: mongoGame.identitiesMigrated || false,
      migratedAt: mongoGame.migratedAt || null
    });
    console.log(`[GameDualWrite] ✅ Mirrored table game create: ${mongoGame.localId} → PG:${pgGame.id}`);
    return pgGame;
  } catch (error) {
    console.warn(`[GameDualWrite] ⚠️  Failed to mirror table game create (${mongoGame.localId}):`, error.message);
    return null;
  }
}

/**
 * Mirror a TableGame deletion to PostgreSQL
 */
async function mirrorTableGameDelete(localId) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgGame = await TableGameRepo.findByLocalId(prisma, localId);
    if (!pgGame) {
      console.log(`[GameDualWrite] ℹ️  Table game not found in PG for delete: ${localId}`);
      return null;
    }
    await TableGameRepo.deleteById(prisma, pgGame.id);
    console.log(`[GameDualWrite] ✅ Mirrored table game delete: ${localId}`);
    return true;
  } catch (error) {
    console.warn(`[GameDualWrite] ⚠️  Failed to mirror table game delete (${localId}):`, error.message);
    return null;
  }
}

// ========================================
// GameEvent mirroring
// ========================================

/**
 * Mirror a GameEvent creation to PostgreSQL
 */
async function mirrorGameEventCreate(mongoEvent) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgEvent = await GameEventRepo.create(prisma, {
      eventId: mongoEvent.id,
      gameId: mongoEvent.gameId,
      actionType: mongoEvent.actionType,
      payload: mongoEvent.payload || {},
      timestamp: mongoEvent.timestamp,
      localVersion: mongoEvent.localVersion,
      userId: mongoEvent.userId?.toString() || mongoEvent.userId,
      clientId: mongoEvent.clientId || null,
      serverVersion: mongoEvent.serverVersion,
      acknowledged: mongoEvent.acknowledged !== undefined ? mongoEvent.acknowledged : true
    });
    console.log(`[GameDualWrite] ✅ Mirrored game event: ${mongoEvent.id} (v${mongoEvent.serverVersion})`);
    return pgEvent;
  } catch (error) {
    // Duplicate events are expected during replay — don't warn for unique constraint violations
    if (error.code === 'P2002') {
      return null;
    }
    console.warn(`[GameDualWrite] ⚠️  Failed to mirror game event (${mongoEvent.id}):`, error.message);
    return null;
  }
}

// ========================================
// GameSnapshot mirroring
// ========================================

/**
 * Mirror a GameSnapshot creation to PostgreSQL
 */
async function mirrorGameSnapshotCreate(mongoSnapshot) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgSnapshot = await GameSnapshotRepo.upsert(prisma, {
      gameId: mongoSnapshot.gameId,
      serverVersion: mongoSnapshot.serverVersion,
      gameState: mongoSnapshot.gameState || {},
      userId: mongoSnapshot.userId?.toString() || mongoSnapshot.userId,
      eventCount: mongoSnapshot.eventCount || 0,
      checksum: mongoSnapshot.checksum || null
    });
    console.log(`[GameDualWrite] ✅ Mirrored game snapshot: game=${mongoSnapshot.gameId} v${mongoSnapshot.serverVersion}`);
    return pgSnapshot;
  } catch (error) {
    console.warn(`[GameDualWrite] ⚠️  Failed to mirror game snapshot (game=${mongoSnapshot.gameId}):`, error.message);
    return null;
  }
}

module.exports = {
  // Legacy Game
  mirrorGameCreate,
  mirrorGameUpdate,
  mirrorGameShare,
  // WizardGame
  mirrorWizardGameCreate,
  // TableGame
  mirrorTableGameCreate,
  mirrorTableGameDelete,
  // GameEvent
  mirrorGameEventCreate,
  // GameSnapshot
  mirrorGameSnapshotCreate
};
