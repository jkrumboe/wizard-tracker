/**
 * User Repository
 * Data access layer for User operations using Prisma
 */

/**
 * Find user by username
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} username - Username to search for
 * @returns {Promise<User|null>}
 */
async function findByUsername(prisma, username) {
  return await prisma.user.findUnique({
    where: { username },
    include: {
      playerIdentities: true,
      friends: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      }
    }
  });
}

/**
 * Find user by ID
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} id - User ID
 * @returns {Promise<User|null>}
 */
async function findById(prisma, id) {
  return await prisma.user.findUnique({
    where: { id },
    include: {
      playerIdentities: true,
      friends: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      }
    }
  });
}

/**
 * Create a new user
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {Object} data - User data
 * @returns {Promise<User>}
 */
async function create(prisma, data) {
  const { username, passwordHash, role = 'user', guestMetadata } = data;
  
  return await prisma.user.create({
    data: {
      username,
      passwordHash,
      role,
      guestCreatedBy: guestMetadata?.createdByUserId,
      originalGuestId: guestMetadata?.originalGuestId
    }
  });
}

/**
 * Update user by ID
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} id - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<User>}
 */
async function update(prisma, id, updates) {
  const data = {};
  
  if (updates.passwordHash !== undefined) data.passwordHash = updates.passwordHash;
  if (updates.profilePicture !== undefined) data.profilePicture = updates.profilePicture;
  if (updates.lastLogin !== undefined) data.lastLogin = updates.lastLogin;
  if (updates.role !== undefined) data.role = updates.role;
  
  return await prisma.user.update({
    where: { id },
    data
  });
}

/**
 * Add friend to user
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} userId - User ID
 * @param {string} friendId - Friend user ID
 * @returns {Promise<User>}
 */
async function addFriend(prisma, userId, friendId) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      friends: {
        connect: { id: friendId }
      }
    },
    include: {
      friends: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      }
    }
  });
}

/**
 * Remove friend from user
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} userId - User ID
 * @param {string} friendId - Friend user ID
 * @returns {Promise<User>}
 */
async function removeFriend(prisma, userId, friendId) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      friends: {
        disconnect: { id: friendId }
      }
    },
    include: {
      friends: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      }
    }
  });
}

/**
 * Search users by username pattern
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} searchTerm - Search term
 * @param {Object} options - Search options
 * @returns {Promise<User[]>}
 */
async function searchByUsername(prisma, searchTerm, options = {}) {
  const { limit = 20, excludeIds = [] } = options;
  
  return await prisma.user.findMany({
    where: {
      username: {
        contains: searchTerm,
        mode: 'insensitive'
      },
      id: {
        notIn: excludeIds
      }
    },
    select: {
      id: true,
      username: true,
      profilePicture: true,
      createdAt: true,
      role: true
    },
    take: limit,
    orderBy: {
      username: 'asc'
    }
  });
}

/**
 * Count total users
 * @param {PrismaClient} prisma - Prisma client instance
 * @returns {Promise<number>}
 */
async function count(prisma) {
  return await prisma.user.count();
}

/**
 * Check if username exists
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} username - Username to check
 * @returns {Promise<boolean>}
 */
async function usernameExists(prisma, username) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true }
  });
  return !!user;
}

/**
 * Find user by username (case-insensitive)
 * Used for registration validation
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} username - Username to search for
 * @returns {Promise<User|null>}
 */
async function findByCaseInsensitiveUsername(prisma, username) {
  const users = await prisma.user.findMany({
    where: {
      username: {
        equals: username,
        mode: 'insensitive'
      }
    },
    take: 1
  });
  return users.length > 0 ? users[0] : null;
}

/**
 * Delete user by ID
 * Used for rollback operations
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} id - User ID
 * @returns {Promise<User>}
 */
async function deleteById(prisma, id) {
  return await prisma.user.delete({
    where: { id }
  });
}

/**
 * Create user from MongoDB document
 * Helper for data migration
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {Object} mongoUser - MongoDB user document
 * @returns {Promise<User>}
 */
async function createFromMongo(prisma, mongoUser) {
  return await prisma.user.create({
    data: {
      id: mongoUser._id.toString(),
      username: mongoUser.username,
      passwordHash: mongoUser.passwordHash,
      role: mongoUser.role || 'user',
      lastLogin: mongoUser.lastLogin,
      profilePicture: mongoUser.profilePicture,
      guestCreatedBy: mongoUser.guestCreatedBy?.toString(),
      originalGuestId: mongoUser.originalGuestId,
      createdAt: mongoUser.createdAt,
      updatedAt: mongoUser.updatedAt
    }
  });
}

module.exports = {
  findByUsername,
  findById,
  create,
  update,
  addFriend,
  removeFriend,
  searchByUsername,
  count,
  usernameExists,
  findByCaseInsensitiveUsername,
  deleteById,
  createFromMongo
};
