/**
 * Security validation utilities for shared game links
 * Prevents malicious data injection and ensures data integrity
 */

export class ShareValidator {
  // Maximum allowed sizes to prevent memory exhaustion
  static MAX_DECODED_SIZE = 1024 * 1024; // 1MB
  static MAX_PLAYER_NAME_LENGTH = 50;
  static MAX_GAME_NAME_LENGTH = 100;
  static MAX_PLAYERS = 20;
  static MAX_ROUNDS = 1000;
  static MAX_SCORE = 1000000;

  // Valid game modes
  static VALID_GAME_MODES = ['Local', 'Online', 'Tournament'];

  /**
   * Validates and sanitizes base64 encoded game data
   * @param {string} encodedData - Base64 encoded game data
   * @returns {Object} - { isValid: boolean, data?: Object, error?: string }
   */
  static validateEncodedGameData(encodedData) {
    try {
      // Basic base64 validation
      if (!this.isValidBase64(encodedData)) {
        return { isValid: false, error: 'Invalid data format' };
      }

      // Check size before decoding to prevent memory exhaustion
      const estimatedSize = (encodedData.length * 3) / 4;
      if (estimatedSize > this.MAX_DECODED_SIZE) {
        return { isValid: false, error: 'Data too large' };
      }

      // Decode the data
      let decodedData;
      try {
        decodedData = decodeURIComponent(escape(atob(encodedData)));
      } catch (decodeError) {
        console.warn('Decode error:', decodeError.message);
        return { isValid: false, error: 'Invalid encoding format' };
      }

      // Parse JSON
      let gameData;
      try {
        gameData = JSON.parse(decodedData);
      } catch (parseError) {
        console.warn('Parse error:', parseError.message);
        return { isValid: false, error: 'Invalid JSON format' };
      }

      // Validate the game data structure
      const structureValidation = this.validateGameDataStructure(gameData);
      if (!structureValidation.isValid) {
        return structureValidation;
      }

      // Sanitize the data
      const sanitizedData = this.sanitizeGameData(gameData);

      return { isValid: true, data: sanitizedData };
    } catch (error) {
      console.error('Validation error:', error);
      return { isValid: false, error: 'Validation failed' };
    }
  }

  /**
   * Validates multiple games data from bulk import
   * @param {string} encodedData - Base64 encoded games data
   * @returns {Object} - { isValid: boolean, data?: Object, error?: string }
   */
  static validateEncodedGamesData(encodedData) {
    try {
      // Basic validation
      if (!this.isValidBase64(encodedData)) {
        return { isValid: false, error: 'Invalid data format' };
      }

      const estimatedSize = (encodedData.length * 3) / 4;
      if (estimatedSize > this.MAX_DECODED_SIZE) {
        return { isValid: false, error: 'Data too large' };
      }

      // Decode
      let decodedData;
      try {
        decodedData = atob(encodedData);
      } catch (decodeError) {
        console.warn('Decode error:', decodeError.message);
        return { isValid: false, error: 'Invalid encoding format' };
      }

      // Parse JSON
      let gamesData;
      try {
        gamesData = JSON.parse(decodedData);
      } catch (parseError) {
        console.warn('Parse error:', parseError.message);
        return { isValid: false, error: 'Invalid JSON format' };
      }

      // Validate that it's an object
      if (typeof gamesData !== 'object' || gamesData === null || Array.isArray(gamesData)) {
        return { isValid: false, error: 'Invalid games data structure' };
      }

      // Validate each game
      const sanitizedGames = {};
      const gameIds = Object.keys(gamesData);

      if (gameIds.length === 0) {
        return { isValid: false, error: 'No games found' };
      }

      if (gameIds.length > 100) { // Reasonable limit
        return { isValid: false, error: 'Too many games' };
      }

      for (const gameId of gameIds) {
        const game = gamesData[gameId];
        const validation = this.validateGameObjectStructure(game);
        if (!validation.isValid) {
          return { isValid: false, error: `Invalid game data: ${validation.error}` };
        }
        sanitizedGames[gameId] = this.sanitizeGameObject(game);
      }

      return { isValid: true, data: sanitizedGames };
    } catch (error) {
      console.error('Games validation error:', error);
      return { isValid: false, error: 'Validation failed' };
    }
  }

