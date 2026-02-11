/**
 * UserGameTemplate Repository
 * Data access layer for user-created game templates using Prisma
 */

/**
 * Create a user template
 */
async function create(prisma, data) {
  return await prisma.userGameTemplate.create({
    data: {
      userId: data.userId,
      localId: data.localId || null,
      name: data.name,
      targetNumber: data.targetNumber ?? null,
      lowIsBetter: data.lowIsBetter || false,
      description: data.description || null,
      descriptionMarkdown: data.descriptionMarkdown || null,
      usageCount: data.usageCount || 0,
      isPublic: data.isPublic || false,
      approvedAsSystemTemplate: data.approvedAsSystemTemplate || false,
      systemTemplateId: data.systemTemplateId || null
    }
  });
}

/**
 * Find by ID
 */
async function findById(prisma, id) {
  return await prisma.userGameTemplate.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true } },
      systemTemplate: true
    }
  });
}

/**
 * Find by localId
 */
async function findByLocalId(prisma, localId) {
  return await prisma.userGameTemplate.findUnique({
    where: { localId }
  });
}

/**
 * Find all templates for a user
 */
async function findByUserId(prisma, userId) {
  return await prisma.userGameTemplate.findMany({
    where: { userId },
    include: {
      systemTemplate: { select: { id: true, name: true } }
    },
    orderBy: { name: 'asc' }
  });
}

/**
 * Find by user and name
 */
async function findByUserAndName(prisma, userId, name) {
  return await prisma.userGameTemplate.findFirst({
    where: { userId, name }
  });
}

/**
 * Update a template
 */
async function update(prisma, id, updates) {
  const data = {};
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.targetNumber !== undefined) data.targetNumber = updates.targetNumber;
  if (updates.lowIsBetter !== undefined) data.lowIsBetter = updates.lowIsBetter;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.descriptionMarkdown !== undefined) data.descriptionMarkdown = updates.descriptionMarkdown;
  if (updates.isPublic !== undefined) data.isPublic = updates.isPublic;
  if (updates.approvedAsSystemTemplate !== undefined) data.approvedAsSystemTemplate = updates.approvedAsSystemTemplate;
  if (updates.systemTemplateId !== undefined) data.systemTemplateId = updates.systemTemplateId;

  return await prisma.userGameTemplate.update({
    where: { id },
    data
  });
}

/**
 * Increment usage count
 */
async function incrementUsage(prisma, id) {
  return await prisma.userGameTemplate.update({
    where: { id },
    data: { usageCount: { increment: 1 } }
  });
}

/**
 * Delete by ID
 */
async function deleteById(prisma, id) {
  return await prisma.userGameTemplate.delete({
    where: { id }
  });
}

/**
 * Delete all templates for a user
 */
async function deleteByUserId(prisma, userId) {
  return await prisma.userGameTemplate.deleteMany({
    where: { userId }
  });
}

/**
 * Count templates by user
 */
async function countByUserId(prisma, userId) {
  return await prisma.userGameTemplate.count({
    where: { userId }
  });
}

/**
 * Find all public templates
 */
async function findPublic(prisma, options = {}) {
  const { limit = 50, skip = 0 } = options;
  return await prisma.userGameTemplate.findMany({
    where: { isPublic: true },
    include: {
      user: { select: { id: true, username: true } }
    },
    skip,
    take: limit,
    orderBy: { usageCount: 'desc' }
  });
}

/**
 * Create from a MongoDB document (for backfill)
 */
async function createFromMongo(prisma, mongoDoc) {
  const localId = mongoDoc.localId || null;
  const where = localId ? { localId } : { id: mongoDoc._id?.toString() || 'none' };

  // Resolve systemTemplateId FK: look up by name in PG instead of using MongoDB ObjectID
  let systemTemplateId = null;
  if (mongoDoc.approvedAsSystemTemplate && mongoDoc.name) {
    const sysTemplate = await prisma.systemGameTemplate.findUnique({ where: { name: mongoDoc.name } });
    systemTemplateId = sysTemplate?.id || null;
  }

  return await prisma.userGameTemplate.upsert({
    where,
    update: {
      userId: mongoDoc.userId?.toString(),
      name: mongoDoc.name,
      targetNumber: mongoDoc.targetNumber ?? null,
      lowIsBetter: mongoDoc.lowIsBetter || false,
      description: mongoDoc.description || null,
      descriptionMarkdown: mongoDoc.descriptionMarkdown || null,
      usageCount: mongoDoc.usageCount || 0,
      isPublic: mongoDoc.isPublic || false,
      approvedAsSystemTemplate: mongoDoc.approvedAsSystemTemplate || false,
      systemTemplateId,
      updatedAt: mongoDoc.updatedAt || new Date()
    },
    create: {
      userId: mongoDoc.userId?.toString(),
      localId,
      name: mongoDoc.name,
      targetNumber: mongoDoc.targetNumber ?? null,
      lowIsBetter: mongoDoc.lowIsBetter || false,
      description: mongoDoc.description || null,
      descriptionMarkdown: mongoDoc.descriptionMarkdown || null,
      usageCount: mongoDoc.usageCount || 0,
      isPublic: mongoDoc.isPublic || false,
      approvedAsSystemTemplate: mongoDoc.approvedAsSystemTemplate || false,
      systemTemplateId,
      createdAt: mongoDoc.createdAt || new Date(),
      updatedAt: mongoDoc.updatedAt || new Date()
    }
  });
}

module.exports = {
  create,
  findById,
  findByLocalId,
  findByUserId,
  findByUserAndName,
  update,
  incrementUsage,
  deleteById,
  deleteByUserId,
  countByUserId,
  findPublic,
  createFromMongo
};
