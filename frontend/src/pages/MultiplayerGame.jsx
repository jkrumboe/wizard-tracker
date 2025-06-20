import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import colyseusService from '../services/colyseusClient';
import { useAuth } from '../hooks/useAuth';
import NumberPicker from '../components/NumberPicker';
import '../styles/MultiplayerGame.css';

const MultiplayerGame = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [isHost, setIsHost] = useState(false);  const [isConnecting, setIsConnecting] = useState(false);  // Track connection status for UI
  const connectionAttemptRef = useRef(false);

  const connectToGame = useCallback(async () => {
    try {
      setError(null);
      
      // Prevent multiple simultaneous connections using ref only (not state)
      if (connectionAttemptRef.current) {
        console.log('Connection already in progress, skipping...');
        return;
      }
      
      connectionAttemptRef.current = true;
      setIsConnecting(true);
      
      // Set player data
      colyseusService.setPlayerData({
        id: user.player_id,
        name: user.username
      });

      let room;

      // Check if we already have a current room (from room creation)
      if (colyseusService.currentRoom && colyseusService.currentRoom.sessionId === roomId) {
        room = colyseusService.currentRoom;
        console.log('✅ Using existing room connection:', room.sessionId);
        // Trust that the room is valid since we just created it
      } else if (roomId && roomId !== 'new') {
        // Join existing room
        room = await colyseusService.joinGameRoom(roomId);
      } else {
        // Create new room or quick join
        room = await colyseusService.quickJoinGame();
      }

      setIsConnected(true);
      setIsConnecting(false);
      connectionAttemptRef.current = false;

      // Set up state listeners
      room.onStateChange((state) => {
        console.log('Game state updated:', state);
        
        // Convert players MapSchema to array and log for debugging
        const playersArray = Array.from(state.players.values());
        console.log('🔄 Players in state:', playersArray.map(p => p.name));
        
        // Force a new object reference to ensure React re-renders
        setGameState({
          ...state,
          players: state.players, // Keep original MapSchema for access
          playersArray: playersArray // Add converted array for easy access
        });
        
        // Find current player
        const player = playersArray.find(
          p => p.playerId === user.player_id
        );
        setCurrentPlayer(player);
        // Check if current user is host
        setIsHost(player?.isHost || false);
        setIsConnecting(false);
      });

      // Listen for welcome message first
      room.onMessage('welcome', (message) => {
        console.log('✅ Received welcome message:', message);
        // Room is fully ready for interaction
      });

      // Listen for game events
      room.onMessage('gameStarted', (message) => {
        console.log('Game started!', message);
      });
      
      room.onMessage('roundStarted', (message) => {
        console.log('New round started:', message);
      });

      room.onMessage('gameEnded', (message) => {
        console.log('Game ended:', message);
        // Could show final scores modal here
      });
      
      room.onMessage('hostChanged', (message) => {
        console.log('New host assigned:', message);
        // We'll update host status in the state change handler
      });
      
      // Listen for player join/leave events
      room.onMessage('playerJoined', (message) => {
        console.log('🎉 Player joined:', message.playerName);
        console.log('📊 Join event details:', message);
        // Force a state refresh by requesting current state
        if (room.state) {
          const currentPlayers = Array.from(room.state.players.values());
          console.log('🔍 Current players after join:', currentPlayers.map(p => p.name));
        }
      });

      room.onMessage('playerLeft', (message) => {
        console.log('👋 Player left:', message.playerName);
        console.log('📊 Leave event details:', message);
        // Force a state refresh by requesting current state
        if (room.state) {
          const currentPlayers = Array.from(room.state.players.values());
          console.log('🔍 Current players after leave:', currentPlayers.map(p => p.playerName));
        }
      });

      room.onMessage('error', (message) => {
        console.error('Game error:', message);
        setError(message.error);
      });

      room.onError((code, message) => {
        console.error('Room error:', code, message);
        setError(`Connection error: ${message}`);
      });

      room.onLeave((code) => {
        console.log('Left room:', code);
        setIsConnected(false);
        if (code !== 1000) { // Not a normal close
          setError('Disconnected from game');
        }
      });      room.onMessage('phaseChanged', (message) => {
        console.log('🔄 Phase changed:', message.phase);
        setGameState((prevState) => ({
          ...prevState,
          phase: message.phase,
        }));
      });
        // Add listeners for call and tricks updates
      room.onMessage('callUpdated', (message) => {
        try {
          console.log('📞 Call updated:', message);
          if (!message || !message.sessionId) {
            console.warn('Invalid callUpdated message received:', message);
            return;
          }
          
          setGameState((prevState) => {
            if (!prevState || !prevState.players) return prevState;
            
            // Use sessionId to find player (most reliable)
            const player = prevState.playersArray?.find(p => p.sessionId === message.sessionId) || 
                          Array.from(prevState.players.values()).find(p => p.sessionId === message.sessionId);
                          
            if (player) {
              console.log(`Updating call for player ${player.name} to ${message.call}`);
              player.call = message.call;
            } else {
              console.warn(`Could not find player with sessionId ${message.sessionId} to update call`);
            }
            
            return { ...prevState };
          });
        } catch (error) {
          console.error('Error handling callUpdated message:', error);
        }
      });
        room.onMessage('tricksUpdated', (message) => {
        try {
          console.log('🃏 Tricks updated:', message);
          if (!message || !message.sessionId) {
            console.warn('Invalid tricksUpdated message received:', message);
            return;
          }
          
          setGameState((prevState) => {
            if (!prevState || !prevState.players) return prevState;
            
            // Use sessionId to find player (most reliable)
            const player = prevState.playersArray?.find(p => p.sessionId === message.sessionId) || 
                          Array.from(prevState.players.values()).find(p => p.sessionId === message.sessionId);
                          
            if (player) {
              console.log(`Updating tricks for player ${player.name} to ${message.made}`);
              player.made = message.made;
            } else {
              console.warn(`Could not find player with sessionId ${message.sessionId} to update tricks`);
            }
            
            return { ...prevState };
          });
        } catch (error) {
          console.error('Error handling tricksUpdated message:', error);
        }
      });
    }
    catch (error) {
      console.error('Failed to connect to game:', error);
      setError('Failed to connect to game: ' + error.message);
      setIsConnecting(false);
      connectionAttemptRef.current = false;
    }
  }, [roomId, user]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    let isMounted = true;
    let cleanupTimeout = null;    const initializeConnection = async () => {
      // Only connect if component is still mounted and not already attempting connection
      if (!isMounted || connectionAttemptRef.current) return;
      
      try {
        await connectToGame();
      } catch (error) {
        console.error('Failed to initialize connection:', error);
        if (isMounted) {
          setError('Failed to connect to game: ' + error.message);
        }
      }
    };
    
    initializeConnection();
    
    return () => {
      isMounted = false;
      connectionAttemptRef.current = false; // Reset connection attempt flag
      
      // Clear any existing timeout
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }
      
      // Delay cleanup to avoid issues with double mounting during development
      cleanupTimeout = setTimeout(() => {
        // Only cleanup if we're actually connected and have a room
        if (colyseusService.currentRoom) {
          console.log('🧹 Cleaning up room connection...');
          colyseusService.leaveCurrentRoom();
        }      }, 100);    };
  }, [user, navigate]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: connectToGame is intentionally excluded to prevent re-running on connection state changes

  const handlePlayerReady = () => {
    const newReadyState = !currentPlayer?.isReady; // Toggle the ready state
    colyseusService.setPlayerReady(newReadyState);
  };

  const handleLeaveGame = () => {
    colyseusService.leaveCurrentRoom();
    navigate('/lobby');
  };

  if (error) {
    return (
      <div className="game-container">
        <div className="error-message">
          <h3>Game Error</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={connectToGame} className="retry-button">
              Retry Connection
            </button>
            <button onClick={() => navigate('/lobby')} className="back-button">
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );  }
  
  if (!isConnected) {
    return (
      <div className="game-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>{isConnecting ? 'Connecting to game...' : 'Loading game state...'}</p>
        </div>
      </div>
    );
  }

  // Show a dedicated "Waiting for Game State" page if gameState is null
  if (!gameState) {
    return (
      <div className="game-container waiting-for-gamestate">
        <header className="game-header">
          <div className="game-info">
            <div className="game-stats">
              <span>Room: {roomId}</span>
              <span>Status: Awaiting Game State...</span>
            </div>
          </div>
          <div className="game-actions">
            <button onClick={handleLeaveGame} className="leave-button">
              🚪 Leave Game
            </button>
          </div>
        </header>
        <div className="game-content">
          <div className="waiting-gamestate-status">
            <div className="waiting-animation">
              <div className="spinner large"></div>
            </div>
            <h2>Setting Up Game Room...</h2>
            <p>
              We're waiting for the game server to provide the initial game state.<br />
              This can take a few seconds, especially if you just created the room.
            </p>
            <p>
              <strong>What to do?</strong>
              <ul>
                <li>If you just created this room, please wait for other players to join.</li>
                <li>If this takes too long, try refreshing or leaving and rejoining the room.</li>
              </ul>
            </p>
            <div className="waiting-actions">
              <button onClick={connectToGame} className="retry-button">
                Retry Connection
              </button>
              <button onClick={handleLeaveGame} className="back-button">
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Use the pre-converted players array if available, fallback to conversion
  const players = gameState.playersArray || Array.from(gameState.players.values());
  console.log('🎭 Rendering with players:', players.map(p => p.name));
  
  const currentRound = gameState.currentRound;
  const phase = gameState.phase;

  // Get dealer and calling order information from backend state
  const dealerIndex = gameState.dealerIndex || 0;
  const playerOrder = gameState.playerOrder ? Array.from(gameState.playerOrder) : [];
  const currentCallIndex = gameState.currentCallIndex || 0;
  
  // Create ordered players array based on backend player order
  const orderedPlayers = playerOrder.length > 0 
    ? playerOrder.map(sessionId => players.find(p => p.sessionId === sessionId)).filter(Boolean)
    : players;
  
  const totalCalls = players.reduce((sum, player) => sum + (player.call || 0), 0);

  // Get current player info for turn management
  const currentTurnSessionId = playerOrder[currentCallIndex];
  const currentTurnPlayer = players.find(p => p.sessionId === currentTurnSessionId);

  // Debugging logs for game state and player actions
  console.log('🔍 Current phase:', phase);
  console.log('🔍 Current player:', currentPlayer);
  console.log('🔍 Player order:', playerOrder);
  console.log('🔍 Current call index:', currentCallIndex);
  console.log('🔍 Current turn player:', currentTurnPlayer?.name);
  console.log("orderedPlayers", orderedPlayers);
  // Moving this useEffect higher up in the component to avoid conditional hook calling

  return (
    <div className="game-container">
      <header className="game-header">
        <div className="game-info">
          <div className="game-stats">
            <span>Round: {currentRound}/13</span>
            <span>Phase: {phase}</span>
            <span>Players: {players.length}</span>
          </div>
        </div>

        {phase === 'waiting' && (
            <div className="waiting-phase">
              <h2>Waiting for Players</h2>
              <p>Waiting for all players to be ready...</p>
              {isHost && (
                <div className="host-controls">
                  <button 
                    onClick={() => colyseusService.randomizePlayerOrder()}
                    className="randomize-button"
                    disabled={gameState.gameStarted}
                  >
                    🎲 Randomize Player Order
                  </button>
                </div>
              )}
            </div>
          )}
        
        <div className="game-actions">
          <button onClick={handleLeaveGame} className="leave-button">
            🚪 Leave Game
          </button>
        </div>
      </header>

      <div className="game-content">
        {/* Game Status */}
        {phase != 'waiting' && (
        <div className="game-status">
           {phase === 'calling' && (
            <div className="calling-phase">
              <div className="round-header">
                <h2>Round {currentRound} - Calling Phase</h2>
                <div className="round-info">
                  <span>Cards this round: {currentRound}</span>
                  <span className="total-calls">
                    Total Calls: {totalCalls} / {currentRound}
                  </span>
                </div>
              </div>
              
              {/* Game Table with updated layout */}
              <div className="game-table">
                <table className="score-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Call</th>
                      <th>Made</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedPlayers.map((player, orderIndex) => {
                      const isCurrentPlayer = player.playerId === user.player_id;
                      const isDealer = orderIndex === dealerIndex;
                      const isCurrentUserHost = isHost; // Is the current user the host?
                      
                      return (
                        <tr key={player.sessionId || player.playerId} className={`player-row ${isCurrentPlayer ? 'current-player' : ''}`}>
                          <td className="player-cell">
                              <span className="player-name">
                                {player.name || player.playerName}
                                {player.isHost && <span className="host-badge">HOST</span>}
                              </span>
                              <div className="player-badges">
                                {isDealer && <span className="dealer-badge">🃏 Dealer</span>}
                              </div>
                          </td>
                          <td className="call-cell">
                            {isCurrentUserHost ? (
                              <NumberPicker
                                value={player.call || 0}
                                onChange={(call) => {
                                  // Add bypass turn order flag for host calls
                                  colyseusService.makeCall(call, player.playerId, true);
                                }}
                                min={0}
                                max={currentRound}
                                title={`Round ${currentRound} - Make call for ${player.name || player.playerName}`}
                              />
                            ) : (                              <span className="call-value">
                                {player.call !== undefined && player.call !== null ? player.call : '-'}
                              </span>
                            )}
                          </td>
                          <td className="made-cell">
                            <span className="made-value">
                              {player.made !== undefined && player.made !== null ? player.made : '-'}
                            </span>
                          </td>
                          <td className="score-cell">
                            <div className="score-container">
                              <span className="score-value">-</span>
                              <span className="total-value">{player.totalScore || 0} pts</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {phase === 'playing' && (
            <div className="playing-phase">
              <div className="round-header">
                <h2>Round {currentRound} - Playing Phase</h2>
                <p>Round in progress. Report your tricks when finished!</p>
              </div>
                {/* Game Table for playing phase with updated layout */}
              <div className="game-table">
                <table className="score-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Call</th>
                      <th>Made</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                <tbody>
                  {orderedPlayers.map((player, orderIndex) => {
                      const isCurrentPlayer = player.playerId === user.player_id;
                      const isDealer = orderIndex === dealerIndex;
                      const isCurrentUserHost = isHost; // Is the current user the host?
                      return (
                        <tr key={player.playerId} className={`player-row ${isCurrentPlayer ? 'current-player' : ''}`}>
                          <td className="player-cell">
                            <div className="player-info">
                              <span className="player-name">
                                {player.name || player.playerName}
                                {isDealer && <span className="dealer-badge">🃏 Dealer</span>}
                                {isCurrentPlayer && <span className="you-badge">(You)</span>}
                                {player.isHost && <span className="host-badge">👑</span>}
                              </span>
                            </div>                          </td>
                          <td className="call-cell">
                            <span className="call-value">{player.call}</span>
                          </td>                          <td className="made-cell">
                            {isCurrentUserHost ? (
                              <NumberPicker                                value={player.made || 0}
                                onChange={(tricks) => colyseusService.makeTricks(tricks, player.playerId, true)}
                                min={0}
                                max={currentRound}
                                title={`Round ${currentRound} - Report tricks for ${player.name || player.playerName}`}
                              />
                            ) : (
                              <span className="made-value">                                {player.made !== undefined && player.made !== null ? player.made : '-'}
                              </span>
                            )}
                          </td>
                          <td className="score-cell">
                            <div className="score-container">
                              <span className={`score-value ${player.roundScore > 0 ? 'positive-score' : player.roundScore < 0 ? 'negative-score' : ''}`}>
                                {player.roundScore !== undefined ? player.roundScore : '-'}
                              </span>
                              <span className="total-value">{player.totalScore || 0} pts</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {phase === 'ended' && (
            <div className="ended-phase">
              <h2>Game Complete!</h2>
              <p>Final scores have been calculated.</p>
            </div>
          )}
        </div>
        )}
        
        {/* Players List - Only show in waiting phase */}
        {phase === 'waiting' && (
          <div className="players-section">
            <h3>Players</h3>
            <div className="players-grid">
              {players.map((player) => {
                const isCurrentPlayer = player.playerId === user.player_id;
                
                return (
                  <div 
                    key={player.playerId} 
                    className={`player-card ${isCurrentPlayer ? 'current-player' : ''}`}
                  >
                    <div className="player-info">
                      <h4>
                        {player.name}
                        <div className="badges">
                          {player.isHost && <span className="host-badge">HOST</span>}
                          {/* {isCurrentPlayer && <span className="you-badge">(You)</span>} */}
                        </div>
                      </h4>
                      
                      {!isCurrentPlayer && (
                      <div className="player-status">
                        <span className={`ready-status ${player.isReady ? 'ready' : 'not-ready'}`}>
                          {player.isReady ? 'Ready' : 'Not Ready'}
                        </span>
                      </div>
                      )}
                    </div>
                    
                    {/* Ready button for waiting phase */}
                    {isCurrentPlayer && (
                      <div className="player-actions">
                        <button 
                          onClick={handlePlayerReady}
                          className={`ready-button ${currentPlayer?.isReady ? 'ready' : 'not-ready'}`}
                        >
                          {currentPlayer?.isReady ? 'Unready' : 'Ready'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Scores Table - Show complete game history */}
        {gameState.rounds && gameState.rounds.length > 0 && phase !== 'waiting' && (
          <div className="scores-section">
            <h3>Game History</h3>
            <div className="score-table">
              <table>
                <thead>
                  <tr>
                    <th>Round</th>
                    {players.map(player => (
                      <th key={player.playerId}>{player.playerName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(gameState.rounds.values()).map((round) => (
                    <tr key={round.roundNumber}>
                      <td>Round {round.roundNumber}</td>
                      {players.map(player => {
                        const playerCall = round.calls?.get?.(player.playerId) ?? '';
                        const playerTricks = round.tricks?.get?.(player.playerId) ?? '';
                        const playerScore = round.scores?.get?.(player.playerId) ?? '';
                        
                        return (
                          <td key={player.playerId}>
                            <div className="score-cell">
                              <div className="call-tricks">{playerCall}|{playerTricks}</div>
                              <div className="round-score">{playerScore}</div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiplayerGame;
