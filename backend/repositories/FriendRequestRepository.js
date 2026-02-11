/**
 * FriendRequest Repository
 * Data access layer for FriendRequest operations using Prisma
 */

/**
 * Find friend request by ID
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} id - Friend request ID
 * @returns {Promise<FriendRequest|null>}
 */
async function findById(prisma, id) {
  return await prisma.friendRequest.findUnique({
    where: { id },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      },
      receiver: {
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
 * Find existing request between two users
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} senderId - Sender user ID
 * @param {string} receiverId - Receiver user ID
 * @returns {Promise<FriendRequest|null>}
 */
async function findBetweenUsers(prisma, senderId, receiverId) {
  return await prisma.friendRequest.findUnique({
    where: {
      senderId_receiverId: {
        senderId,
        receiverId
      }
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      },
      receiver: {
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
 * Create a friend request
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} senderId - Sender user ID
 * @param {string} receiverId - Receiver user ID
 * @returns {Promise<FriendRequest>}
 */
async function create(prisma, senderId, receiverId) {
  return await prisma.friendRequest.create({
    data: {
      senderId,
      receiverId,
      status: 'pending'
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      },
      receiver: {
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
 * Update friend request status
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} id - Friend request ID
 * @param {string} status - New status ('accepted', 'rejected')
 * @returns {Promise<FriendRequest>}
 */
async function updateStatus(prisma, id, status) {
  return await prisma.friendRequest.update({
    where: { id },
    data: { status },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      },
      receiver: {
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
 * Delete friend request
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} id - Friend request ID
 * @returns {Promise<FriendRequest>}
 */
async function deleteRequest(prisma, id) {
  return await prisma.friendRequest.delete({
    where: { id }
  });
}

/**
 * Get pending requests received by user
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} userId - User ID
 * @returns {Promise<FriendRequest[]>}
 */
async function getPendingReceived(prisma, userId) {
  return await prisma.friendRequest.findMany({
    where: {
      receiverId: userId,
      status: 'pending'
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      },
      receiver: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}

/**
 * Get pending requests sent by user
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} userId - User ID
 * @returns {Promise<FriendRequest[]>}
 */
async function getPendingSent(prisma, userId) {
  return await prisma.friendRequest.findMany({
    where: {
      senderId: userId,
      status: 'pending'
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      },
      receiver: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}

/**
 * Get all friend requests for user (sent and received)
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} userId - User ID
 * @param {string} status - Optional status filter
 * @returns {Promise<Object>}
 */
async function getAllForUser(prisma, userId, status = null) {
  const where = {
    OR: [
      { senderId: userId },
      { receiverId: userId }
    ]
  };
  
  if (status) {
    where.status = status;
  }
  
  const requests = await prisma.friendRequest.findMany({
    where,
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      },
      receiver: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  // Separate into sent and received
  const sent = requests.filter(req => req.senderId === userId);
  const received = requests.filter(req => req.receiverId === userId);
  
  return { sent, received, all: requests };
}

/**
 * Count pending requests for user
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} userId - User ID
 * @returns {Promise<number>}
 */
async function countPendingReceived(prisma, userId) {
  return await prisma.friendRequest.count({
    where: {
      receiverId: userId,
      status: 'pending'
    }
  });
}

/**
 * Check if request exists between users (in either direction)
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<FriendRequest|null>}
 */
async function findAnyBetweenUsers(prisma, userId1, userId2) {
  return await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 }
      ]
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
          createdAt: true
        }
      },
      receiver: {
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

module.exports = {
  findById,
  findBetweenUsers,
  create,
  updateStatus,
  deleteRequest,
  getPendingReceived,
  getPendingSent,
  getAllForUser,
  countPendingReceived,
  findAnyBetweenUsers
};
