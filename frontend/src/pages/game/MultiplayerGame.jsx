import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import colyseusService from '@/shared/api/colyseusClient';
import { useAuth } from '@/shared/hooks/useAuth';
import GameMenuModal from "@/components/modals/GameMenuModal";
import PauseConfirmationModal from "@/components/modals/PauseConfirmationModal";
import { MenuIcon, PauseIcon, SaveIcon, StatIcon, BarChartIcon, GamepadIcon } from "@/components/ui/Icon";
import PerformanceMetric from "@/components/common/PerformanceMetric";
import StatsChart from "@/components/game/StatsChart";
import { ArrowLeftIcon, ArrowRight } from "lucide-react";
import "@/styles/utils/performanceMetrics.css";
import "@/styles/pages/stats.css";
import "@/styles/components/statsChart.css";
import "@/styles/pages/MultiplayerGame.css";

// Calculate comprehensive game statistics for all players
const calculateDetailedGameStats = (gameState, currentRoundIndex = 0) => {
  if (!gameState || !gameState.players) {
    return [];
  }
  
  const players = Array.from(gameState.players.values());
  const roundHistory = gameState.roundHistory || [];
  
  return players.map((player) => {
    let correctBids = 0;
    let totalBids = 0;
    let totalTricks = 0;
    let perfectRounds = 0;
    let overBids = 0;
    let underBids = 0;
    let totalPoints = 0;
    let bestRound = 0;
    let worstRound = 0;
    let consecutiveCorrect = 0;
    let maxConsecutiveCorrect = 0;
    
    roundHistory.forEach((round, roundIndex) => {
      const roundPlayer = round.players.find(p => p.playerId === player.playerId);
      if (roundPlayer && roundPlayer.call !== null && roundPlayer.made !== null) {
        totalBids += roundPlayer.call;
        totalTricks += roundPlayer.made;
        
        if (roundPlayer.call === roundPlayer.made) {
          correctBids++;
          consecutiveCorrect++;
          maxConsecutiveCorrect = Math.max(maxConsecutiveCorrect, consecutiveCorrect);
          perfectRounds++;
        } else {
          consecutiveCorrect = 0;
          if (roundPlayer.made > roundPlayer.call) {
            overBids++;
          } else {
            underBids++;
          }
        }
        
        const roundScore = roundPlayer.roundScore || 0;
        if (roundIndex === 0 || roundScore > bestRound) bestRound = roundScore;
        if (roundIndex === 0 || roundScore < worstRound) worstRound = roundScore;
      }
    });
    
    const roundsPlayed = roundHistory.length;
    const bidAccuracy = roundsPlayed > 0 ? (correctBids / roundsPlayed) * 100 : 0;
    const avgBid = roundsPlayed > 0 ? totalBids / roundsPlayed : 0;
    const avgTricks = roundsPlayed > 0 ? totalTricks / roundsPlayed : 0;
    const avgPointsPerRound = roundsPlayed > 0 ? totalPoints / roundsPlayed : 0;
    const avgDiff = roundsPlayed > 0 ? 
      roundHistory.reduce((sum, round) => {
        const roundPlayer = round.players.find(p => p.playerId === player.playerId);
        if (roundPlayer && roundPlayer.call !== null && roundPlayer.made !== null) {
          return sum + Math.abs(roundPlayer.made - roundPlayer.call);
        }
        return sum;
      }, 0) / roundsPlayed 
      : 0;

    // Get the current player's total score
    const playerCurrentTotalScore = player.totalScore || 0;

    return {
      id: player.playerId,
      name: player.name,
      roundsPlayed,
      correctBids,
      perfectRounds,
      bidAccuracy: bidAccuracy.toFixed(1),
      avgBid: avgBid.toFixed(1),
      avgTricks: avgTricks.toFixed(1),
      avgPointsPerRound: avgPointsPerRound.toFixed(1),
      totalPoints: playerCurrentTotalScore,
      overBids,
      underBids,
      bestRound,
      worstRound,
      maxConsecutiveCorrect,
      avgDiff: avgDiff.toFixed(2)
    };
  });
};

