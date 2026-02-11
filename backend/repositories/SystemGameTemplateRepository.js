/**
 * SystemGameTemplate Repository
 * Data access layer for system-level game templates using Prisma
 */

/**
 * Create a system template
 */
async function create(prisma, data) {
  return await prisma.systemGameTemplate.create({
    data: {
      name: data.name,
      targetNumber: data.targetNumber ?? null,
      lowIsBetter: data.lowIsBetter || false,
      description: data.description || null,
      descriptionMarkdown: data.descriptionMarkdown || null,
      usageCount: data.usageCount || 0,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdById: data.createdById || null
    }
  });
}

/**
 * Find template by ID
 */
async function findById(prisma, id) {
  return await prisma.systemGameTemplate.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, username: true } }
    }
  });
}

/**
 * Find template by name
 */
async function findByName(prisma, name) {
  return await prisma.systemGameTemplate.findUnique({
    where: { name }
  });
}

/**
 * Find all active templates
 */
async function findAllActive(prisma) {
  return await prisma.systemGameTemplate.findMany({
    where: { isActive: true },
    orderBy: { usageCount: 'desc' }
  });
}

/**
 * Find all templates (admin)
 */
async function findAll(prisma, options = {}) {
  const { includeInactive = false } = options;
  const where = includeInactive ? {} : { isActive: true };

  return await prisma.systemGameTemplate.findMany({
    where,
    include: {
      createdBy: { select: { id: true, username: true } }
    },
    orderBy: { name: 'asc' }
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
  if (updates.isActive !== undefined) data.isActive = updates.isActive;

  return await prisma.systemGameTemplate.update({
    where: { id },
    data
  });
}

/**
 * Increment usage count
 */
async function incrementUsage(prisma, id) {
  return await prisma.systemGameTemplate.update({
    where: { id },
    data: { usageCount: { increment: 1 } }
  });
}

/**
 * Delete by ID
 */
async function deleteById(prisma, id) {
  return await prisma.systemGameTemplate.delete({
    where: { id }
  });
}

/**
 * Create from a MongoDB document (for backfill)
 */
async function createFromMongo(prisma, mongoDoc) {
  return await prisma.systemGameTemplate.upsert({
    where: { name: mongoDoc.name },
    update: {
      targetNumber: mongoDoc.targetNumber ?? null,
      lowIsBetter: mongoDoc.lowIsBetter || false,
      description: mongoDoc.description || null,
      descriptionMarkdown: mongoDoc.descriptionMarkdown || null,
      usageCount: mongoDoc.usageCount || 0,
      isActive: mongoDoc.isActive !== undefined ? mongoDoc.isActive : true,
      createdById: mongoDoc.createdBy?.toString() || null,
      updatedAt: mongoDoc.updatedAt || new Date()
    },
    create: {
      name: mongoDoc.name,
      targetNumber: mongoDoc.targetNumber ?? null,
      lowIsBetter: mongoDoc.lowIsBetter || false,
      description: mongoDoc.description || null,
      descriptionMarkdown: mongoDoc.descriptionMarkdown || null,
      usageCount: mongoDoc.usageCount || 0,
      isActive: mongoDoc.isActive !== undefined ? mongoDoc.isActive : true,
      createdById: mongoDoc.createdBy?.toString() || null,
      createdAt: mongoDoc.createdAt || new Date(),
      updatedAt: mongoDoc.updatedAt || new Date()
    }
  });
}

module.exports = {
  create,
  findById,
  findByName,
  findAllActive,
  findAll,
  update,
  incrementUsage,
  deleteById,
  createFromMongo
};
