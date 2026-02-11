const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const GameEvent = require('../models/GameEvent');
const GameSnapshot = require('../models/GameSnapshot');
const { mirrorGameEventCreate, mirrorGameSnapshotCreate, mirrorGameUpdate } = require('../utils/gameDualWrite');

/**
 * POST /api/games/:id/events
 * Accept batch of events with optimistic locking
 */
router.post('/:id/events', async (req, res) => {
  try {
    const { id: gameId } = req.params;
    const { clientId, baseVersion, events } = req.body;

    // Validate request
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'Events array is required and must not be empty'
      });
    }

    if (typeof baseVersion !== 'number') {
      return res.status(400).json({
        error: 'baseVersion is required and must be a number'
      });
    }

    // Get the game
    const game = await Game.findOne({ localId: gameId });
    
    if (!game) {
      return res.status(404).json({
        error: 'Game not found'
      });
    }

    // Get current server version from latest event or snapshot
    let currentServerVersion = 0;
    
    const latestEvent = await GameEvent.findOne({ gameId })
      .sort({ serverVersion: -1 })
      .limit(1);
    
    if (latestEvent) {
      currentServerVersion = latestEvent.serverVersion;
    }

    // Check for version conflict
    if (baseVersion !== currentServerVersion) {
      // Version mismatch - return conflict with current state
      const snapshot = await GameSnapshot.findOne({ gameId })
        .sort({ serverVersion: -1 })
        .limit(1);

      return res.status(409).json({
        error: 'Version conflict detected',
        currentVersion: currentServerVersion,
        baseVersion,
        snapshot: snapshot ? snapshot.gameState : game.gameData,
        serverVersion: currentServerVersion
      });
    }

    // Apply events
    const appliedEvents = [];
    let newServerVersion = currentServerVersion;

    for (const event of events) {
      try {
        // Check for duplicate event ID
        const existingEvent = await GameEvent.findOne({ id: { $eq: event.id }, gameId });
        
        if (existingEvent) {
          // Event already applied - skip but include in response
          appliedEvents.push({
            id: event.id,
            serverVersion: existingEvent.serverVersion,
            duplicate: true
          });
          continue;
        }

        // Increment server version
        newServerVersion++;

        // Create new event
        const newEvent = new GameEvent({
          id: event.id,
          gameId,
          actionType: event.actionType,
          payload: event.payload,
          timestamp: event.timestamp,
          localVersion: event.localVersion,
          userId: event.userId,
          clientId: clientId || event.clientId,
          serverVersion: newServerVersion,
          acknowledged: true
        });

        await newEvent.save();

        // Mirror event to PostgreSQL (non-blocking)
        mirrorGameEventCreate(newEvent).catch(() => {});

        appliedEvents.push({
          id: event.id,
          serverVersion: newServerVersion,
          duplicate: false
        });

      } catch (error) {
        console.error('Error applying event:', error);
        // Continue with other events but log the error
      }
    }

    // Update game state by replaying events
    const updatedGameState = await reconstructGameState(gameId, newServerVersion);
    
    game.gameData = updatedGameState;
    await game.save();

    // Mirror updated game state to PostgreSQL (non-blocking)
    mirrorGameUpdate(game, { gameData: updatedGameState }).catch(() => {});

    // Create snapshot every N events (e.g., every 50 events)
    const eventCount = await GameEvent.countDocuments({ gameId });
    
    if (eventCount % 50 === 0) {
      await createSnapshot(gameId, newServerVersion, updatedGameState, game.userId);
    }

    res.json({
      success: true,
      serverVersion: newServerVersion,
      appliedEvents,
      eventsProcessed: appliedEvents.length,
      newEvents: appliedEvents.filter(e => !e.duplicate).length
    });

  } catch (error) {
    console.error('Error processing events:', error);
    res.status(500).json({
      error: 'Failed to process events',
      message: error.message
    });
  }
});

/**
 * POST /api/games/:id/snapshots
 * Upload a complete game snapshot (force push)
 */
router.post('/:id/snapshots', async (req, res) => {
  try {
    const { id: gameId } = req.params;
    const { snapshot, localVersion, force } = req.body;

    if (!snapshot) {
      return res.status(400).json({
        error: 'Snapshot is required'
      });
    }

    // Get the game
    const game = await Game.findOne({ localId: gameId });
    
    if (!game) {
      return res.status(404).json({
        error: 'Game not found'
      });
    }

    // Check authorization if force push
    if (force) {
      // In production, verify user has permission to force push
      // For now, allow force push if user owns the game
      if (game.userId !== req.body.userId && game.userId.toString() !== req.body.userId) {
        return res.status(403).json({
          error: 'Not authorized to force push'
        });
      }
    }

    // Get current server version
    let currentServerVersion = 0;
    
    const latestEvent = await GameEvent.findOne({ gameId })
      .sort({ serverVersion: -1 })
      .limit(1);
    
    if (latestEvent) {
      currentServerVersion = latestEvent.serverVersion;
    }

    // Increment version for new snapshot
    const newServerVersion = currentServerVersion + 1;

    // Update game
    game.gameData = snapshot;
    await game.save();

    // Mirror game state update to PostgreSQL (non-blocking)
    mirrorGameUpdate(game, { gameData: snapshot }).catch(() => {});

    // Create snapshot record
    await createSnapshot(gameId, newServerVersion, snapshot, game.userId);

    res.json({
      success: true,
      serverVersion: newServerVersion,
      message: 'Snapshot saved successfully'
    });

  } catch (error) {
    console.error('Error saving snapshot:', error);
    res.status(500).json({
      error: 'Failed to save snapshot',
      message: error.message
    });
  }
});

