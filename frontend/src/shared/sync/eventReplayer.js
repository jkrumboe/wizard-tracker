/**
 * @fileoverview Event Replayer
 * Replays pending events to reconstruct game state
 */

import { GameActionTypes } from '../schemas/gameEvent.js';

/**
 * Replay events onto a base state
 * @param {Object} baseState - Starting state
 * @param {Array<Object>} events - Events to replay
 * @returns {Object} Reconstructed state
 */
export function replayEvents(baseState, events) {
  // Deep clone base state to avoid mutations
  let currentState = JSON.parse(JSON.stringify(baseState));
  const errors = [];
  
  // Sort events by timestamp to ensure correct order
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  
  for (const event of sortedEvents) {
    try {
      currentState = applyEvent(currentState, event);
    } catch (error) {
      errors.push({
        event,
        error: error.message
      });
    }
  }
  
  return {
    state: currentState,
    errors,
    eventsReplayed: sortedEvents.length - errors.length
  };
}

/**
 * Apply a single event to state
 * @param {Object} state
 * @param {Object} event
 * @returns {Object} Updated state
 */
function applyEvent(state, event) {
  const { actionType, payload } = event;
  
  switch (actionType) {
    case GameActionTypes.GAME_START:
      return applyGameStart(state, payload);
    
    case GameActionTypes.GAME_PAUSE:
      return applyGamePause(state, payload);
    
    case GameActionTypes.GAME_RESUME:
      return applyGameResume(state, payload);
    
    case GameActionTypes.GAME_END:
      return applyGameEnd(state, payload);
    
    case GameActionTypes.ROUND_START:
      return applyRoundStart(state, payload);
    
    case GameActionTypes.ROUND_COMPLETE:
      return applyRoundComplete(state, payload);
    
    case GameActionTypes.SCORE_UPDATE:
      return applyScoreUpdate(state, payload);
    
    case GameActionTypes.BATCH_SCORE_UPDATE:
      return applyBatchScoreUpdate(state, payload);
    
    case GameActionTypes.PLAYER_ADD:
      return applyPlayerAdd(state, payload);
    
    case GameActionTypes.PLAYER_REMOVE:
      return applyPlayerRemove(state, payload);
    
    case GameActionTypes.PLAYER_UPDATE:
      return applyPlayerUpdate(state, payload);
    
    case GameActionTypes.BID_PLACED:
      return applyBidPlaced(state, payload);
    
    case GameActionTypes.BID_UPDATE:
      return applyBidUpdate(state, payload);
    
    case GameActionTypes.TRICK_RECORDED:
      return applyTrickRecorded(state, payload);
    
    case GameActionTypes.TRICK_UPDATE:
      return applyTrickUpdate(state, payload);
    
    case GameActionTypes.STATE_RESTORE:
      return applyStateRestore(state, payload);
    
    case GameActionTypes.STATE_MERGE:
      return applyStateMerge(state, payload);
    
    default:
      console.warn(`Unknown action type: ${actionType}`);
      return state;
  }
}

// Event Application Functions

function applyGameStart(state, payload) {
  return {
    ...state,
    status: 'active',
    startedAt: payload.startedAt || Date.now(),
    ...payload
  };
}

function applyGamePause(state, payload) {
  return {
    ...state,
    status: 'paused',
    pausedAt: payload.pausedAt || Date.now()
  };
}

function applyGameResume(state, payload) {
  return {
    ...state,
    status: 'active',
    resumedAt: payload.resumedAt || Date.now()
  };
}

function applyGameEnd(state, payload) {
  return {
    ...state,
    status: 'completed',
    endedAt: payload.endedAt || Date.now(),
    finalScores: payload.finalScores
  };
}

function applyRoundStart(state, payload) {
  const { roundIndex, roundData } = payload;
  
  if (!state.rounds) {
    state.rounds = [];
  }
  
  state.rounds[roundIndex] = {
    ...roundData,
    startedAt: Date.now(),
    completed: false
  };
  
  state.currentRound = roundIndex;
  
  return { ...state };
}

function applyRoundComplete(state, payload) {
  const { roundIndex, finalScores } = payload;
  
  if (state.rounds && state.rounds[roundIndex]) {
    state.rounds[roundIndex] = {
      ...state.rounds[roundIndex],
      completed: true,
      completedAt: Date.now(),
      scores: finalScores
    };
    
    state.currentRound = roundIndex + 1;
  }
  
  return { ...state };
}

