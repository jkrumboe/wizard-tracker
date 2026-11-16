const PlayerIdentity = require('../models/PlayerIdentity');

/**
 * Identity ids that belong to a user: their own identity, identities linked to
 * it, and guest identities merged into it.
 * @param {ObjectId|string} userId
 * @returns {Promise<Set<string>>}
 */
async function getUserIdentityIdSet(userId) {
  const ids = new Set();
  const userIdentity = await PlayerIdentity.findOne({
    userId: { $eq: userId },
    isDeleted: false
  });

  if (!userIdentity) return ids;

  ids.add(userIdentity._id.toString());
  (userIdentity.linkedIdentities || []).forEach((linked) => {
    if (linked?.identityId) ids.add(linked.identityId.toString());
  });

  const mergedIdentities = await PlayerIdentity.find({
    mergedInto: userIdentity._id,
    isDeleted: false
  }).select('_id');
  mergedIdentities.forEach((merged) => ids.add(merged._id.toString()));

  return ids;
}

/**
 * Whether a user played in a table game: matched by identity, by player id,
 * or (legacy games) by player name equal to the username.
 */
async function isTableGameParticipant(tableGame, user) {
  if (!user?._id) return false;

  const gameData = tableGame.gameData?.gameData || tableGame.gameData;
  const players = Array.isArray(gameData?.players) ? gameData.players : [];
  if (players.length === 0) return false;

  const identityIds = await getUserIdentityIdSet(user._id);
  const userIdString = user._id.toString();
  const usernameLower = user.username?.toLowerCase();

  return players.some((player) => {
    if (!player) return false;
    if (player.identityId && identityIds.has(player.identityId.toString())) return true;
    if (player.id && player.id === userIdString) return true;
    if (usernameLower && typeof player.name === 'string' && player.name.toLowerCase() === usernameLower) return true;
    return false;
  });
}

/**
 * What a user may do with a table game.
 * @param {Object} tableGame
 * @param {Object|null} user - req.user (may be undefined for anonymous requests)
 * @returns {Promise<{isOwner: boolean, isAdmin: boolean, isParticipant: boolean}>}
 */
async function getTableGameAccess(tableGame, user) {
  if (!user?._id) {
    return { isOwner: false, isAdmin: false, isParticipant: false };
  }

  const isOwner = Boolean(tableGame.userId) && tableGame.userId.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';
  const isParticipant = isOwner ? true : await isTableGameParticipant(tableGame, user);

  return { isOwner, isAdmin, isParticipant };
}

module.exports = {
  getUserIdentityIdSet,
  isTableGameParticipant,
  getTableGameAccess,
};