/**
 * GET /api/games/:id/events
 * Get events since a specific version
 */
router.get('/:id/events', async (req, res) => {
  try {
    const { id: gameId } = req.params;
    const { since } = req.query;

    const query = { gameId };
    
    if (since) {
      query.serverVersion = { $gt: parseInt(since) };
    }

    const events = await GameEvent.find(query)
      .sort({ serverVersion: 1 })
      .limit(1000); // Limit to prevent huge responses

    res.json({
      events,
      count: events.length
    });

  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      error: 'Failed to fetch events',
      message: error.message
    });
  }
});

/**
 * GET /api/games/:id/snapshot
 * Get latest snapshot and current version
 */
router.get('/:id/snapshot', async (req, res) => {
  try {
    const { id: gameId } = req.params;

    // Get game
    const game = await Game.findOne({ localId: gameId });
    
    if (!game) {
      return res.status(404).json({
        error: 'Game not found'
      });
    }

    // Get current server version
    let serverVersion = 0;
    
    const latestEvent = await GameEvent.findOne({ gameId })
      .sort({ serverVersion: -1 })
      .limit(1);
    
    if (latestEvent) {
      serverVersion = latestEvent.serverVersion;
    }

    res.json({
      snapshot: game.gameData,
      serverVersion,
      gameId
    });

  } catch (error) {
    console.error('Error fetching snapshot:', error);
    res.status(500).json({
      error: 'Failed to fetch snapshot',
      message: error.message
    });
  }
});

/**
 * Helper: Reconstruct game state from events
 */
async function reconstructGameState(gameId, upToVersion) {
  // Get base snapshot (most recent before upToVersion)
  const baseSnapshot = await GameSnapshot.findOne({
    gameId,
    serverVersion: { $lte: upToVersion }
  })
    .sort({ serverVersion: -1 })
    .limit(1);

  let state = baseSnapshot ? baseSnapshot.gameState : {};
  const startVersion = baseSnapshot ? baseSnapshot.serverVersion : 0;

  // Get events after snapshot
  const events = await GameEvent.find({
    gameId,
    serverVersion: { $gt: startVersion, $lte: upToVersion }
  })
    .sort({ serverVersion: 1 });

  // Apply events to reconstruct state
  for (const event of events) {
    state = applyEventToState(state, event);
  }

  return state;
}

/**
 * Helper: Apply a single event to state
 */
function applyEventToState(state, event) {
  const { actionType, payload } = event;
  
  // This is a simplified version - should match the logic in
  // frontend/src/shared/sync/eventReplayer.js
  
  switch (actionType) {
    case 'SCORE_UPDATE':
      return applyScoreUpdate(state, payload);
    case 'BATCH_SCORE_UPDATE':
      return applyBatchScoreUpdate(state, payload);
    case 'ROUND_COMPLETE':
      return applyRoundComplete(state, payload);
    case 'BID_PLACED':
      return applyBidPlaced(state, payload);
    case 'PLAYER_ADD':
      return applyPlayerAdd(state, payload);
    default:
      // For unknown actions, just return state unchanged
      return state;
  }
}

// Event application helpers (simplified)
function applyScoreUpdate(state, payload) {
  const { playerId, roundIndex, score } = payload;
  if (state.rounds && state.rounds[roundIndex]) {
    const playerScore = state.rounds[roundIndex].scores?.find(s => s.playerId === playerId);
    if (playerScore) {
      playerScore.score = score;
    }
  }
  return state;
}

function applyBatchScoreUpdate(state, payload) {
  const { roundIndex, scores } = payload;
  if (state.rounds && state.rounds[roundIndex]) {
    state.rounds[roundIndex].scores = scores;
  }
  return state;
}

function applyRoundComplete(state, payload) {
  const { roundIndex, finalScores } = payload;
  if (state.rounds && state.rounds[roundIndex]) {
    state.rounds[roundIndex].completed = true;
    state.rounds[roundIndex].scores = finalScores;
  }
  return state;
}

function applyBidPlaced(state, payload) {
  const { playerId, roundIndex, bid } = payload;
  if (state.rounds && state.rounds[roundIndex]) {
    if (!state.rounds[roundIndex].bids) {
      state.rounds[roundIndex].bids = [];
    }
    const existingBid = state.rounds[roundIndex].bids.find(b => b.playerId === playerId);
    if (existingBid) {
      existingBid.bid = bid;
    } else {
      state.rounds[roundIndex].bids.push({ playerId, bid });
    }
  }
  return state;
}

function applyPlayerAdd(state, payload) {
  const { player } = payload;
  if (!state.players) {
    state.players = [];
  }
  if (!state.players.find(p => p.id === player.id)) {
    state.players.push(player);
  }
  return state;
}

/**
 * Helper: Create a snapshot
 */
async function createSnapshot(gameId, serverVersion, gameState, userId) {
  try {
    const eventCount = await GameEvent.countDocuments({ gameId });
    
    const snapshot = new GameSnapshot({
      gameId,
      serverVersion,
      gameState,
      userId,
      eventCount
    });

    await snapshot.save();

    // Mirror snapshot to PostgreSQL (non-blocking)
    mirrorGameSnapshotCreate(snapshot).catch(() => {});
    
    return snapshot;
  } catch (error) {
    console.error('Error creating snapshot:', error);
    // Don't throw - snapshots are optional optimization
  }
}

module.exports = router;
