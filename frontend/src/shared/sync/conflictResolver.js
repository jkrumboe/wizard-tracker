/**
 * @fileoverview Conflict Resolver
 * Handles conflict resolution when local and server state diverge
 */

/**
 * Conflict resolution strategies
 */
export const ConflictStrategy = {
  SERVER_WINS: 'server_wins',
  CLIENT_WINS: 'client_wins',
  MERGED: 'merged',
  MANUAL: 'manual'
};

/**
 * Resolve conflict between local and server state
 * @param {Object} params
 * @param {Object} params.localSnapshot - Local game snapshot
 * @param {Array} params.localEvents - Pending local events
 * @param {Object} params.serverSnapshot - Server game snapshot
 * @param {number} params.serverVersion - Server version number
 * @returns {Promise<Object>} Resolution result
 */
export async function resolveConflict({
  localSnapshot,
  localEvents,
  serverSnapshot,
  serverVersion
}) {
  // If no local changes, server wins
  if (!localEvents || localEvents.length === 0) {
    return {
      strategy: ConflictStrategy.SERVER_WINS,
      reason: 'No local changes to preserve'
    };
  }
  
  // If local and server states are identical, just update version
  if (areStatesEqual(localSnapshot.gameState, serverSnapshot)) {
    return {
      strategy: ConflictStrategy.SERVER_WINS,
      reason: 'States are identical'
    };
  }
  
  // Try automatic merge
  const mergeResult = await attemptAutomaticMerge({
    localSnapshot,
    localEvents,
    serverSnapshot,
    serverVersion
  });
  
  if (mergeResult.success) {
    return {
      strategy: ConflictStrategy.MERGED,
      mergedState: mergeResult.mergedState,
      conflicts: mergeResult.conflicts,
      reason: 'Successfully merged changes'
    };
  }
  
  // If automatic merge fails, require manual resolution
  return {
    strategy: ConflictStrategy.MANUAL,
    reason: mergeResult.reason,
    conflicts: mergeResult.conflicts,
    localSnapshot,
    serverSnapshot,
    localEvents
  };
}

/**
 * Attempt to automatically merge local and server state
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function attemptAutomaticMerge({
  localSnapshot,
  localEvents,
  serverSnapshot,
  serverVersion
}) {
  try {
    // Start with server state as base
    const mergedState = JSON.parse(JSON.stringify(serverSnapshot));
    const conflicts = [];
    
    // Replay local events on top of server state
    for (const event of localEvents) {
      const applyResult = applyEventToState(mergedState, event);
      
      if (!applyResult.success) {
        conflicts.push({
          event,
          reason: applyResult.reason
        });
      }
    }
    
    // If there are conflicts, merge fails
    if (conflicts.length > 0) {
      return {
        success: false,
        reason: 'Cannot automatically apply all local events',
        conflicts
      };
    }
    
    return {
      success: true,
      mergedState: {
        state: mergedState,
        version: serverVersion + localEvents.length,
        userId: localSnapshot.userId
      },
      conflicts: []
    };
    
  } catch (error) {
    return {
      success: false,
      reason: `Merge error: ${error.message}`,
      conflicts: []
    };
  }
}

/**
 * Apply a single event to a game state
 * @param {Object} state - Game state
 * @param {Object} event - Event to apply
 * @returns {Object} Result with success flag
 */
function applyEventToState(state, event) {
  try {
    const { actionType, payload } = event;
    
    switch (actionType) {
      case 'SCORE_UPDATE':
        return applyScoreUpdate(state, payload);
      
      case 'BATCH_SCORE_UPDATE':
        return applyBatchScoreUpdate(state, payload);
      
      case 'ROUND_COMPLETE':
        return applyRoundComplete(state, payload);
      
      case 'BID_PLACED':
        return applyBidPlaced(state, payload);
      
      case 'TRICK_RECORDED':
        return applyTrickRecorded(state, payload);
      
      case 'PLAYER_ADD':
        return applyPlayerAdd(state, payload);
      
      case 'PLAYER_REMOVE':
        return applyPlayerRemove(state, payload);
      
      default:
        // Unknown action type - cannot apply
        return {
          success: false,
          reason: `Unknown action type: ${actionType}`
        };
    }
  } catch (error) {
    return {
      success: false,
      reason: `Error applying event: ${error.message}`
    };
  }
}

/**
 * Apply score update event
 */
function applyScoreUpdate(state, payload) {
  const { playerId, roundIndex, score } = payload;
  
  if (!state.rounds || !state.rounds[roundIndex]) {
    return { success: false, reason: 'Round not found' };
  }
  
  const playerScore = state.rounds[roundIndex].scores?.find(s => s.playerId === playerId);
  
  if (!playerScore) {
    return { success: false, reason: 'Player score not found' };
  }
  
  playerScore.score = score;
  return { success: true };
}

