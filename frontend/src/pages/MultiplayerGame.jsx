import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import colyseusService from '../services/colyseusClient';
import { useAuth } from '../hooks/useAuth';
import './MultiplayerGame.css';

const MultiplayerGame = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [isHost, setIsHost] = useState(false);
  // Game action states
  const [callInput, setCallInput] = useState('');
  const [tricksInput, setTricksInput] = useState('');

  const connectToGame = useCallback(async () => {
    try {
      setError(null);
      
      // Set player data
      colyseusService.setPlayerData({
        id: user.player_id,
        name: user.username
      });

      let room;
      if (roomId && roomId !== 'new') {
        // Join existing room
        room = await colyseusService.joinGameRoom(roomId);
      } else {
        // Create new room or quick join
        room = await colyseusService.quickJoinGame();
      }

      setIsConnected(true);

      // Set up state listeners
      room.onStateChange((state) => {
        console.log('Game state updated:', state);
        setGameState(state);
        
        // Find current player
        const player = Array.from(state.players.values()).find(
          p => p.playerId === user.player_id
        );
        setCurrentPlayer(player);
        
        // Check if current user is host
        setIsHost(state.hostId === user.player_id);
      });

      // Listen for game events
      room.onMessage('gameStarted', (message) => {
        console.log('Game started!', message);
      });

      room.onMessage('roundStarted', (message) => {
        console.log('New round started:', message);
        setCallInput('');
        setTricksInput('');
      });

      room.onMessage('gameEnded', (message) => {
        console.log('Game ended:', message);
        // Could show final scores modal here
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

    } catch (error) {
      console.error('Failed to connect to game:', error);
      setError('Failed to connect to game: ' + error.message);
    }
  }, [roomId, user]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    connectToGame();

    return () => {
      colyseusService.leaveCurrentRoom();
    };
  }, [user, connectToGame, navigate]);

  const handlePlayerReady = () => {
    const newReadyState = !currentPlayer?.ready;
    colyseusService.setPlayerReady(newReadyState);
  };

  const handleStartGame = () => {
    if (isHost) {
      colyseusService.startGame();
    }
  };

  const handleMakeCall = () => {
    const call = parseInt(callInput);
    if (isNaN(call) || call < 0) {
      setError('Please enter a valid call (0 or higher)');
      return;
    }
    
    colyseusService.makeCall(call);
    setCallInput('');
  };

  const handleMakeTricks = () => {
    const tricks = parseInt(tricksInput);
    if (isNaN(tricks) || tricks < 0) {
      setError('Please enter a valid number of tricks (0 or higher)');
      return;
    }
    
    colyseusService.makeTricks(tricks);
    setTricksInput('');
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
    );
  }

  if (!isConnected || !gameState) {
    return (
      <div className="game-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Connecting to game...</p>
        </div>
      </div>
    );
  }

  const players = Array.from(gameState.players.values());
  const currentRound = gameState.currentRound;
  const phase = gameState.phase;
  const canMakeCall = phase === 'calling' && currentPlayer && !currentPlayer.hasCall;
  const canMakeTricks = phase === 'playing' && currentPlayer && !currentPlayer.hasTricks;

  return (
    <div className="game-container">
      <header className="game-header">
        <div className="game-info">
          <h1>Wizard Tracker - Multiplayer Game</h1>
          <div className="game-stats">
            <span>Round: {currentRound}/13</span>
            <span>Phase: {phase}</span>
            <span>Players: {players.length}</span>
          </div>
        </div>        <div className="game-actions">
          <button onClick={handleLeaveGame} className="leave-button">
            🚪 Leave Game
          </button>
        </div>
      </header>

      <div className="game-content">
        {/* Game Status */}
        <div className="game-status">
          {phase === 'waiting' && (
            <div className="waiting-phase">
              <h2>Waiting for Players</h2>
              <p>Waiting for all players to be ready...</p>
              {isHost && (
                <button 
                  onClick={handleStartGame}
                  className="start-game-button"
                  disabled={players.some(p => !p.ready)}
                >
                  Start Game
                </button>
              )}
            </div>
          )}

          {phase === 'calling' && (
            <div className="calling-phase">
              <h2>Calling Phase - Round {currentRound}</h2>
              <p>Players are making their calls for this round...</p>
            </div>
          )}

          {phase === 'playing' && (
            <div className="playing-phase">
              <h2>Playing Phase - Round {currentRound}</h2>
              <p>Round in progress. Report your tricks when finished!</p>
            </div>
          )}

          {phase === 'ended' && (
            <div className="ended-phase">
              <h2>Game Complete!</h2>
              <p>Final scores have been calculated.</p>
            </div>
          )}
        </div>

        {/* Players List */}
        <div className="players-section">
          <h3>Players</h3>
          <div className="players-grid">
            {players.map((player) => (
              <div 
                key={player.playerId} 
                className={`player-card ${player.playerId === user.player_id ? 'current-player' : ''}`}
              >
                <div className="player-info">
                  <h4>
                    {player.playerName}
                    {player.playerId === gameState.hostId && <span className="host-badge">👑</span>}
                    {player.playerId === user.player_id && <span className="you-badge">(You)</span>}
                  </h4>
                  <div className="player-status">
                    <span className={`ready-status ${player.ready ? 'ready' : 'not-ready'}`}>
                      {player.ready ? '✅ Ready' : '⏳ Not Ready'}
                    </span>
                  </div>
                </div>
                
                <div className="player-game-info">
                  <div className="score">Score: {player.totalScore}</div>
                  
                  {currentRound > 0 && (
                    <div className="round-info">
                      <div className="call">
                        Call: {player.call !== undefined ? player.call : '-'}
                      </div>
                      <div className="tricks">
                        Tricks: {player.tricks !== undefined ? player.tricks : '-'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Game Actions */}
        {currentPlayer && (
          <div className="game-actions-section">
            {phase === 'waiting' && (
              <div className="ready-section">
                <button 
                  onClick={handlePlayerReady}
                  className={`ready-button ${currentPlayer.ready ? 'ready' : 'not-ready'}`}
                >
                  {currentPlayer.ready ? '✅ Ready' : '⏳ Set Ready'}
                </button>
              </div>
            )}

            {canMakeCall && (
              <div className="call-section">
                <h4>Make Your Call for Round {currentRound}</h4>
                <div className="input-group">
                  <input
                    type="number"
                    min="0"
                    max={currentRound}
                    value={callInput}
                    onChange={(e) => setCallInput(e.target.value)}
                    placeholder="Enter your call"
                    className="call-input"
                  />
                  <button onClick={handleMakeCall} className="submit-button">
                    Submit Call
                  </button>
                </div>
                <p className="help-text">
                  Call how many tricks you think you'll take (0-{currentRound})
                </p>
              </div>
            )}

            {canMakeTricks && (
              <div className="tricks-section">
                <h4>Report Your Tricks for Round {currentRound}</h4>
                <div className="input-group">
                  <input
                    type="number"
                    min="0"
                    max={currentRound}
                    value={tricksInput}
                    onChange={(e) => setTricksInput(e.target.value)}
                    placeholder="Enter tricks taken"
                    className="tricks-input"
                  />
                  <button onClick={handleMakeTricks} className="submit-button">
                    Submit Tricks
                  </button>
                </div>
                <p className="help-text">
                  How many tricks did you actually take?
                </p>
              </div>
            )}
          </div>
        )}

        {/* Scores Table */}
        {gameState.rounds && gameState.rounds.length > 0 && (
          <div className="scores-section">
            <h3>Score History</h3>
            <div className="scores-table">
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
                        const playerCall = round.calls?.get?.(player.playerId) ?? '-';
                        const playerTricks = round.tricks?.get?.(player.playerId) ?? '-';
                        const playerScore = round.scores?.get?.(player.playerId) ?? '-';
                        
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
