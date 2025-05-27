import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import colyseusService from '../services/colyseusClient';
import { useAuth } from '../hooks/useAuth';
import './Lobby.css';

const Lobby = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [availableRooms, setAvailableRooms] = useState([]);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Game creation form state
  const [gameSettings, setGameSettings] = useState({
    maxPlayers: 4,
    gameMode: 'classic',
    isPrivate: false,
    password: '',
    gameName: ''
  });  const initializeLobby = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Set player data for Colyseus
      colyseusService.setPlayerData({
        id: user.player_id,
        name: user.username
      });

      // Fetch active rooms from database
      const fetchActiveRooms = async () => {
        try {
          const response = await fetch('/api/rooms/active', {
            credentials: 'include'
          });
          if (response.ok) {
            const rooms = await response.json();
            setAvailableRooms(rooms);
          }
        } catch (error) {
          console.error('Failed to fetch active rooms:', error);
        }
      };

      // Initial fetch
      await fetchActiveRooms();      // Join the lobby for real-time updates
      const lobbyRoom = await colyseusService.joinLobbyWithTracking();

      // Set up state listeners
      lobbyRoom.onStateChange((state) => {
        // For now, we'll primarily use database rooms
        setOnlinePlayers(Array.from(state.players.values()));
      });

      // Periodically refresh rooms from database
      const roomRefreshInterval = setInterval(fetchActiveRooms, 10000); // Every 10 seconds

      // Listen for errors
      lobbyRoom.onMessage('error', (message) => {
        console.error('Lobby error:', message);
        setError(message.error);
      });

      lobbyRoom.onError((code, message) => {
        console.error('Lobby connection error:', code, message);
        setError('Connection error: ' + message);
      });

      lobbyRoom.onLeave((code) => {
        console.log('Left lobby:', code);
        clearInterval(roomRefreshInterval);
      });

      setIsLoading(false);
      
      // Store interval for cleanup
      return () => {
        clearInterval(roomRefreshInterval);
      };
    } catch (error) {
      console.error('Failed to initialize lobby:', error);
      setError('Failed to connect to lobby: ' + error.message);
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    initializeLobby();

    // Cleanup on unmount
    return () => {
      colyseusService.leaveLobby();
    };
  }, [user, navigate, initializeLobby]);
  const handleCreateGame = async () => {
    try {
      setError(null);
      const settings = {
        ...gameSettings,
        roomName: gameSettings.gameName || `${user.username}'s Game`,
        hostId: user.player_id,
        hostName: user.username
      };      // Create game room directly
      const room = await colyseusService.createGameRoomWithTracking(settings);
      
      if (room) {
        console.log('Room created successfully, navigating...');
        navigate(`/multiplayer/${room.sessionId}`);
      }
      
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create game:', error);
      setError('Failed to create game: ' + error.message);
    }
  };
  const handleJoinGame = async (roomId, hasPassword = false) => {
    try {
      setError(null);
      let password = null;
      
      if (hasPassword) {
        password = prompt('Enter room password:');
        if (!password) return;
      }
      
      const room = await colyseusService.joinGameRoomWithTracking(roomId, password);
      
      if (room) {
        console.log('Joined room successfully, navigating...');
        navigate(`/multiplayer/${room.sessionId}`);
      }
    } catch (error) {
      console.error('Failed to join game:', error);
      setError('Failed to join game: ' + error.message);
    }
  };

  const handleQuickJoin = async () => {
    try {
      await colyseusService.quickJoinGame();
      // Navigation will be handled by the game room connection
    } catch (error) {
      console.error('Quick join failed:', error);
      setError('No available games to join. Try creating one!');
    }
  };
  const refreshRooms = async () => {
    try {
      const response = await fetch('/api/rooms/active', {
        credentials: 'include'
      });
      if (response.ok) {
        const rooms = await response.json();
        setAvailableRooms(rooms);
      }
    } catch (error) {
      console.error('Failed to refresh rooms:', error);
      setError('Failed to refresh rooms');
    }
  };

  if (isLoading) {
    return (
      <div className="lobby-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Connecting to lobby...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lobby-container">
        <div className="error-message">
          <h3>Connection Error</h3>
          <p>{error}</p>
          <button onClick={initializeLobby} className="retry-button">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      <header className="lobby-header">
        <h1>Wizard Tracker - Multiplayer Lobby</h1>
        <div className="lobby-stats">
          <span className="online-count">
            👥 {onlinePlayers.length} players online
          </span>
          <span className="room-count">
            🎮 {availableRooms.length} games available
          </span>
        </div>
      </header>

      <div className="lobby-content">
        <div className="lobby-actions">
          <button 
            className="create-game-btn primary-button"
            onClick={() => setShowCreateModal(true)}
          >
            🎯 Create New Game
          </button>
          <button 
            className="quick-join-btn secondary-button"
            onClick={handleQuickJoin}
          >
            ⚡ Quick Join
          </button>
          <button 
            className="refresh-btn tertiary-button"
            onClick={refreshRooms}
          >
            🔄 Refresh
          </button>
        </div>

        <div className="lobby-sections">
          <section className="available-rooms">
            <h2>Available Games</h2>
            {availableRooms.length === 0 ? (
              <div className="empty-state">
                <p>No games available. Why not create one?</p>
              </div>
            ) : (
              <div className="rooms-list">
                {availableRooms.map((room) => (
                  <div key={room.roomId} className="room-card">
                    <div className="room-info">
                      <h3 className="room-name">
                        {room.name || `${room.hostName}'s Game`}
                        {room.isPrivate && <span className="private-indicator">🔒</span>}
                      </h3>
                      <div className="room-details">
                        <span className="player-count">
                          👥 {room.playerCount}/{room.maxPlayers}
                        </span>
                        <span className="game-mode">
                          🎮 {room.gameMode}
                        </span>
                        <span className="room-status">
                          {room.status === 'waiting' ? '⏳ Waiting' : 
                           room.status === 'playing' ? '🎯 In Progress' : '✅ Ready'}
                        </span>
                      </div>
                      <p className="host-name">Host: {room.hostName}</p>
                    </div>
                    <div className="room-actions">
                      <button
                        className="join-room-btn"
                        onClick={() => handleJoinGame(room.roomId, room.isPrivate)}
                        disabled={room.playerCount >= room.maxPlayers || room.status === 'playing'}
                      >
                        {room.playerCount >= room.maxPlayers ? 'Full' : 'Join'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="online-players">
            <h2>Online Players</h2>
            <div className="players-list">
              {onlinePlayers.map((player) => (
                <div key={player.playerId} className="player-item">
                  <span className="player-name">{player.playerName}</span>
                  <span className={`player-status ${player.status}`}>
                    {player.status === 'browsing' ? '👀 Browsing' :
                     player.status === 'in_game' ? '🎮 In Game' :
                     player.status === 'creating' ? '🛠️ Creating' : '⭐ Ready'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Create Game Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Game</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateGame(); }}>
              <div className="form-group">
                <label htmlFor="gameName">Game Name (optional)</label>
                <input
                  type="text"
                  id="gameName"
                  value={gameSettings.gameName}
                  onChange={(e) => setGameSettings(prev => ({ ...prev, gameName: e.target.value }))}
                  placeholder="Enter a name for your game"
                />
              </div>

              <div className="form-group">
                <label htmlFor="maxPlayers">Max Players</label>
                <select
                  id="maxPlayers"
                  value={gameSettings.maxPlayers}
                  onChange={(e) => setGameSettings(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) }))}
                >
                  <option value={2}>2 Players</option>
                  <option value={3}>3 Players</option>
                  <option value={4}>4 Players</option>
                  <option value={5}>5 Players</option>
                  <option value={6}>6 Players</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="gameMode">Game Mode</label>
                <select
                  id="gameMode"
                  value={gameSettings.gameMode}
                  onChange={(e) => setGameSettings(prev => ({ ...prev, gameMode: e.target.value }))}
                >
                  <option value="classic">Classic</option>
                  <option value="quick">Quick Game</option>
                  <option value="tournament">Tournament</option>
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={gameSettings.isPrivate}
                    onChange={(e) => setGameSettings(prev => ({ ...prev, isPrivate: e.target.checked }))}
                  />
                  Private Game
                </label>
              </div>

              {gameSettings.isPrivate && (
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    value={gameSettings.password}
                    onChange={(e) => setGameSettings(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password for private game"
                    required
                  />
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)} className="cancel-button">
                  Cancel
                </button>
                <button type="submit" className="create-button">
                  Create Game
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;
