/**
 * TableGame Repository
 * Data access layer for TableGame operations using Prisma
 */

/**
 * Create a table game
 */
async function create(prisma, data) {
  return await prisma.tableGame.create({
    data: {
      userId: data.userId,
      localId: data.localId,
      name: data.name,
      gameTypeName: data.gameTypeName || null,
      gameData: data.gameData || {},
      gameType: data.gameType || 'table',
      gameFinished: data.gameFinished || false,
      playerCount: data.playerCount || 0,
      totalRounds: data.totalRounds || 0,
      targetNumber: data.targetNumber || null,
      lowIsBetter: data.lowIsBetter || false,
      identitiesMigrated: data.identitiesMigrated || false,
      migratedAt: data.migratedAt || null
    }
  });
}

/**
 * Find table game by localId
 */
async function findByLocalId(prisma, localId) {
  return await prisma.tableGame.findUnique({
    where: { localId }
  });
}

/**
 * Find table game by ID
 */
async function findById(prisma, id) {
  return await prisma.tableGame.findUnique({
    where: { id }
  });
}

/**
 * List table games for a user, with pagination
 */
async function findByUserId(prisma, userId, { limit = 50, skip = 0 } = {}) {
  return await prisma.tableGame.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip
  });
}

/**
 * List all table games with pagination
 */
async function findAll(prisma, { limit = 50, skip = 0 } = {}) {
  return await prisma.tableGame.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip
  });
}

/**
 * Count table games for a user
 */
async function countByUserId(prisma, userId) {
  return await prisma.tableGame.count({
    where: { userId }
  });
}

/**
 * Count all table games
 */
async function countAll(prisma) {
  return await prisma.tableGame.count();
}

/**
 * Update a table game
 */
async function update(prisma, id, data) {
  return await prisma.tableGame.update({
    where: { id },
    data
  });
}

/**
 * Delete a table game by ID
 */
async function deleteById(prisma, id) {
  return await prisma.tableGame.delete({
    where: { id }
  });
}

/**
 * Delete by user and ID (ensures ownership)
 */
async function deleteByUserAndId(prisma, id, userId) {
  return await prisma.tableGame.deleteMany({
    where: { id, userId }
  });
}

/**
 * Create from a MongoDB document (for backfill)
 */
async function createFromMongo(prisma, mongoDoc) {
  const data = {
    userId: mongoDoc.userId?.toString() || mongoDoc.userId,
    localId: mongoDoc.localId,
    name: mongoDoc.name || 'Untitled',
    gameTypeName: mongoDoc.gameTypeName || null,
    gameData: mongoDoc.gameData || {},
    gameType: mongoDoc.gameType || 'table',
    gameFinished: mongoDoc.gameFinished || false,
    playerCount: mongoDoc.playerCount || 0,
    totalRounds: mongoDoc.totalRounds || 0,
    targetNumber: mongoDoc.targetNumber || null,
    lowIsBetter: mongoDoc.lowIsBetter || false,
    identitiesMigrated: mongoDoc.identitiesMigrated || false,
    migratedAt: mongoDoc.migratedAt || null,
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };

  return await prisma.tableGame.upsert({
    where: { localId: data.localId },
    update: data,
    create: data
  });
}

module.exports = {
  create,
  findByLocalId,
  findById,
  findByUserId,
  findAll,
  countByUserId,
  countAll,
  update,
  deleteById,
  deleteByUserAndId,
  createFromMongo
};