/**
 * Apply batch score update event
 */
function applyBatchScoreUpdate(state, payload) {
  const { roundIndex, scores } = payload;
  
  if (!state.rounds || !state.rounds[roundIndex]) {
    return { success: false, reason: 'Round not found' };
  }
  
  state.rounds[roundIndex].scores = scores;
  return { success: true };
}

/**
 * Apply round complete event
 */
function applyRoundComplete(state, payload) {
  const { roundIndex, finalScores } = payload;
  
  if (!state.rounds || !state.rounds[roundIndex]) {
    return { success: false, reason: 'Round not found' };
  }
  
  state.rounds[roundIndex].completed = true;
  state.rounds[roundIndex].scores = finalScores;
  state.currentRound = roundIndex + 1;
  
  return { success: true };
}

/**
 * Apply bid placed event
 */
function applyBidPlaced(state, payload) {
  const { playerId, roundIndex, bid } = payload;
  
  if (!state.rounds || !state.rounds[roundIndex]) {
    return { success: false, reason: 'Round not found' };
  }
  
  const playerBid = state.rounds[roundIndex].bids?.find(b => b.playerId === playerId);
  
  if (playerBid) {
    playerBid.bid = bid;
  } else {
    if (!state.rounds[roundIndex].bids) {
      state.rounds[roundIndex].bids = [];
    }
    state.rounds[roundIndex].bids.push({ playerId, bid });
  }
  
  return { success: true };
}

/**
 * Apply trick recorded event
 */
function applyTrickRecorded(state, payload) {
  const { playerId, roundIndex, tricks } = payload;
  
  if (!state.rounds || !state.rounds[roundIndex]) {
    return { success: false, reason: 'Round not found' };
  }
  
  const playerTricks = state.rounds[roundIndex].tricks?.find(t => t.playerId === playerId);
  
  if (playerTricks) {
    playerTricks.tricks = tricks;
  } else {
    if (!state.rounds[roundIndex].tricks) {
      state.rounds[roundIndex].tricks = [];
    }
    state.rounds[roundIndex].tricks.push({ playerId, tricks });
  }
  
  return { success: true };
}

/**
 * Apply player add event
 */
function applyPlayerAdd(state, payload) {
  const { player } = payload;
  
  if (!state.players) {
    state.players = [];
  }
  
  // Check if player already exists
  if (state.players.find(p => p.id === player.id)) {
    return { success: false, reason: 'Player already exists' };
  }
  
  state.players.push(player);
  return { success: true };
}

/**
 * Apply player remove event
 */
function applyPlayerRemove(state, payload) {
  const { playerId } = payload;
  
  if (!state.players) {
    return { success: false, reason: 'No players in state' };
  }
  
  const index = state.players.findIndex(p => p.id === playerId);
  
  if (index === -1) {
    return { success: false, reason: 'Player not found' };
  }
  
  state.players.splice(index, 1);
  return { success: true };
}

/**
 * Check if two states are equal
 * @param {Object} state1
 * @param {Object} state2
 * @returns {boolean}
 */
function areStatesEqual(state1, state2) {
  try {
    return JSON.stringify(state1) === JSON.stringify(state2);
  } catch {
    return false;
  }
}

/**
 * Detect specific conflicts between states
 * @param {Object} localState
 * @param {Object} serverState
 * @returns {Array<Object>} List of detected conflicts
 */
export function detectConflicts(localState, serverState) {
  const conflicts = [];
  
  // Check for player list differences
  if (JSON.stringify(localState.players) !== JSON.stringify(serverState.players)) {
    conflicts.push({
      type: 'players',
      field: 'players',
      localValue: localState.players,
      serverValue: serverState.players
    });
  }
  
  // Check for round differences
  if (localState.rounds && serverState.rounds) {
    localState.rounds.forEach((localRound, index) => {
      const serverRound = serverState.rounds[index];
      
      if (!serverRound) {
        conflicts.push({
          type: 'round_missing',
          field: `rounds[${index}]`,
          localValue: localRound,
          serverValue: null
        });
        return;
      }
      
      // Check scores
      if (JSON.stringify(localRound.scores) !== JSON.stringify(serverRound.scores)) {
        conflicts.push({
          type: 'scores',
          field: `rounds[${index}].scores`,
          localValue: localRound.scores,
          serverValue: serverRound.scores
        });
      }
      
      // Check bids
      if (JSON.stringify(localRound.bids) !== JSON.stringify(serverRound.bids)) {
        conflicts.push({
          type: 'bids',
          field: `rounds[${index}].bids`,
          localValue: localRound.bids,
          serverValue: serverRound.bids
        });
      }
    });
  }
  
  return conflicts;
}
