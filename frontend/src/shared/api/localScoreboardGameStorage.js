/**
 * Local Scoreboard Game Storage Service
 * Dedicated storage for two-side scoreboard games.
 */

import { generateSecureId } from '../utils/secureRandom.js';

const LOCAL_SCOREBOARD_GAMES_STORAGE_KEY = 'wizardTracker_scoreboardGames';

function isSafeKey(key) {
  return typeof key === 'string'
    && key !== '__proto__'
    && key !== 'constructor'
    && key !== 'prototype'
    && !key.startsWith('__');
}

export class LocalScoreboardGameStorage {
  static getCurrentUserId() {
    return localStorage.getItem('wizardTracker_currentUserId');
  }

  static generateGameId() {
    return generateSecureId('scoreboard_game');
  }

  static getAllSavedTableGamesAllUsers() {
    try {
      const stored = localStorage.getItem(LOCAL_SCOREBOARD_GAMES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error loading saved scoreboard games:', error);
      return {};
    }
  }

  static getAllSavedTableGames(userId = null) {
    try {
      const allGames = this.getAllSavedTableGamesAllUsers();
      const currentUserId = userId || this.getCurrentUserId();

      if (!currentUserId) {
        return allGames;
      }

      const userGames = {};
      for (const gameId of Object.keys(allGames)) {
        const game = allGames[gameId];
        if (!game.userId || game.userId === currentUserId) {
          userGames[gameId] = game;
        }
      }

      return userGames;
    } catch (error) {
      console.error('Error filtering saved scoreboard games:', error);
      return {};
    }
  }

  static saveTableGame(gameData, gameName = null, userId = null) {
    const gameId = this.generateGameId();
    const timestamp = new Date().toISOString();
    const currentUserId = userId || this.getCurrentUserId();

    try {
      const existingData = this.getAllSavedTableGamesAllUsers();
      existingData[gameId] = {
        id: gameId,
        name: gameData.gameName || gameName || `Scoreboard Game - ${new Date().toLocaleDateString()}`,
        gameTypeName: gameData.gameName || gameName || 'Scoreboard Game',
        gameData,
        savedAt: timestamp,
        lastPlayed: timestamp,
        playerCount: gameData.teamMembers
          ? (gameData.teamMembers[0]?.length || 0) + (gameData.teamMembers[1]?.length || 0)
          : (gameData.players ? gameData.players.length : 0),
        totalRounds: gameData.rows || 0,
        gameType: 'scoreboard',
        gameFinished: !!gameData.gameFinished,
        userId: currentUserId,
        targetNumber: gameData.targetNumber || null,
        lowIsBetter: !!gameData.lowIsBetter,
        isUploaded: false,
        cloudGameId: null,
        cloudLookupKey: null,
      };

      localStorage.setItem(LOCAL_SCOREBOARD_GAMES_STORAGE_KEY, JSON.stringify(existingData));
      return gameId;
    } catch (error) {
      console.error('Error saving scoreboard game:', error);
      throw error;
    }
  }

  static loadTableGame(gameId) {
    if (!isSafeKey(gameId)) {
      console.error('Invalid scoreboard game ID');
      return null;
    }

    const games = this.getAllSavedTableGamesAllUsers();
    const savedGame = games[gameId];
    if (!savedGame) {
      return null;
    }

    savedGame.lastPlayed = new Date().toISOString();
    games[gameId] = savedGame;
    localStorage.setItem(LOCAL_SCOREBOARD_GAMES_STORAGE_KEY, JSON.stringify(games));
    return savedGame.gameData;
  }

  static getTableGameById(gameId) {
    const games = this.getAllSavedTableGames();
    return games[gameId] || null;
  }

  static tableGameExists(gameId) {
    const games = this.getAllSavedTableGamesAllUsers();
    return Object.prototype.hasOwnProperty.call(games, gameId);
  }

  static updateTableGame(gameId, updates) {
    if (!isSafeKey(gameId)) {
      console.error('Invalid scoreboard game ID');
      return;
    }

    const games = this.getAllSavedTableGamesAllUsers();
    if (games[gameId]) {
      games[gameId] = { ...games[gameId], ...updates };
      localStorage.setItem(LOCAL_SCOREBOARD_GAMES_STORAGE_KEY, JSON.stringify(games));
    }
  }

  static deleteTableGame(gameId) {
    if (!isSafeKey(gameId)) {
      console.error('Invalid scoreboard game ID');
      return;
    }

    const games = this.getAllSavedTableGamesAllUsers();
    delete games[gameId];
    localStorage.setItem(LOCAL_SCOREBOARD_GAMES_STORAGE_KEY, JSON.stringify(games));
  }

  static getSavedTableGamesList(userId = null) {
    try {
      const games = this.getAllSavedTableGames(userId);
      const gamesList = Object.values(games)
        .filter((game) => game && game.id)
        .map((game) => ({
          id: game.id,
          name: game.name || `Scoreboard Game from ${new Date(game.savedAt).toLocaleDateString()}`,
          gameTypeName: game.gameTypeName || game.name || 'Scoreboard Game',
          savedAt: game.savedAt || new Date().toISOString(),
          lastPlayed: game.lastPlayed || new Date().toISOString(),
          playerCount: game.playerCount || 0,
          totalRounds: game.totalRounds || 0,
          gameType: 'scoreboard',
          gameFinished: !!game.gameFinished,
          userId: game.userId,
          lowIsBetter: game.lowIsBetter || game.gameData?.lowIsBetter || false,
          winner_id: game.winner_id || game.gameData?.winner_id,
          winner_name: game.winner_name || game.gameData?.winner_name,
          scoreEntryMode: game.gameData?.scoreEntryMode || 'twoSideGesture',
          gameData: game.gameData,
          players: Array.isArray(game.gameData?.teamMembers)
            ? [
                ...(game.gameData.teamMembers[0] || []).map((p) => p.name),
                ...(game.gameData.teamMembers[1] || []).map((p) => p.name),
              ]
            : (game.gameData?.players || []).map((p) => p.name),
        }));

      gamesList.sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
      return gamesList;
    } catch (error) {
      console.error('Error getting saved scoreboard games list:', error);
      return [];
    }
  }

  static isGameUploaded(gameId) {
    const game = this.getTableGameById(gameId);
    return !!(game && game.isUploaded && game.cloudGameId);
  }

  static markGameAsUploaded(gameId, cloudGameId) {
    const games = this.getAllSavedTableGamesAllUsers();
    if (!games[gameId]) return;

    games[gameId] = {
      ...games[gameId],
      isUploaded: true,
      cloudGameId,
      cloudLookupKey: cloudGameId,
    };
    localStorage.setItem(LOCAL_SCOREBOARD_GAMES_STORAGE_KEY, JSON.stringify(games));
  }
}
