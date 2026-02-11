/**
 * WizardGame Repository
 * Data access layer for WizardGame operations using Prisma
 */

/**
 * Create a wizard game
 */
async function create(prisma, data) {
  return await prisma.wizardGame.create({
    data: {
      userId: data.userId,
      localId: data.localId,
      gameData: data.gameData || {},
      migratedFrom: data.migratedFrom || null,
      migratedAt: data.migratedAt || null,
      originalGameId: data.originalGameId || null,
      shareId: data.shareId || null,
      isShared: data.isShared || false,
      sharedAt: data.sharedAt || null
    }
  });
}

/**
 * Find wizard game by localId
 */
async function findByLocalId(prisma, localId) {
  return await prisma.wizardGame.findUnique({
    where: { localId }
  });
}

/**
 * Find wizard game by ID
 */
async function findById(prisma, id) {
  return await prisma.wizardGame.findUnique({
    where: { id }
  });
}

/**
 * Find wizard game by shareId
 */
async function findByShareId(prisma, shareId) {
  return await prisma.wizardGame.findFirst({
    where: { shareId }
  });
}

/**
 * List wizard games for a user, with pagination
 */
async function findByUserId(prisma, userId, { limit = 50, skip = 0 } = {}) {
  return await prisma.wizardGame.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip
  });
}

/**
 * List all wizard games with pagination
 */
async function findAll(prisma, { limit = 50, skip = 0 } = {}) {
  return await prisma.wizardGame.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip
  });
}

/**
 * Count wizard games for a user
 */
async function countByUserId(prisma, userId) {
  return await prisma.wizardGame.count({
    where: { userId }
  });
}

/**
 * Count all wizard games
 */
async function countAll(prisma) {
  return await prisma.wizardGame.count();
}

/**
 * Count migrated wizard games for a user
 */
async function countMigrated(prisma, userId) {
  return await prisma.wizardGame.count({
    where: {
      userId,
      migratedFrom: { not: null }
    }
  });
}

/**
 * Update a wizard game
 */
async function update(prisma, id, data) {
  return await prisma.wizardGame.update({
    where: { id },
    data
  });
}

/**
 * Delete a wizard game by ID
 */
async function deleteById(prisma, id) {
  return await prisma.wizardGame.delete({
    where: { id }
  });
}

/**
 * Check existence of multiple games by _id (for batch-check)
 * Since PG uses cuid IDs, we check by localId instead
 */
async function findManyByLocalIds(prisma, localIds) {
  return await prisma.wizardGame.findMany({
    where: { localId: { in: localIds } },
    select: { localId: true }
  });
}

/**
 * Search for content-based duplicates
 */
async function findPotentialDuplicates(prisma, { createdAt, totalRounds, gameFinished }) {
  // Use JSON path queries on gameData for duplicate detection
  return await prisma.wizardGame.findMany({
    where: {
      gameData: {
        path: ['gameFinished'],
        equals: gameFinished
      }
    },
    take: 50
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
    migratedFrom: mongoDoc.migratedFrom || null,
    migratedAt: mongoDoc.migratedAt || null,
    originalGameId: mongoDoc.originalGameId?.toString() || null,
    shareId: mongoDoc.shareId || null,
    isShared: mongoDoc.isShared || false,
    sharedAt: mongoDoc.sharedAt || null,
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };

  return await prisma.wizardGame.upsert({
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
  findAll,
  countByUserId,
  countAll,
  countMigrated,
  update,
  deleteById,
  findManyByLocalIds,
  findPotentialDuplicates,
  createFromMongo
};
