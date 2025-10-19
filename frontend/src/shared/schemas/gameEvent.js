/**
 * @fileoverview Game Event Schema
 * Defines the structure for game mutation events in the event log
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {Object} GameEvent
 * @property {string} id - Unique deterministic UUID for idempotency
 * @property {string} gameId - ID of the game this event belongs to
 * @property {string} actionType - Type of mutation (e.g., 'SCORE_UPDATE', 'ROUND_COMPLETE')
 * @property {Object} payload - Event-specific data
 * @property {number} timestamp - Unix timestamp when event was created
 * @property {number} localVersion - Local version after this event
 * @property {string} userId - ID of the user who triggered this event
 * @property {boolean} acknowledged - Whether server has acknowledged this event
 * @property {number} [serverVersion] - Server version after acknowledgment
 * @property {string} [clientId] - Optional client identifier for multi-device scenarios
 */

/**
 * Available action types for game events
 */
export const GameActionTypes = {
  // Game lifecycle
  GAME_START: 'GAME_START',
  GAME_PAUSE: 'GAME_PAUSE',
  GAME_RESUME: 'GAME_RESUME',
  GAME_END: 'GAME_END',
  
  // Round management
  ROUND_START: 'ROUND_START',
  ROUND_COMPLETE: 'ROUND_COMPLETE',
  
  // Score updates
  SCORE_UPDATE: 'SCORE_UPDATE',
  BATCH_SCORE_UPDATE: 'BATCH_SCORE_UPDATE',
  
  // Player management
  PLAYER_ADD: 'PLAYER_ADD',
  PLAYER_REMOVE: 'PLAYER_REMOVE',
  PLAYER_UPDATE: 'PLAYER_UPDATE',
  
  // Bid management
  BID_PLACED: 'BID_PLACED',
  BID_UPDATE: 'BID_UPDATE',
  
  // Trick management
  TRICK_RECORDED: 'TRICK_RECORDED',
  TRICK_UPDATE: 'TRICK_UPDATE',
  
  // State restoration
  STATE_RESTORE: 'STATE_RESTORE',
  STATE_MERGE: 'STATE_MERGE'
};

/**
 * Creates a new game event
 * @param {Object} params - Event parameters
 * @param {string} params.gameId - Game ID
 * @param {string} params.actionType - Action type from GameActionTypes
 * @param {Object} params.payload - Event payload
 * @param {number} params.localVersion - Local version after this event
 * @param {string} params.userId - User ID
 * @param {string} [params.clientId] - Optional client ID
 * @returns {GameEvent}
 */
export const createGameEvent = ({
  gameId,
  actionType,
  payload,
  localVersion,
  userId,
  clientId = null
}) => {
  // Create deterministic ID based on game, user, timestamp, and random component
  const id = uuidv4();
  
  return {
    id,
    gameId,
    actionType,
    payload: JSON.parse(JSON.stringify(payload)), // Deep clone
    timestamp: Date.now(),
    localVersion,
    userId,
    acknowledged: false,
    clientId
  };
};

/**
 * Validates a game event
 * @param {GameEvent} event - Event to validate
 * @returns {boolean}
 */
export const isValidGameEvent = (event) => {
  return !!(
    event &&
    typeof event.id === 'string' &&
    typeof event.gameId === 'string' &&
    typeof event.actionType === 'string' &&
    event.payload &&
    typeof event.timestamp === 'number' &&
    typeof event.localVersion === 'number' &&
    typeof event.userId === 'string' &&
    typeof event.acknowledged === 'boolean'
  );
};

/**
 * Marks an event as acknowledged by the server
 * @param {GameEvent} event - Event to acknowledge
 * @param {number} serverVersion - Server version after acknowledgment
 * @returns {GameEvent}
 */
export const acknowledgeEvent = (event, serverVersion) => {
  return {
    ...event,
    acknowledged: true,
    serverVersion
  };
};

/**
 * Checks if an event is a critical event that must be synced
 * @param {GameEvent} event
 * @returns {boolean}
 */
export const isCriticalEvent = (event) => {
  const criticalTypes = [
    GameActionTypes.GAME_END,
    GameActionTypes.ROUND_COMPLETE,
    GameActionTypes.SCORE_UPDATE,
    GameActionTypes.BATCH_SCORE_UPDATE
  ];
  
  return criticalTypes.includes(event.actionType);
};
