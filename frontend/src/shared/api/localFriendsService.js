/**
 * @fileoverview Local Friends Management Service
 * Manages friends locally in IndexedDB
 */

import { db } from '../db/database.js';

class LocalFriendsService {
  /**
   * Get all friends
   * @returns {Promise<Array>}
   */
  async getAllFriends() {
    try {
      const friends = await db.friends.toArray();
      return friends.sort((a, b) => a.username.localeCompare(b.username));
    } catch (error) {
      console.error('Error getting friends:', error);
      return [];
    }
  }

  /**
   * Add a friend
   * @param {Object} friend - Friend object with id, username, createdAt, profilePicture
   * @returns {Promise<void>}
   */
  async addFriend(friend) {
    try {
      // Check if friend already exists
      const existing = await db.friends.get(friend.id);
      if (existing) {
        throw new Error('Friend already exists');
      }

      await db.friends.put({
        id: friend.id,
        userId: friend.id, // For indexing
        username: friend.username,
        createdAt: friend.createdAt || new Date().toISOString(),
        profilePicture: friend.profilePicture || null,
        addedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error adding friend:', error);
      throw error;
    }
  }

  /**
   * Remove a friend
   * @param {string} friendId
   * @returns {Promise<void>}
   */
  async removeFriend(friendId) {
    try {
      await db.friends.delete(friendId);
    } catch (error) {
      console.error('Error removing friend:', error);
      throw error;
    }
  }

  /**
   * Get a friend by ID
   * @param {string} friendId
   * @returns {Promise<Object|null>}
   */
  async getFriend(friendId) {
    try {
      return await db.friends.get(friendId);
    } catch (error) {
      console.error('Error getting friend:', error);
      return null;
    }
  }

  /**
   * Check if a user is a friend
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async isFriend(userId) {
    try {
      const friend = await db.friends.get(userId);
      return !!friend;
    } catch (error) {
      console.error('Error checking friend status:', error);
      return false;
    }
  }

  /**
   * Search friends by username
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async searchFriends(query) {
    try {
      const allFriends = await this.getAllFriends();
      if (!query) return allFriends;

      const lowerQuery = query.toLowerCase();
      return allFriends.filter(friend =>
        friend.username.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('Error searching friends:', error);
      return [];
    }
  }

  /**
   * Get friends count
   * @returns {Promise<number>}
   */
  async getFriendsCount() {
    try {
      return await db.friends.count();
    } catch (error) {
      console.error('Error getting friends count:', error);
      return 0;
    }
  }

  /**
   * Clear all friends
   * @returns {Promise<void>}
   */
  async clearAllFriends() {
    try {
      await db.friends.clear();
    } catch (error) {
      console.error('Error clearing friends:', error);
      throw error;
    }
  }
}

export const localFriendsService = new LocalFriendsService();
export default localFriendsService;
