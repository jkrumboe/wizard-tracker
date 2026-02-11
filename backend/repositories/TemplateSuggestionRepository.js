/**
 * TemplateSuggestion Repository
 * Data access layer for template suggestion operations using Prisma
 */

/**
 * Create a suggestion
 */
async function create(prisma, data) {
  return await prisma.templateSuggestion.create({
    data: {
      name: data.name,
      targetNumber: data.targetNumber ?? null,
      lowIsBetter: data.lowIsBetter || false,
      description: data.description || null,
      descriptionMarkdown: data.descriptionMarkdown || null,
      suggestedById: data.suggestedById,
      suggestionNote: data.suggestionNote || '',
      suggestionType: data.suggestionType || 'new_template',
      status: data.status || 'pending',
      userTemplateId: data.userTemplateId || null,
      systemTemplateId: data.systemTemplateId || null
    }
  });
}

/**
 * Find by ID
 */
async function findById(prisma, id) {
  return await prisma.templateSuggestion.findUnique({
    where: { id },
    include: {
      suggestedBy: { select: { id: true, username: true } },
      userTemplate: { select: { id: true, name: true } },
      systemTemplate: { select: { id: true, name: true } }
    }
  });
}

/**
 * Find all pending suggestions
 */
async function findPending(prisma, options = {}) {
  const { limit = 50, skip = 0 } = options;
  return await prisma.templateSuggestion.findMany({
    where: { status: 'pending' },
    include: {
      suggestedBy: { select: { id: true, username: true } },
      userTemplate: { select: { id: true, name: true } }
    },
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Find suggestions by user
 */
async function findByUserId(prisma, userId) {
  return await prisma.templateSuggestion.findMany({
    where: { suggestedById: userId },
    include: {
      userTemplate: { select: { id: true, name: true } },
      systemTemplate: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Find by status
 */
async function findByStatus(prisma, status, options = {}) {
  const { limit = 50, skip = 0 } = options;
  return await prisma.templateSuggestion.findMany({
    where: { status },
    include: {
      suggestedBy: { select: { id: true, username: true } },
      userTemplate: { select: { id: true, name: true } },
      systemTemplate: { select: { id: true, name: true } }
    },
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Approve a suggestion
 */
async function approve(prisma, id, reviewNote = '') {
  return await prisma.templateSuggestion.update({
    where: { id },
    data: {
      status: 'approved',
      reviewedAt: new Date(),
      reviewNote
    }
  });
}

/**
 * Reject a suggestion
 */
async function reject(prisma, id, reviewNote = '') {
  return await prisma.templateSuggestion.update({
    where: { id },
    data: {
      status: 'rejected',
      reviewedAt: new Date(),
      reviewNote
    }
  });
}

/**
 * Delete by ID
 */
async function deleteById(prisma, id) {
  return await prisma.templateSuggestion.delete({
    where: { id }
  });
}

/**
 * Count pending suggestions
 */
async function countPending(prisma) {
  return await prisma.templateSuggestion.count({
    where: { status: 'pending' }
  });
}

/**
 * Create from a MongoDB document (for backfill)
 */
async function createFromMongo(prisma, mongoDoc) {
  // Map old boolean `approved` field to new enum `status`
  let status = 'pending';
  if (mongoDoc.status) {
    status = mongoDoc.status;
  } else if (mongoDoc.approved === true) {
    status = 'approved';
  } else if (mongoDoc.approved === false) {
    status = 'pending';
  }

  // Map old `type` discriminator field to `suggestionType`
  let suggestionType = 'new_template';
  if (mongoDoc.suggestionType) {
    // Map MongoDB values to Prisma enum values
    const typeMap = { 'new': 'new_template', 'new_template': 'new_template', 'change': 'change' };
    suggestionType = typeMap[mongoDoc.suggestionType] || 'new_template';
  }

  return await prisma.templateSuggestion.create({
    data: {
      name: mongoDoc.name,
      targetNumber: mongoDoc.targetNumber ?? null,
      lowIsBetter: mongoDoc.lowIsBetter || false,
      description: mongoDoc.description || null,
      descriptionMarkdown: mongoDoc.descriptionMarkdown || null,
      suggestedById: mongoDoc.userId?.toString() || mongoDoc.suggestedBy?.toString(),
      suggestionNote: mongoDoc.suggestionNote || mongoDoc.notes || '',
      suggestionType,
      status,
      reviewedAt: mongoDoc.reviewedAt || null,
      reviewNote: mongoDoc.reviewNote || '',
      userTemplateId: null, // FK will be resolved after templates are migrated
      systemTemplateId: null,
      createdAt: mongoDoc.createdAt || new Date(),
      updatedAt: mongoDoc.updatedAt || new Date()
    }
  });
}

module.exports = {
  create,
  findById,
  findPending,
  findByUserId,
  findByStatus,
  approve,
  reject,
  deleteById,
  countPending,
  createFromMongo
};
