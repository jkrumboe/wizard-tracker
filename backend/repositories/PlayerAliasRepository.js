/**
 * PlayerAlias Repository
 * Data access layer for PlayerAlias operations using Prisma
 */

/**
 * Create an alias
 */
async function create(prisma, data) {
  return await prisma.playerAlias.create({
    data: {
      aliasName: data.aliasName,
      userId: data.userId,
      createdById: data.createdById,
      notes: data.notes || ''
    }
  });
}

/**
 * Find alias by name
 */
async function findByName(prisma, aliasName) {
  return await prisma.playerAlias.findUnique({
    where: { aliasName },
    include: {
      user: { select: { id: true, username: true } },
      createdBy: { select: { id: true, username: true } }
    }
  });
}

/**
 * Find all aliases for a user
 */
async function findByUserId(prisma, userId) {
  return await prisma.playerAlias.findMany({
    where: { userId },
    include: {
      createdBy: { select: { id: true, username: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Find all aliases created by a user
 */
async function findByCreatedById(prisma, createdById) {
  return await prisma.playerAlias.findMany({
    where: { createdById },
    include: {
      user: { select: { id: true, username: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Delete an alias by ID
 */
async function deleteById(prisma, id) {
  return await prisma.playerAlias.delete({
    where: { id }
  });
}

/**
 * Delete all aliases for a user
 */
async function deleteByUserId(prisma, userId) {
  return await prisma.playerAlias.deleteMany({
    where: { userId }
  });
}

/**
 * Count aliases for a user
 */
async function countByUserId(prisma, userId) {
  return await prisma.playerAlias.count({
    where: { userId }
  });
}

/**
 * Create from a MongoDB document (for backfill)
 */
async function createFromMongo(prisma, mongoDoc) {
  return await prisma.playerAlias.upsert({
    where: { aliasName: mongoDoc.aliasName },
    update: {
      userId: mongoDoc.userId?.toString(),
      createdById: mongoDoc.createdBy?.toString() || mongoDoc.userId?.toString(),
      notes: mongoDoc.notes || '',
      createdAt: mongoDoc.createdAt || new Date(),
      updatedAt: mongoDoc.updatedAt || new Date()
    },
    create: {
      aliasName: mongoDoc.aliasName,
      userId: mongoDoc.userId?.toString(),
      createdById: mongoDoc.createdBy?.toString() || mongoDoc.userId?.toString(),
      notes: mongoDoc.notes || '',
      createdAt: mongoDoc.createdAt || new Date(),
      updatedAt: mongoDoc.updatedAt || new Date()
    }
  });
}

module.exports = {
  create,
  findByName,
  findByUserId,
  findByCreatedById,
  deleteById,
  deleteByUserId,
  countByUserId,
  createFromMongo
};
