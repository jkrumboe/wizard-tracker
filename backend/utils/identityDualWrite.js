/**
 * Identity Dual-Write Service
 * 
 * Wraps PlayerIdentity operations to write to both MongoDB and PostgreSQL
 * during the migration period. This layer sits between the identityService
 * and the database, intercepting writes to mirror them to PostgreSQL.
 */

const { getPrisma, usePostgres } = require('../database');
const PlayerIdentityRepo = require('../repositories/PlayerIdentityRepository');

/**
 * Mirror a MongoDB identity creation to PostgreSQL
 * Non-blocking — failures are logged but don't throw
 * 
 * @param {Object} mongoIdentity - The MongoDB identity document
 * @returns {Promise<Object|null>} The PostgreSQL record or null
 */
async function mirrorIdentityCreate(mongoIdentity) {
  if (!usePostgres()) return null;

  try {
    const prisma = getPrisma();
    const pgIdentity = await PlayerIdentityRepo.create(prisma, {
      displayName: mongoIdentity.displayName,
      userId: mongoIdentity.userId?.toString() || null,
      type: mongoIdentity.type || 'guest',
      createdById: mongoIdentity.createdBy?.toString() || null
    });
    console.log(`[IdentityDualWrite] ✅ Mirrored identity create: ${mongoIdentity.displayName} → PG:${pgIdentity.id}`);
    return pgIdentity;
  } catch (error) {
    console.warn(`[IdentityDualWrite] ⚠️  Failed to mirror identity create (${mongoIdentity.displayName}):`, error.message);
    return null;
  }
}

/**
 * Mirror a MongoDB identity update to PostgreSQL
 * 
 * @param {string} mongoId - MongoDB identity _id (as string)
 * @param {Object} updates - Fields that changed
 * @returns {Promise<Object|null>}
 */
async function mirrorIdentityUpdate(mongoId, updates) {
  if (!usePostgres()) return null;

  try {
    const prisma = getPrisma();

    // Find by normalized name since IDs won't match across DBs
    // We'll search by the _old_ normalized name or the user link
    const pgIdentity = await findPgCounterpart(prisma, mongoId, updates);
    if (!pgIdentity) {
      console.warn(`[IdentityDualWrite] ⚠️  No PG counterpart found for Mongo identity ${mongoId}`);
      return null;
    }

    const pgUpdates = {};
    if (updates.displayName !== undefined) pgUpdates.displayName = updates.displayName;
    if (updates.normalizedName !== undefined) pgUpdates.displayName = pgUpdates.displayName || updates.displayName; // normalizedName computed in repo
    if (updates.type !== undefined) pgUpdates.type = updates.type;
    if (updates.userId !== undefined) pgUpdates.userId = updates.userId?.toString() || null;
    if (updates.isDeleted !== undefined && updates.isDeleted) {
      // Soft delete
      await PlayerIdentityRepo.softDelete(prisma, pgIdentity.id);
      console.log(`[IdentityDualWrite] ✅ Mirrored identity soft-delete: ${pgIdentity.displayName}`);
      return pgIdentity;
    }

    if (Object.keys(pgUpdates).length > 0) {
      const updated = await PlayerIdentityRepo.update(prisma, pgIdentity.id, pgUpdates);
      console.log(`[IdentityDualWrite] ✅ Mirrored identity update: ${pgIdentity.displayName}`);
      return updated;
    }

    return pgIdentity;
  } catch (error) {
    console.warn(`[IdentityDualWrite] ⚠️  Failed to mirror identity update (${mongoId}):`, error.message);
    return null;
  }
}

/**
 * Mirror a MongoDB identity claim (guest → user) to PostgreSQL
 * 
 * @param {Object} mongoIdentity - The claimed identity document
 * @param {string} userId - The user ID claiming it
 * @returns {Promise<Object|null>}
 */
async function mirrorIdentityClaim(mongoIdentity, userId) {
  if (!usePostgres()) return null;

  try {
    const prisma = getPrisma();
    const normalizedName = mongoIdentity.normalizedName || mongoIdentity.displayName.toLowerCase().trim();

    // Find or create the identity in PostgreSQL
    let pgIdentity = await PlayerIdentityRepo.findByName(prisma, normalizedName);

    if (pgIdentity) {
      // Update the existing identity
      pgIdentity = await PlayerIdentityRepo.linkToUser(prisma, pgIdentity.id, userId.toString());
      console.log(`[IdentityDualWrite] ✅ Mirrored identity claim: ${mongoIdentity.displayName} → user ${userId}`);
    } else {
      // Create new claimed identity
      pgIdentity = await PlayerIdentityRepo.create(prisma, {
        displayName: mongoIdentity.displayName,
        userId: userId.toString(),
        type: 'user',
        createdById: userId.toString()
      });
      console.log(`[IdentityDualWrite] ✅ Mirrored identity create+claim: ${mongoIdentity.displayName}`);
    }

    return pgIdentity;
  } catch (error) {
    console.warn(`[IdentityDualWrite] ⚠️  Failed to mirror identity claim (${mongoIdentity.displayName}):`, error.message);
    return null;
  }
}

