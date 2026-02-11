/**
 * GameEvent Repository
 * Data access layer for GameEvent (event-sourcing) operations using Prisma
 */

/**
 * Create a game event
 */
async function create(prisma, data) {
  return await prisma.gameEvent.create({
    data: {
      eventId: data.eventId || data.id,
      gameId: data.gameId,
      actionType: data.actionType,
      payload: data.payload || {},
      timestamp: BigInt(data.timestamp),
      localVersion: data.localVersion,
      userId: data.userId,
      clientId: data.clientId || null,
      serverVersion: data.serverVersion,
      acknowledged: data.acknowledged !== undefined ? data.acknowledged : true
    }
  });
}

/**
 * Find latest event for a game (highest serverVersion)
 */
async function findLatestByGameId(prisma, gameId) {
  return await prisma.gameEvent.findFirst({
    where: { gameId },
    orderBy: { serverVersion: 'desc' }
  });
}

/**
 * Find events for a game since a given server version
 */
async function findSinceVersion(prisma, gameId, sinceVersion) {
  return await prisma.gameEvent.findMany({
    where: {
      gameId,
      serverVersion: { gt: sinceVersion }
    },
    orderBy: { serverVersion: 'asc' }
  });
}

/**
 * Find event by event ID and game ID
 */
async function findByEventAndGameId(prisma, eventId, gameId) {
  return await prisma.gameEvent.findFirst({
    where: { eventId, gameId }
  });
}

/**
 * Count events for a game
 */
async function countByGameId(prisma, gameId) {
  return await prisma.gameEvent.count({
    where: { gameId }
  });
}

/**
 * Find all events for a game, ordered by serverVersion
 */
async function findAllByGameId(prisma, gameId, { limit = 1000, skip = 0 } = {}) {
  return await prisma.gameEvent.findMany({
    where: { gameId },
    orderBy: { serverVersion: 'asc' },
    take: limit,
    skip
  });
}

/**
 * Create from a MongoDB document (for backfill)
 */
async function createFromMongo(prisma, mongoDoc) {
  const data = {
    eventId: mongoDoc.id,
    gameId: mongoDoc.gameId,
    actionType: mongoDoc.actionType,
    payload: mongoDoc.payload || {},
    timestamp: BigInt(mongoDoc.timestamp),
    localVersion: mongoDoc.localVersion,
    userId: mongoDoc.userId?.toString() || mongoDoc.userId,
    clientId: mongoDoc.clientId || null,
    serverVersion: mongoDoc.serverVersion,
    acknowledged: mongoDoc.acknowledged !== undefined ? mongoDoc.acknowledged : true,
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };

  return await prisma.gameEvent.upsert({
    where: {
      gameId_eventId: {
        gameId: data.gameId,
        eventId: data.eventId
      }
    },
    update: data,
    create: data
  });
}

module.exports = {
  create,
  findLatestByGameId,
  findSinceVersion,
  findByEventAndGameId,
  countByGameId,
  findAllByGameId,
  createFromMongo
};
