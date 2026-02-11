/**
 * Game Repository (Legacy Games)
 * Data access layer for the generic Game model using Prisma
 */

/**
 * Create a game
 */
async function create(prisma, data) {
  return await prisma.game.create({
    data: {
      userId: data.userId,
      localId: data.localId,
      gameData: data.gameData || {},
      shareId: data.shareId || null,
      isShared: data.isShared || false,
      sharedAt: data.sharedAt || null
    }
  });
}

/**
 * Find game by localId
 */
async function findByLocalId(prisma, localId) {
  return await prisma.game.findUnique({
    where: { localId }
  });
}

/**
 * Find game by ID
 */
async function findById(prisma, id) {
  return await prisma.game.findUnique({
    where: { id }
  });
}

/**
 * Find game by shareId
 */
async function findByShareId(prisma, shareId) {
  return await prisma.game.findFirst({
    where: { shareId }
  });
}

/**
 * List games for a user, sorted by createdAt desc
 */
async function findByUserId(prisma, userId, { limit = 50, skip = 0 } = {}) {
  return await prisma.game.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip
  });
}

/**
 * Count games for a user
 */
async function countByUserId(prisma, userId) {
  return await prisma.game.count({
    where: { userId }
  });
}

/**
 * Update a game
 */
async function update(prisma, id, data) {
  return await prisma.game.update({
    where: { id },
    data
  });
}

/**
 * Update share status
 */
async function updateShare(prisma, id, { shareId, isShared, sharedAt }) {
  return await prisma.game.update({
    where: { id },
    data: { shareId, isShared, sharedAt }
  });
}

/**
 * Delete a game by ID
 */
async function deleteById(prisma, id) {
  return await prisma.game.delete({
    where: { id }
  });
}

/**
 * Delete games by userId
 */
async function deleteByUserId(prisma, userId) {
  return await prisma.game.deleteMany({
    where: { userId }
  });
}

/**
 * Create from a MongoDB document (for backfill)
 */
async function createFromMongo(prisma, mongoDoc) {
  const data = {
    userId: mongoDoc.userId?.toString() || mongoDoc.userId,
    localId: mongoDoc.localId,
    gameData: mongoDoc.gameData || {},
    shareId: mongoDoc.shareId || null,
    isShared: mongoDoc.isShared || false,
    sharedAt: mongoDoc.sharedAt || null,
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };

  return await prisma.game.upsert({
    where: { localId: data.localId },
    update: data,
    create: data
  });
}

module.exports = {
  create,
  findByLocalId,
  findById,
  findByShareId,
  findByUserId,
  countByUserId,
  update,
  updateShare,
  deleteById,
  deleteByUserId,
  createFromMongo
};