const MultiplayerGame = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const connectionAttemptRef = useRef(false);
  
  // UI state
  const [activeTab, setActiveTab] = useState('game');
  const [showGameMenuModal, setShowGameMenuModal] = useState(false);
  const [showPauseModal] = useState(false); // Removed unused setter
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [statsSubTab, setStatsSubTab] = useState('chart'); // 'chart' or 'details'
  
  // Initialize gameState with a phase of 'waiting' if we're creating a new game
  useEffect(() => {
    if (roomId === 'new' && !gameState) {
      // Set an initial game state for the 'new' route immediately
      setGameState({
        phase: 'waiting',
        gameStarted: false,
        players: new Map(),
        playersArray: [{
          // Create a placeholder player entry for the current user
          playerId: user.player_id,
          name: user.username,
          isHost: true,
          isReady: false
        }],
        currentRound: 0
      });
      
      // Mark the current player as the host
      setIsHost(true);
      setCurrentPlayer({
        playerId: user.player_id,
        name: user.username,
        isHost: true,
        isReady: false
      });
    }
  }, [roomId, gameState, user]);
  
  // Function to toggle player stats visibility
  const togglePlayerStats = (playerId) => {
    setSelectedPlayerId(prev => prev === playerId ? null : playerId);
  }

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
        
        // Immediately set up initial game state for the creator
        if (!gameState) {
          const initialState = room.state;
          if (initialState) {
            // Safely access players - if it doesn't exist, use empty Map
            const players = initialState.players || new Map();
            const playersArray = players instanceof Map ? Array.from(players.values()) : [];
            
            console.log('Setting up initial game state from room state:', initialState);
            
            // Force a new object reference to ensure React re-renders
            setGameState({
              ...initialState,
              players: players,
              playersArray: playersArray,
              phase: initialState.phase || 'waiting'
            });
            
            // Find current player
            const player = playersArray.find(p => p.playerId === user.player_id);
            setCurrentPlayer(player);
            setIsHost(player?.isHost || false);
          } else {
            // If no state exists yet, create a minimal initial state
            setGameState({
              phase: 'waiting',
              gameStarted: false,
              players: new Map(),
              playersArray: [],
              currentRound: 0
            });
            setIsHost(true); // Assume creator is host
          }
        }
      } else if (roomId && roomId !== 'new') {
        // Join existing room
        room = await colyseusService.joinGameRoom(roomId);
      } else if (roomId === 'new') {
        // Create a new game with default settings using the tracking method
        room = await colyseusService.createGameRoomWithTracking({
          roomName: `${user.username}'s Game`,
          maxPlayers: 4,
          gameMode: 'classic',
          isPrivate: false,
          hostId: String(user.player_id),
          hostName: user.username
        });
        
        // Update URL to include the actual room ID without reloading
        if (room && room.sessionId && roomId === 'new') {
          window.history.replaceState(null, '', `/multiplayer/${room.sessionId}`);
        }
      } else {
        // Quick join any available game
        room = await colyseusService.quickJoinGame();
      }

      setIsConnected(true);
      setIsConnecting(false);
      connectionAttemptRef.current = false;

      // Set up state listeners
      room.onStateChange((state) => {
        console.log('Game state updated:', state);
        
        // Safely handle state which might be incomplete
        if (!state) {
          console.log('⚠️ Received null game state');
          
          // Create a minimal state with waiting phase to show the waiting screen
          setGameState({
            phase: 'waiting',
            gameStarted: false,
            players: new Map(),
            playersArray: [],
            currentRound: 0
          });
          return;
        }
        
        try {
          // Handle players carefully, ensuring we always have a valid representation
          let playersArray = [];
          
          if (state.players) {
            try {
              // Special handling for Colyseus MapSchema which doesn't work with instanceof checks
              if (state.players.forEach) {
                // MapSchema has a forEach method we can use
                const tempArray = [];
                state.players.forEach((player, key) => {
                  console.log(`Player with key ${key}:`, player);
                  // Make sure we extract all properties properly
                  tempArray.push({
                    sessionId: player.sessionId || key,
                    playerId: player.playerId,
                    name: player.name || 'Anonymous',
                    isReady: player.isReady || false,
                    isHost: player.isHost || false,
                    avatar: player.avatar,
                    call: player.call,
                    made: player.made,
                    score: player.score,
                    totalScore: player.totalScore,
                    elo: player.elo,
                    // Add any other properties you need
                    _raw: player // Keep the raw object for debugging
                  });
                });
                playersArray = tempArray;
              } else if (state.players instanceof Map) {
                playersArray = Array.from(state.players.entries()).map(([key, player]) => ({
                  sessionId: player.sessionId || key,
                  playerId: player.playerId,
                  name: player.name || 'Anonymous',
                  isReady: player.isReady || false,
                  isHost: player.isHost || false,
                  avatar: player.avatar,
                  // Add any other properties you need
                  _raw: player // Keep the raw object for debugging
                }));
              } else if (typeof state.players === 'object') {
                // Could be a plain object with values
                playersArray = Object.entries(state.players).map(([key, player]) => ({
                  sessionId: player.sessionId || key,
                  playerId: player.playerId,
                  name: player.name || 'Anonymous',
                  isReady: player.isReady || false,
                  isHost: player.isHost || false,
                  avatar: player.avatar,
                  // Add any other properties you need
                  _raw: player // Keep the raw object for debugging
                }));
              }
            } catch (error) {
              console.error('Error extracting players:', error);
            }
          }
          
          console.log('🔄 Players in state:', playersArray.map(p => {
            // Add more detailed logging to help debug
            console.log('Processed player object:', p);
            return p?.name || 'Unknown';
          }));
          
          // Find current player using the players array we just created
          const player = playersArray.find(
            p => p && (p.playerId === user.player_id || p.sessionId === colyseusService.currentSessionId)
          );
          
          console.log('🔍 Found current player:', player, 'User player_id:', user.player_id, 'Session ID:', colyseusService.currentSessionId);
          
          // Force a new object reference to ensure React re-renders
          setGameState({
            ...state,
            players: state.players || new Map(), // Keep original player data structure
            playersArray: playersArray,          // Add converted array for easy access
            phase: state.phase || 'waiting'      // Ensure phase is set, defaulting to 'waiting'
          });
          
          // Set current player and host status if we found a valid player
          if (player) {
            setCurrentPlayer(player);
            setIsHost(player.isHost || false);
            console.log('✅ Current player set:', player.name, 'isHost:', player.isHost);
          } else {
            console.warn('⚠️ Current player not found in player list!');
          }
          setIsConnecting(false);
        } catch (error) {
          console.error('❌ Error processing game state:', error, state);
          
          // Provide more detailed error info and create a safe fallback state
          let errorDetail = '';
          if (state) {
            errorDetail = `Has players: ${!!state.players}, phase: ${state.phase || 'none'}`;
          }
          console.warn(`State processing error details: ${errorDetail}`);
          
          // Create a fallback state that's safe to render
          setGameState({
            phase: 'waiting',
            gameStarted: false,
            players: state?.players || new Map(),
            playersArray: [],
            currentRound: 0,
            errorInfo: error.message
          });
          
          // Reset connection state
          setIsConnecting(false);
        }
      });

      // Set up message listeners for game events
      room.onMessage('welcome', (message) => {
        console.log('✅ Received welcome message:', message);
        // Ensure we mark the connection as established
        setIsConnected(true);
        setIsConnecting(false);
        
        // If we don't have a gameState yet, create a minimal one based on the welcome message
        if (!gameState) {
          setGameState(prevState => prevState || {
            phase: 'waiting',
            gameStarted: false,
            players: new Map(),
            playersArray: [{
              playerId: user.player_id,
              name: user.username,
              isHost: message.isHost,
              isReady: false
            }],
            currentRound: 0,
            roomName: message.roomName
          });
        }
      });

      room.onMessage('gameStarted', (message) => {
        console.log('Game started!', message);
      });
      
      room.onMessage('roundStarted', (message) => {
        console.log('New round started:', message);
      });

      room.onMessage('gameEnded', (message) => {
        console.log('Game ended:', message);
      });
      
      room.onMessage('hostChanged', (message) => {
        console.log('New host assigned:', message);
      });
      
      room.onMessage('playerJoined', (message) => {
        console.log('🎉 Player joined:', message.playerName);
      });

      room.onMessage('playerLeft', (message) => {
        console.log('👋 Player left:', message.playerName);
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
      });
      
      room.onMessage('phaseChanged', (message) => {
        console.log('🔄 Phase changed:', message.phase);
        setGameState((prevState) => ({
          ...prevState,
          phase: message.phase,
        }));
      });
      
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
  }, [roomId, user, gameState]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    let isMounted = true;
    let cleanupTimeout = null;    
    
    const initializeConnection = async () => {
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
      connectionAttemptRef.current = false;
      
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }
      
      // Only clean up if this component is unmounted completely, not just during navigation
      // Don't automatically disconnect when transitioning from lobby to game
      if (window.location.pathname.indexOf('/multiplayer') === -1) {
        cleanupTimeout = setTimeout(() => {
          if (colyseusService.currentRoom) {
            console.log('🧹 Cleaning up room connection on component unmount...');
            colyseusService.leaveCurrentRoom();
          }
        }, 500); // Longer timeout to ensure we don't disconnect during navigation
      }
    };
  }, [user, navigate, connectToGame]);

  const handlePlayerReady = () => {
    const newReadyState = !currentPlayer?.isReady;
    colyseusService.setPlayerReady(newReadyState);
  };

  const handleLeaveGame = () => {
    colyseusService.leaveCurrentRoom();
    navigate('/lobby');
  };

  // Show the pause confirmation modal (commented out until used)
  // const showPauseConfirmation = () => {
  //   setShowPauseModal(true);
  //   // Close any other open modals
  //   setShowGameMenuModal(false);
  // }

  if (error) {
    return (
      <div className="game-in-progress">
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
    );
  }
  
  // If not connected yet, but we're still initializing or connecting, show a loading state
  if (!isConnected || !gameState) {
    return (
      <div className="game-in-progress">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>{isConnecting ? 'Connecting to game...' : 'Loading game state...'}</p>
          {roomId === 'new' && (
            <p className="loading-hint">Setting up your new game room...</p>
          )}
          {roomId !== 'new' && (
            <p className="loading-hint">Joining game room, please wait...</p>
          )}
        </div>
      </div>
    );
  }
  
  // Safely handle players array, ensuring we always have a valid array
  const players = gameState.playersArray || 
    (gameState.players instanceof Map ? Array.from(gameState.players.values()) : 
      gameState.players ? Object.values(gameState.players) : []);
  
  const currentRound = gameState.currentRound || 0;
  // Default phase to 'waiting' if not set - this ensures the waiting screen shows immediately after creation
  const phase = gameState?.phase || 'waiting';
  
  // Always show waiting screen if game hasn't started or if we're in waiting phase
  const showWaitingScreen = phase === 'waiting' || !gameState?.gameStarted;

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
  
  // Calculate detailed stats
  const detailedStats = calculateDetailedGameStats(gameState);

  return (
    <div className={`game-in-progress players-${players.length} ${players.length > 3 ? 'many-players' : ''}`}>
      <div className="round-info">
        <span>
          Round {currentRound}/13 {phase && `- ${phase}`}
        </span>
        <span className="total-calls">
          Calls: {totalCalls} {phase === 'calling' ? `| ${(currentRound - totalCalls) < 0 ? 'free' : ''}` : ''}
        </span>
      </div>

      {showWaitingScreen && (
        <div className="waiting-phase">
          <h2>Waiting for Players</h2>
          <p className="game-room-info">
            {gameState.roomName && <span>Room: {gameState.roomName}</span>}
            <span>Players: {players.length}/{gameState.maxPlayers || 4}</span>
          </p>
          <p className="ready-instruction">All players must click "Ready Up" before the game can start.</p>

          {/* Display player list with ready status */}
          <div className="waiting-players">
            {players.length === 0 ? (
              <div className="no-players-message">
                <p>No players have joined yet. Share the room link with friends to invite them.</p>
              </div>
            ) : (
              players.map(player => {
                // Debug log to see the exact structure of the player object
                console.log('Rendering player:', player);
                
                // Check if this player is the current user by either player ID or session ID
                const isCurrentPlayer = player?.playerId === user.player_id || 
                                      player?.sessionId === colyseusService.currentSessionId;
                
                return (
                  <div key={player?.sessionId || player?.playerId || Math.random().toString()} 
                       className={`waiting-player ${player?.isReady ? 'ready' : 'not-ready'} ${isCurrentPlayer ? 'current-player' : ''}`}>
                    <span className="player-name">
                      {player?.name || 'Unknown Player'} 
                      {isCurrentPlayer && <span className="you-badge">(You)</span>}
                    </span>
                    {player?.isHost && <span className="host-badge">HOST</span>}
                    <span className={`ready-status ${player?.isReady ? 'ready' : 'not-ready'}`}>
                      {player?.isReady ? '✓ Ready' : '• Not Ready'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Ready button for current player */}
          <div className="waiting-controls">
            <button 
              onClick={handlePlayerReady} 
              className={`ready-button ${currentPlayer?.isReady ? 'ready' : 'not-ready'}`}
            >
              {currentPlayer?.isReady ? 'Not Ready' : 'Ready Up'}
            </button>
          
            {/* Host controls */}
            {isHost && (
              <div className="host-controls">
                <button 
                  onClick={() => colyseusService.randomizePlayerOrder()}
                  className="randomize-button"
                  disabled={gameState.gameStarted}
                >
                  🎲 Randomize Player Order
                </button>
                <button 
                  onClick={() => colyseusService.startGame()}
                  className="start-game-button"
                  disabled={players.length < 2 || players.some(p => p && !p.isReady)}
                >
                  Start Game
                </button>
              </div>
            )}
            
            <button onClick={handleLeaveGame} className="leave-button">
              Leave Game
            </button>
          </div>
          
          {/* Room Link for sharing */}
          <div className="room-link-container">
            <p>Share this link with friends:</p>
            <div className="copy-link-container">
              <input 
                type="text" 
                readOnly 
                value={window.location.href} 
                className="room-link-input"
              />
              <button 
                className="copy-link-button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  // Could add a toast notification here
                  alert('Room link copied to clipboard!');
                }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'game' && !showWaitingScreen && (
        <div className="tab-panel">
          <div className="player-scores">
            <table className="score-table">
              <tbody>
              {orderedPlayers.map((player, orderIndex) => {
                const isCurrentPlayer = player.playerId === user.player_id;
                const isDealer = orderIndex === dealerIndex;
                const isCurrentUserHost = isHost;
                
                return (
                  <tr key={player.sessionId || player.playerId} className={`player-row ${isCurrentPlayer ? 'current-player' : ''}`}>
                    <td className="player-cell">
                      {player.name || player.playerName}
                      <div className="player-badges">
                        {player.isHost && <span className="host-badge">HOST</span>}
                        {isDealer && <span className="dealer-badge">🃏 Dealer</span>}
                        {currentTurnPlayer?.playerId === player.playerId && phase === 'calling' && (
                          <span className="turn-indicator">Your Turn</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {phase === 'calling' && (isCurrentUserHost || currentTurnPlayer?.playerId === player.playerId) ? (
                        <input
                          type="tel"
                          className="rounds-input"
                          value={player.call !== null ? player.call : ''}
                          placeholder="0"
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            if (isCurrentUserHost) {
                              // Add bypass turn order flag for host calls
                              colyseusService.makeCall(value, player.playerId, true);
                            } else if (currentTurnPlayer?.playerId === user.player_id) {
                              colyseusService.makeCall(value);
                            }
                          }}
                          min={0}
                          max={currentRound}
                          title={`${player.name}'s Call`}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          disabled={currentTurnPlayer?.playerId !== user.player_id && !isHost}
                        />
                      ) : (
                        <span>{player.call !== null ? player.call : '-'}</span>
                      )}
                    </td>
                    <td>
                      {phase === 'playing' && player.playerId === user.player_id ? (
                        <input
                          type="tel"
                          className="rounds-input"
                          value={player.made !== null ? player.made : ''}
                          placeholder="0"
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            colyseusService.reportTricks(value);
                          }}
                          min={0}
                          max={currentRound}
                          title={`${player.name}'s Tricks Made`}
                          inputMode="numeric"
                          pattern="[0-9]*"
                        />
                      ) : (
                        <span>{player.made !== null ? player.made : '-'}</span>
                      )}
                    </td>
                    <td>
                      <div className="score">
                        <span className="total-score">
                          {player.totalScore !== null ? player.totalScore : 0}
                        </span>
                        {player.roundScore !== null && player.roundScore !== 0 && (
                          <span
                            className={
                              player.roundScore > 0
                                ? "round-score positive"
                                : "round-score negative"
                            }
                          >
                            {player.roundScore > 0 ? `+${player.roundScore}` : player.roundScore}
                          </span>
                        )}
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

      {activeTab === 'stats' && (
        <div className="tab-panel">
          <div className="game-stats-container">
            <h2>Player Statistics</h2>
            
            <div className="stats-subtabs">
              <button 
                className={`stats-subtab-btn ${statsSubTab === 'chart' ? 'active' : ''}`}
                onClick={() => setStatsSubTab('chart')}
              >
                Charts
              </button>
              <button 
                className={`stats-subtab-btn ${statsSubTab === 'details' ? 'active' : ''}`}
                onClick={() => setStatsSubTab('details')}
              >
                Player Details
              </button>
            </div>
            
            {statsSubTab === 'chart' ? (
              <StatsChart 
                playersData={detailedStats} 
                roundData={gameState.roundHistory || []} 
              />
            ) : (
              <div className="results-table">
                {detailedStats.map((playerStats, index) => (
                  <div key={playerStats.id} className="results-row">
                    <div className="rank-col">{index + 1}</div>
                    <div className="player-col">
                      <div className="player-info">
                        <span>{playerStats.name}</span>
                      </div>
                    </div>
                    <div className="score-col">{playerStats.totalPoints || 0}</div>
                    <button className="adv-stats-btn" onClick={() => togglePlayerStats(playerStats.id)}>
                      {selectedPlayerId === playerStats.id ? 'Hide Stats' : 'Adv. Stats'}
                    </button>
                    
                    {selectedPlayerId === playerStats.id && (
                      <div className="advanced-stats">
                        <div className="stats-section">
                          <div className="stats-section-title">Game Performance</div>
                          <div className="stats-cards" id="game-performance">
                            <p>Total Points: <span>{playerStats.totalPoints}</span></p>
                            <p>Highest Round: <span>{Math.round(playerStats.bestRound)}</span></p>
                            <p>Correct Bids: <span>{Math.round(playerStats.correctBids)}</span></p>
                            <p>Total Tricks Won: <span>{Math.round(playerStats.totalTricks || playerStats.avgTricks * playerStats.roundsPlayed)}</span></p>
                          </div>
                        </div>

                        <div className="stats-section">
                          <div className="stats-section-title">Bidding Precision</div>
                          <div className="stats-cards">
                            <PerformanceMetric 
                              label="Average Score" 
                              value={playerStats.avgPointsPerRound} 
                              targetMin={20} 
                              targetMax={30}
                              isBadWhenAboveMax={false}
                            />
                            <PerformanceMetric 
                              label="Bid Accuracy" 
                              value={parseFloat(playerStats.bidAccuracy || 0)} 
                              targetMin={50} 
                              targetMax={80}
                              isPercentage={true}
                              isBadWhenAboveMax={false} 
                            />
                          </div>
                        </div>

                        <div className="stats-section">
                          <div className="stats-section-title">Bidding Tendency</div>
                          <div className="stats-cards">
                            <div className="bidding-style-card">
                              <div className="bidding-style-value">
                                {(() => {
                                  const overbids = playerStats.overBids || 0;
                                  const underbids = playerStats.underBids || 0;
                                  const correctBids = playerStats.correctBids || 0;
                                  const totalBids = overbids + underbids + correctBids;
                                  
                                  if (totalBids === 0) return <span className="no-data">No Data</span>;
                                  
                                  // Calculate percentages
                                  const correctBidPercent = totalBids > 0 ? (correctBids / totalBids) * 100 : 0;
                                  const overBidPercent = totalBids > 0 ? (overbids / totalBids) * 100 : 0;
                                  const underBidPercent = totalBids > 0 ? (underbids / totalBids) * 100 : 0;
                                  
                                  // Determine bidding quality based on correct bid percentage
                                  let biddingQuality = '';
                                  let biddingClass = '';
                                  
                                  if (correctBidPercent > 75) {
                                    biddingQuality = 'Bidding: Excellent';
                                    biddingClass = 'excellent-bidding';
                                  } else if (correctBidPercent >= 60) {
                                    biddingQuality = 'Bidding: Good';
                                    biddingClass = 'good-bidding';
                                  } else if (correctBidPercent >= 45) {
                                    biddingQuality = 'Bidding: Okay';
                                    biddingClass = 'okay-bidding';
                                  } else if (correctBidPercent >= 30) {
                                    biddingQuality = 'Bidding: Poorly';
                                    biddingClass = 'poor-bidding';
                                  } else {
                                    biddingQuality = 'Bidding: Badly';
                                    biddingClass = 'bad-bidding';
                                  }
                                  
                                  // Add bidding tendency descriptor
                                  let biddingTendency = '';
                                  if (overBidPercent > 25 && overBidPercent > underBidPercent) {
                                    biddingTendency = ' (Tends to Overbid)';
                                  } else if (underBidPercent > 25 && underBidPercent > overBidPercent) {
                                    biddingTendency = ' (Tends to Underbid)';
                                  } else if (overBidPercent === underBidPercent && overBidPercent > 15) {
                                    biddingTendency = ' (Mixed Errors)';
                                  }
                                  
                                  return (
                                    <div>
                                      <span className={biddingClass}>
                                        {biddingQuality}
                                      </span>
                                      {biddingTendency && (
                                        <span className="bidding-tendency">{biddingTendency}</span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                              
                              {/* Visual mini-progress bar for correct bids percentage */}
                              {(() => {
                                const overbids = playerStats.overBids || 0;
                                const underbids = playerStats.underBids || 0;
                                const correctBids = playerStats.correctBids || 0;
                                const totalBids = overbids + underbids + correctBids;
                                
                                const correctBidPercent = totalBids > 0 ? Math.round((correctBids / totalBids) * 100) : 0;
                                const overBidPercent = totalBids > 0 ? Math.round((overbids / totalBids) * 100) : 0;
                                const underBidPercent = totalBids > 0 ? Math.round((underbids / totalBids) * 100) : 0;
                                
                                return (
                                  <div className="bid-distribution-bar">
                                    <div className="bid-segment correct-segment" style={{ width: `${correctBidPercent}%` }}></div>
                                    <div className="bid-segment over-segment" style={{ width: `${overBidPercent}%` }}></div>
                                    <div className="bid-segment under-segment" style={{ width: `${underBidPercent}%` }}></div>
                                  </div>
                                );
                              })()}
                              
                              <div className="bidding-stats">
                                <span className="bid-stat correct">{playerStats.correctBids} correct</span> •
                                <span className="bid-stat over">{playerStats.overBids} over</span> •
                                <span className="bid-stat under">{playerStats.underBids} under</span>
                              </div>
                            </div>
                            <PerformanceMetric 
                              label="Average Deviation" 
                              value={playerStats.avgDiff} 
                              targetMin={0}
                              targetMax={0.25}
                              isBadWhenAboveMax={true}
                            />
                          </div>
                        </div>
                        
                        <div className="stats-section">
                          <div className="stats-section-title">Additional Stats</div>
                          <div className="stats-cards">
                            <div className="additional-stats">
                              <div className="stat-row">
                                <span className="stat-label">Best Bidding Streak:</span>
                                <span className="stat-value">{playerStats.maxConsecutiveCorrect}</span>
                              </div>
                              <div className="stat-row">
                                <span className="stat-label">Worst Round:</span>
                                <span className="stat-value negative">{playerStats.worstRound}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Section with Controls */}
      <div className="game-bottom-section">
        {/* Toggle Button for Game Board / Player Stats */}
        <div className="toggle-section">
          <button
            className="game-control-btn"
            onClick={() => setActiveTab(activeTab === 'game' ? 'stats' : 'game')}
          >
            {activeTab === 'game' ? <BarChartIcon size={27} /> : <GamepadIcon size={27} />}
          </button>
        </div>

        <div className="game-controls">
          <button 
            className="game-control-btn pause-btn"
            onClick={() => setShowGameMenuModal(true)}
            title="Game Menu"
          >
            <MenuIcon size={27} />
          </button>
        </div>

        {/* Phase-specific controls for host */}
        {isHost && phase === 'playing' && (
          <button 
            className="nav-btn"
            onClick={() => colyseusService.endRound()}
            title="End Round"
          >
            <ArrowRight />
          </button>
        )}
        
        {isHost && phase === 'scoring' && (
          <button 
            className="nav-btn"
            onClick={() => colyseusService.nextRound()}
            title="Next Round"
          >
            <ArrowRight />
          </button>
        )}
      </div>

      {/* Game Menu Modal */}
      <GameMenuModal
        isOpen={showGameMenuModal}
        onClose={() => setShowGameMenuModal(false)}
        onLeaveGame={() => {
          setShowGameMenuModal(false);
          handleLeaveGame();
        }}
        // Disable other options for multiplayer game
        disableSave={true}
        disableLoad={true}
        disablePause={true}
      />
    </div>
  );
};

export default MultiplayerGame;