/**
 * Mirror a MongoDB identity merge to PostgreSQL
 * 
 * @param {string} sourceMongoId - Source identity _id being merged
 * @param {string} targetMongoId - Target identity _id merged into
 * @param {Object} sourceIdentity - Source MongoDB identity doc (for lookup)
 * @param {Object} targetIdentity - Target MongoDB identity doc (for lookup) 
 * @returns {Promise<Object|null>}
 */
async function mirrorIdentityMerge(sourceMongoId, targetMongoId, sourceIdentity, targetIdentity) {
  if (!usePostgres()) return null;

  try {
    const prisma = getPrisma();

    const pgSource = await PlayerIdentityRepo.findByName(prisma, sourceIdentity.normalizedName || sourceIdentity.displayName.toLowerCase());
    const pgTarget = await PlayerIdentityRepo.findByName(prisma, targetIdentity.normalizedName || targetIdentity.displayName.toLowerCase());

    if (pgSource && pgTarget) {
      await PlayerIdentityRepo.merge(prisma, pgSource.id, pgTarget.id);
      console.log(`[IdentityDualWrite] ✅ Mirrored identity merge: ${sourceIdentity.displayName} → ${targetIdentity.displayName}`);
      return pgTarget;
    } else {
      console.warn(`[IdentityDualWrite] ⚠️  Merge skipped — missing PG counterparts (source: ${!!pgSource}, target: ${!!pgTarget})`);
      return null;
    }
  } catch (error) {
    console.warn(`[IdentityDualWrite] ⚠️  Failed to mirror identity merge:`, error.message);
    return null;
  }
}

/**
 * Find the PostgreSQL counterpart of a MongoDB identity
 * Uses normalizedName for matching since IDs differ across databases
 * 
 * @param {PrismaClient} prisma
 * @param {string} mongoId - MongoDB _id
 * @param {Object} context - Additional context (may contain displayName, userId, etc.)
 * @returns {Promise<Object|null>}
 */
async function findPgCounterpart(prisma, mongoId, context = {}) {
  // Try by userId first (most reliable for user-type identities)
  if (context.userId) {
    const byUserId = await prisma.playerIdentity.findFirst({
      where: { userId: context.userId.toString(), isDeleted: false }
    });
    if (byUserId) return byUserId;
  }

  // Try by normalized name
  if (context.normalizedName || context.displayName) {
    const name = context.normalizedName || context.displayName.toLowerCase().trim();
    return await PlayerIdentityRepo.findByName(prisma, name);
  }

  return null;
}

/**
 * Create an identity from a MongoDB document (for backfill)
 * 
 * @param {PrismaClient} prisma
 * @param {Object} mongoIdentity - MongoDB identity document
 * @returns {Promise<Object>}
 */
async function createFromMongo(prisma, mongoIdentity) {
  return await prisma.playerIdentity.create({
    data: {
      id: mongoIdentity._id.toString(),
      displayName: mongoIdentity.displayName,
      normalizedName: mongoIdentity.normalizedName || mongoIdentity.displayName.toLowerCase().trim(),
      userId: mongoIdentity.userId?.toString() || null,
      type: mongoIdentity.type || 'guest',
      eloData: mongoIdentity.eloByGameType
        ? (mongoIdentity.eloByGameType instanceof Map
            ? Object.fromEntries(mongoIdentity.eloByGameType)
            : mongoIdentity.eloByGameType)
        : {},
      totalGames: mongoIdentity.stats?.totalGames || 0,
      totalWins: mongoIdentity.stats?.totalWins || 0,
      lastGameAt: mongoIdentity.stats?.lastGameAt || null,
      nameHistory: mongoIdentity.nameHistory || [],
      aliases: mongoIdentity.aliases || [],
      linkedIdentities: mongoIdentity.linkedIdentities || [],
      mergedIntoId: mongoIdentity.mergedInto?.toString() || null,
      createdById: mongoIdentity.createdBy?.toString() || null,
      isDeleted: mongoIdentity.isDeleted || false,
      deletedAt: mongoIdentity.deletedAt || null,
      createdAt: mongoIdentity.createdAt,
      updatedAt: mongoIdentity.updatedAt || new Date()
    }
  });
}

module.exports = {
  mirrorIdentityCreate,
  mirrorIdentityUpdate,
  mirrorIdentityClaim,
  mirrorIdentityMerge,
  findPgCounterpart,
  createFromMongo
};