function applyScoreUpdate(state, payload) {
  const { playerId, roundIndex, score } = payload;
  
  if (!state.rounds || !state.rounds[roundIndex]) {
    return state;
  }
  
  const round = state.rounds[roundIndex];
  
  if (!round.scores) {
    round.scores = [];
  }
  
  const existingScore = round.scores.find(s => s.playerId === playerId);
  
  if (existingScore) {
    existingScore.score = score;
  } else {
    round.scores.push({ playerId, score });
  }
  
  return { ...state };
}

function applyBatchScoreUpdate(state, payload) {
  const { roundIndex, scores } = payload;
  
  if (!state.rounds || !state.rounds[roundIndex]) {
    return state;
  }
  
  state.rounds[roundIndex].scores = scores;
  
  return { ...state };
}

function applyPlayerAdd(state, payload) {
  const { player } = payload;
  
  if (!state.players) {
    state.players = [];
  }
  
  // Check if player already exists
  if (!state.players.find(p => p.id === player.id)) {
    state.players.push(player);
  }
  
  return { ...state };
}

function applyPlayerRemove(state, payload) {
  const { playerId } = payload;
  
  if (state.players) {
    state.players = state.players.filter(p => p.id !== playerId);
  }
  
  return { ...state };
}

function applyPlayerUpdate(state, payload) {
  const { playerId, updates } = payload;
  
  if (state.players) {
    const player = state.players.find(p => p.id === playerId);
    if (player) {
      Object.assign(player, updates);
    }
  }
  
  return { ...state };
}

function applyBidPlaced(state, payload) {
  const { playerId, roundIndex, bid } = payload;
  
  if (!state.rounds || !state.rounds[roundIndex]) {
    return state;
  }
  
  const round = state.rounds[roundIndex];
  
  if (!round.bids) {
    round.bids = [];
  }
  
  const existingBid = round.bids.find(b => b.playerId === playerId);
  
  if (existingBid) {
    existingBid.bid = bid;
  } else {
    round.bids.push({ playerId, bid });
  }
  
  return { ...state };
}

function applyBidUpdate(state, payload) {
  return applyBidPlaced(state, payload);
}

function applyTrickRecorded(state, payload) {
  const { playerId, roundIndex, tricks } = payload;
  
  if (!state.rounds || !state.rounds[roundIndex]) {
    return state;
  }
  
  const round = state.rounds[roundIndex];
  
  if (!round.tricks) {
    round.tricks = [];
  }
  
  const existingTricks = round.tricks.find(t => t.playerId === playerId);
  
  if (existingTricks) {
    existingTricks.tricks = tricks;
  } else {
    round.tricks.push({ playerId, tricks });
  }
  
  return { ...state };
}

function applyTrickUpdate(state, payload) {
  return applyTrickRecorded(state, payload);
}

function applyStateRestore(state, payload) {
  // Complete state replacement
  return { ...payload.state };
}

function applyStateMerge(state, payload) {
  // Merge specific fields
  return { ...state, ...payload.updates };
}

/**
 * Validate that replayed state is consistent
 * @param {Object} state
 * @returns {Object} Validation result
 */
export function validateReplayedState(state) {
  const errors = [];
  
  // Check required fields
  if (!state.players || !Array.isArray(state.players)) {
    errors.push('Missing or invalid players array');
  }
  
  if (!state.rounds || !Array.isArray(state.rounds)) {
    errors.push('Missing or invalid rounds array');
  }
  
  // Check round consistency
  if (state.rounds) {
    state.rounds.forEach((round, index) => {
      if (round.completed && !round.scores) {
        errors.push(`Round ${index} marked complete but missing scores`);
      }
    });
  }
  
  // Check current round is valid
  if (typeof state.currentRound === 'number') {
    if (state.currentRound < 0 || state.currentRound > state.rounds?.length) {
      errors.push(`Invalid current round: ${state.currentRound}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get a summary of events for debugging
 * @param {Array<Object>} events
 * @returns {Object}
 */
export function getEventSummary(events) {
  const summary = {
    total: events.length,
    byType: {},
    timeRange: {
      first: events[0]?.timestamp,
      last: events[events.length - 1]?.timestamp
    },
    acknowledged: events.filter(e => e.acknowledged).length,
    pending: events.filter(e => !e.acknowledged).length
  };
  
  events.forEach(event => {
    summary.byType[event.actionType] = (summary.byType[event.actionType] || 0) + 1;
  });
  
  return summary;
}