  /**
   * Validates single game data structure
   * @param {Object} gameData - Game data object
   * @returns {Object} - { isValid: boolean, error?: string }
   */
  static validateGameDataStructure(gameData) {
    if (typeof gameData !== 'object' || gameData === null) {
      return { isValid: false, error: 'Invalid data type' };
    }

    // Required fields for compact game data
    const requiredFields = ['id', 'players', 'total_rounds'];
    for (const field of requiredFields) {
      if (!(field in gameData)) {
        return { isValid: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate players array
    if (!Array.isArray(gameData.players)) {
      return { isValid: false, error: 'Players must be an array' };
    }

    if (gameData.players.length === 0 || gameData.players.length > this.MAX_PLAYERS) {
      return { isValid: false, error: 'Invalid number of players' };
    }

    // Validate each player
    for (let i = 0; i < gameData.players.length; i++) {
      const player = gameData.players[i];
      if (typeof player !== 'object' || !player.id || !player.name) {
        return { isValid: false, error: `Invalid player data at index ${i}` };
      }
    }

    // Validate total_rounds (must be a number, non-negative, and not exceed MAX_ROUNDS)
    if (
      typeof gameData.total_rounds !== 'number' ||
      gameData.total_rounds < 0 ||
      gameData.total_rounds > this.MAX_ROUNDS
    ) {
      return { isValid: false, error: `Invalid total rounds (must be between 0 and ${this.MAX_ROUNDS})` };
    }

    // Validate round_data if present
    if (gameData.round_data && !Array.isArray(gameData.round_data)) {
      return { isValid: false, error: 'Round data must be an array' };
    }

    // Validate game_mode if present
    if (gameData.game_mode && !this.VALID_GAME_MODES.includes(gameData.game_mode)) {
      return { isValid: false, error: 'Invalid game mode' };
    }

    return { isValid: true };
  }

  /**
   * Validates full game object structure (for bulk imports)
   * @param {Object} game - Game object
   * @returns {Object} - { isValid: boolean, error?: string }
   */
  static validateGameObjectStructure(game) {
    if (typeof game !== 'object' || game === null) {
      return { isValid: false, error: 'Invalid game object' };
    }

    // Basic required fields
    if (!game.id || !game.gameState) {
      return { isValid: false, error: 'Missing required game fields' };
    }

    // Validate gameState
    const gameStateValidation = this.validateGameDataStructure(game.gameState);
    if (!gameStateValidation.isValid) {
      return { isValid: false, error: `GameState validation: ${gameStateValidation.error}` };
    }

    return { isValid: true };
  }

  /**
   * Sanitizes game data to prevent XSS and injection attacks
   * @param {Object} gameData - Game data to sanitize
   * @returns {Object} - Sanitized game data
   */
  static sanitizeGameData(gameData) {
    const sanitized = { ...gameData };

    // Sanitize string fields
    if (sanitized.id) {
      sanitized.id = this.sanitizeString(sanitized.id, 50);
    }

    if (sanitized.game_mode) {
      sanitized.game_mode = this.sanitizeString(sanitized.game_mode, 20);
    }

    // Sanitize players
    if (sanitized.players) {
      sanitized.players = sanitized.players.map(player => ({
        ...player,
        id: this.sanitizeString(player.id, 50),
        name: this.sanitizeString(player.name, this.MAX_PLAYER_NAME_LENGTH),
        // Remove any unexpected fields
        ...(player.avatar && { avatar: this.sanitizeString(player.avatar, 200) })
      }));
    }

    // Sanitize round data
    if (sanitized.round_data) {
      sanitized.round_data = sanitized.round_data.map(round => {
        const sanitizedRound = {};
        Object.keys(round).forEach(key => {
          if (typeof round[key] === 'number') {
            // Clamp scores to reasonable values
            sanitizedRound[key] = Math.max(-this.MAX_SCORE, Math.min(this.MAX_SCORE, round[key]));
          } else if (typeof round[key] === 'string') {
            sanitizedRound[key] = this.sanitizeString(round[key], 100);
          }
        });
        return sanitizedRound;
      });
    }

    // Sanitize scores
    if (sanitized.final_scores) {
      const sanitizedScores = {};
      Object.keys(sanitized.final_scores).forEach(playerId => {
        const score = sanitized.final_scores[playerId];
        if (typeof score === 'number') {
          sanitizedScores[this.sanitizeString(playerId, 50)] = 
            Math.max(-this.MAX_SCORE, Math.min(this.MAX_SCORE, score));
        }
      });
      sanitized.final_scores = sanitizedScores;
    }

    // Ensure numeric fields are valid
    if (sanitized.total_rounds) {
      sanitized.total_rounds = Math.max(0, Math.min(this.MAX_ROUNDS, sanitized.total_rounds));
    }

    if (sanitized.duration_seconds) {
      sanitized.duration_seconds = Math.max(0, Math.min(86400, sanitized.duration_seconds)); // Max 24 hours
    }

    return sanitized;
  }

  /**
   * Sanitizes full game object
   * @param {Object} game - Game object to sanitize
   * @returns {Object} - Sanitized game object
   */
  static sanitizeGameObject(game) {
    const sanitized = { ...game };

    // Sanitize top-level fields
    if (sanitized.name) {
      sanitized.name = this.sanitizeString(sanitized.name, this.MAX_GAME_NAME_LENGTH);
    }

    if (sanitized.id) {
      sanitized.id = this.sanitizeString(sanitized.id, 50);
    }

    // Sanitize gameState
    if (sanitized.gameState) {
      sanitized.gameState = this.sanitizeGameData(sanitized.gameState);
    }

    // Remove potentially dangerous fields
    delete sanitized.constructor;
    delete sanitized.__proto__;
    delete sanitized.prototype;

    return sanitized;
  }

  /**
   * Sanitizes a string to prevent XSS
   * @param {string} str - String to sanitize
   * @param {number} maxLength - Maximum allowed length
   * @returns {string} - Sanitized string
   */
  static sanitizeString(str, maxLength = 100) {
    if (typeof str !== 'string') {
      return '';
    }

    // Remove HTML tags and script content
    let cleaned = str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags and content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/data:/gi, '') // Remove data: URLs
      .replace(/alert\s*\(/gi, '') // Remove alert calls
      .replace(/eval\s*\(/gi, '') // Remove eval calls
      .replace(/document\./gi, '') // Remove document references
      .replace(/window\./gi, '') // Remove window references
      .trim();

    // HTML entity decode and re-encode to prevent encoded attacks
    cleaned = cleaned
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&amp;/g, '&');

    // Remove any remaining dangerous patterns after decoding
    cleaned = cleaned
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/alert\s*\(/gi, '')
      .replace(/eval\s*\(/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    // Truncate to max length
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) : cleaned;
  }

  /**
   * Validates if a string is valid base64
   * @param {string} str - String to validate
   * @returns {boolean} - Whether the string is valid base64
   */
  static isValidBase64(str) {
    if (typeof str !== 'string' || str.length === 0) {
      return false;
    }

    // Check for valid base64 characters and proper padding
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(str) && str.length % 4 === 0;
  }

  /**
   * Validates share key format
   * @param {string} shareKey - Share key to validate
   * @returns {boolean} - Whether the share key is valid
   */
  static isValidShareKey(shareKey) {
    if (typeof shareKey !== 'string') {
      return false;
    }

    // Share keys should match the format: share_timestamp_randomstring
    const shareKeyRegex = /^share_\d{13}_[a-z0-9]{9}$/;
    return shareKeyRegex.test(shareKey);
  }
}
