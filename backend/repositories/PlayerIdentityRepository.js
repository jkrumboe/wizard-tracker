/**
 * PlayerIdentity Repository
 * Data access layer for PlayerIdentity operations using Prisma
 */

/**
 * Find identity by ID
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} id - Identity ID
 * @returns {Promise<PlayerIdentity|null>}
 */
async function findById(prisma, id) {
  return await prisma.playerIdentity.findUnique({
    where: { id, isDeleted: false },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
          profilePicture: true
        }
      },
      mergedInto: {
        select: {
          id: true,
          displayName: true,
          userId: true
        }
      }
    }
  });
}

/**
 * Find identity by name (case-insensitive)
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} name - Display name to search for
 * @returns {Promise<PlayerIdentity|null>}
 */
async function findByName(prisma, name) {
  const normalizedName = name.toLowerCase().trim();
  
  return await prisma.playerIdentity.findFirst({
    where: {
      normalizedName,
      isDeleted: false
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
          profilePicture: true
        }
      }
    }
  });
}

/**
 * Find all identities for a user
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} userId - User ID
 * @returns {Promise<PlayerIdentity[]>}
 */
async function findByUserId(prisma, userId) {
  return await prisma.playerIdentity.findMany({
    where: {
      userId,
      isDeleted: false
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
          profilePicture: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}

/**
 * Search identities by name
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} searchTerm - Search term
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Results with pagination
 */
async function search(prisma, searchTerm, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  const where = {
    isDeleted: false
  };
  
  if (searchTerm) {
    where.OR = [
      { displayName: { contains: searchTerm, mode: 'insensitive' } },
      { normalizedName: { contains: searchTerm.toLowerCase().trim() } }
    ];
  }
  
  const [identities, total] = await Promise.all([
    prisma.playerIdentity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: {
        displayName: 'asc'
      }
    }),
    prisma.playerIdentity.count({ where })
  ]);
  
  return {
    identities,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Create or find identity by name
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} name - Display name
 * @param {Object} options - Additional options
 * @returns {Promise<PlayerIdentity>}
 */
async function findOrCreate(prisma, name, options = {}) {
  const normalizedName = name.toLowerCase().trim();
  const { type = 'guest', userId = null, createdById = null } = options;
  
  // Try to find existing
  let identity = await prisma.playerIdentity.findFirst({
    where: {
      normalizedName,
      isDeleted: false
    }
  });
  
  if (identity) {
    return identity;
  }
  
  // Create new identity
  return await prisma.playerIdentity.create({
    data: {
      displayName: name.trim(),
      normalizedName,
      type,
      userId,
      createdById
    }
  });
}

/**
 * Create a new identity
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {Object} data - Identity data
 * @returns {Promise<PlayerIdentity>}
 */
async function create(prisma, data) {
  const { displayName, userId, type = 'guest', createdById } = data;
  const normalizedName = displayName.toLowerCase().trim();
  
  return await prisma.playerIdentity.create({
    data: {
      displayName: displayName.trim(),
      normalizedName,
      type,
      userId,
      createdById
    }
  });
}

/**
 * Update identity
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} id - Identity ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<PlayerIdentity>}
 */
async function update(prisma, id, updates) {
  const data = {};
  
  if (updates.displayName !== undefined) {
    data.displayName = updates.displayName.trim();
    data.normalizedName = updates.displayName.toLowerCase().trim();
  }
  if (updates.userId !== undefined) data.userId = updates.userId;
  if (updates.type !== undefined) data.type = updates.type;
  if (updates.eloData !== undefined) data.eloData = updates.eloData;
  if (updates.totalGames !== undefined) data.totalGames = updates.totalGames;
  if (updates.totalWins !== undefined) data.totalWins = updates.totalWins;
  if (updates.lastGameAt !== undefined) data.lastGameAt = updates.lastGameAt;
  if (updates.nameHistory !== undefined) data.nameHistory = updates.nameHistory;
  if (updates.aliases !== undefined) data.aliases = updates.aliases;
  
  return await prisma.playerIdentity.update({
    where: { id },
    data
  });
}

/**
 * Link identity to user
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} identityId - Identity ID
 * @param {string} userId - User ID
 * @returns {Promise<PlayerIdentity>}
 */
async function linkToUser(prisma, identityId, userId) {
  return await prisma.playerIdentity.update({
    where: { id: identityId },
    data: {
      userId,
      type: 'user'
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
          profilePicture: true
        }
      }
    }
  });
}

/**
 * Merge identity into another
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} sourceId - Source identity ID
 * @param {string} targetId - Target identity ID
 * @returns {Promise<PlayerIdentity>}
 */
async function merge(prisma, sourceId, targetId) {
  return await prisma.playerIdentity.update({
    where: { id: sourceId },
    data: {
      mergedIntoId: targetId,
      isDeleted: true,
      deletedAt: new Date()
    }
  });
}

/**
 * Soft delete identity
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} id - Identity ID
 * @returns {Promise<PlayerIdentity>}
 */
async function softDelete(prisma, id) {
  return await prisma.playerIdentity.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date()
    }
  });
}

/**
 * Get identity statistics
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} userId - User ID
 * @returns {Promise<Object>}
 */
async function getUserStats(prisma, userId) {
  const identities = await prisma.playerIdentity.findMany({
    where: {
      userId,
      isDeleted: false
    },
    select: {
      totalGames: true,
      totalWins: true
    }
  });
  
  const stats = identities.reduce(
    (acc, identity) => ({
      totalGames: acc.totalGames + identity.totalGames,
      totalWins: acc.totalWins + identity.totalWins
    }),
    { totalGames: 0, totalWins: 0 }
  );
  
  return stats;
}

/**
 * Get all identities with filtering (admin)
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {Object} options - Filter options
 * @returns {Promise<Object>}
 */
async function getAll(prisma, options = {}) {
  const { page = 1, limit = 50, type, linked, search } = options;
  const skip = (page - 1) * limit;
  
  const where = { isDeleted: false };
  
  if (type) where.type = type;
  if (linked === true) where.userId = { not: null };
  if (linked === false) where.userId = null;
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: 'insensitive' } },
      { normalizedName: { contains: search.toLowerCase() } }
    ];
  }
  
  const [identities, total] = await Promise.all([
    prisma.playerIdentity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          }
        },
        mergedInto: {
          select: {
            id: true,
            displayName: true,
            userId: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: {
        displayName: 'asc'
      }
    }),
    prisma.playerIdentity.count({ where })
  ]);
  
  return {
    identities,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

module.exports = {
  findById,
  findByName,
  findByUserId,
  search,
  findOrCreate,
  create,
  update,
  linkToUser,
  merge,
  softDelete,
  getUserStats,
  getAll
};
