import { useEffect, useMemo, useState } from 'react';
import { db } from '@/shared/db/database.js';
import { avatarService } from '@/shared/api/avatarService';
import { useUser } from '@/shared/hooks/useUser';
import defaultAvatar from '@/assets/default-avatar.png';

/**
 * Resolves profile pictures for the players of a game.
 *
 * Works offline: pictures come from the signed-in user's cached avatar and the
 * friends stored in IndexedDB. Players without a known picture are left out of
 * the map, so callers can fall back to initials.
 *
 * @param {Array<{id?: string, userId?: string}>} players
 * @returns {Record<string, string>} map of player id / user id -> image url
 */
export function usePlayerAvatars(players) {
  const { user } = useUser();
  const [avatars, setAvatars] = useState({});

  // Only re-resolve when the set of linked accounts changes, not on every score edit
  const idsKey = useMemo(() => {
    const ids = new Set();
    (players || []).forEach((p) => {
      if (p?.userId) ids.add(String(p.userId));
      if (p?.id) ids.add(String(p.id));
    });
    return [...ids].sort().join('|');
  }, [players]);

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split('|') : [];
    if (ids.length === 0) {
      setAvatars({});
      return undefined;
    }

    const resolve = async () => {
      const next = {};

      try {
        const friends = await db.friends.bulkGet(ids);
        friends.forEach((friend) => {
          if (friend?.profilePicture) next[friend.id] = friend.profilePicture;
        });
      } catch (error) {
        console.warn('Could not load friend avatars:', error);
      }

      if (user?.id && ids.includes(String(user.id))) {
        try {
          const url = await avatarService.getAvatarUrl(true);
          if (url && url !== defaultAvatar) next[user.id] = url;
        } catch (error) {
          console.warn('Could not load own avatar:', error);
        }
      }

      if (!cancelled) setAvatars(next);
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [idsKey, user?.id]);

  return avatars;
}

/**
 * Looks up a player's picture in the map returned by usePlayerAvatars.
 * @param {Record<string, string>} avatars
 * @param {{id?: string, userId?: string}} player
 * @returns {string|null}
 */
export function getPlayerAvatar(avatars, player) {
  if (!player) return null;
  return (player.userId && avatars[player.userId]) || (player.id && avatars[player.id]) || null;
}
