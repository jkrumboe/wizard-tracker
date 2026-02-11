/**
 * GameSnapshot Repository
 * Data access layer for GameSnapshot operations using Prisma
 */

/**
 * Create a game snapshot
 */
async function create(prisma, data) {
  return await prisma.gameSnapshot.create({
    data: {
      gameId: data.gameId,
      serverVersion: data.serverVersion,
      gameState: data.gameState || {},
      userId: data.userId?.toString() || data.userId,
      eventCount: data.eventCount || 0,
      checksum: data.checksum || null,
      expiresAt: data.expiresAt || null
    }
  });
}

/**
 * Find latest snapshot for a game
 */
async function findLatestByGameId(prisma, gameId) {
  return await prisma.gameSnapshot.findFirst({
    where: { gameId },
    orderBy: { serverVersion: 'desc' }
  });
}

/**
 * Find snapshot by gameId and serverVersion
 */
async function findByGameAndVersion(prisma, gameId, serverVersion) {
  return await prisma.gameSnapshot.findUnique({
    where: {
      gameId_serverVersion: {
        gameId,
        serverVersion
      }
    }
  });
}

/**
 * Upsert snapshot (create or update)
 */
async function upsert(prisma, data) {
  return await prisma.gameSnapshot.upsert({
    where: {
      gameId_serverVersion: {
        gameId: data.gameId,
        serverVersion: data.serverVersion
      }
    },
    update: {
      gameState: data.gameState,
      userId: data.userId?.toString() || data.userId,
      eventCount: data.eventCount || 0,
      checksum: data.checksum || null
    },
    create: {
      gameId: data.gameId,
      serverVersion: data.serverVersion,
      gameState: data.gameState || {},
      userId: data.userId?.toString() || data.userId,
      eventCount: data.eventCount || 0,
      checksum: data.checksum || null,
      expiresAt: data.expiresAt || null
    }
  });
}

/**
 * Create from a MongoDB document (for backfill)
 */
async function createFromMongo(prisma, mongoDoc) {
  return await upsert(prisma, {
    gameId: mongoDoc.gameId,
    serverVersion: mongoDoc.serverVersion,
    gameState: mongoDoc.gameState || {},
    userId: mongoDoc.userId?.toString() || mongoDoc.userId,
    eventCount: mongoDoc.eventCount || 0,
    checksum: mongoDoc.checksum || null
  });
}

module.exports = {
  create,
  findLatestByGameId,
  findByGameAndVersion,
  upsert,
  createFromMongo
};
