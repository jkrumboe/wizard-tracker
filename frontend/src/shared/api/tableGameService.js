// Table Game Service - Backend API calls for table games

import { API_ENDPOINTS } from "@/shared/api/config";

/**
 * Create/upload a table game to the backend
 * @param {Object} gameData - The table game data
 * @param {string} localId - The local game ID
 * @returns {Promise<Object>} - The created game data
 */
export async function createTableGame(gameData, localId) {
  const token = localStorage.getItem('auth_token');
  
  // Check if user is authenticated
  if (!token) {
    throw new Error('You must be logged in to sync table games to the cloud. Please sign in and try again.');
  }

  const res = await fetch(API_ENDPOINTS.tableGames.create, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ gameData, localId })
  });
  
  if (res.status === 401) {
    throw new Error('Your session has expired. Please sign in again to sync table games to the cloud.');
  }
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create table game');
  }
  
  const data = await res.json();
  return data;
}

/**
 * Get user's cloud table games list (metadata only)
 * @returns {Promise<Array>} List of cloud table games with metadata
 */
export async function getUserCloudTableGamesList() {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    return [];
  }

  try {
    const res = await fetch(API_ENDPOINTS.tableGames.list, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        return [];
      }
      throw new Error('Failed to fetch cloud table games list');
    }

    const data = await res.json();
    return data.games || [];
  } catch (error) {
    console.error('Error fetching cloud table games list:', error);
    return [];
  }
}

/**
 * Get a specific table game from the backend
 * @param {string} gameId - The game ID
 * @returns {Promise<Object>} - The game data
 */
export async function getTableGameById(gameId) {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('You must be logged in to access cloud table games.');
  }

  const res = await fetch(API_ENDPOINTS.tableGames.getById(gameId), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (res.status === 401) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (res.status === 404) {
    throw new Error('Table game not found (404)');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch table game');
  }

  const data = await res.json();
  return data.game;
}
