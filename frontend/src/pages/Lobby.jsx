import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import colyseusService from '../services/colyseusClient';
import { roomAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import '../styles/Lobby.css';

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
    maxPlayers: 3,
    gameMode: 'classic',
    isPrivate: false,
    password: ''
  });
  
  const initializeLobby = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Set player data for Colyseus
      colyseusService.setPlayerData({
        id: user.player_id,
        name: user.username
      });      // Fetch active rooms from database
      const fetchActiveRooms = async () => {
        try {
          const rooms = await roomAPI.getActive();
          setAvailableRooms(rooms);
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
      setError(null);      const settings = {
        ...gameSettings,
        roomName: `${user.username}'s Game`,
        hostId: String(user.player_id),
        hostName: user.username
      };      // Create game room directly
      const room = await colyseusService.createGameRoomWithTracking(settings);
      
      if (room && room.sessionId) {
        console.log('Room created successfully, navigating to:', room.sessionId);
        
        // Wait a bit to ensure room is fully ready and DB is updated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        navigate(`/multiplayer/${room.sessionId}`);
      } else {
        throw new Error('Room was not properly created or missing session ID');
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
      
      // If it's a "room no longer available" error, refresh the room list
      if (error.message && (error.message.includes('no longer available') || error.message.includes('not found'))) {
        console.log('🔄 Refreshing room list due to stale room...');
        refreshRooms();
        setError('This room is no longer available. The room list has been refreshed.');
      } else {
        setError('Failed to join game: ' + error.message);
      }
    }
  };

  // Uncomment if you want to implement quick join functionality
  // const handleQuickJoin = async () => {
  //   try {
  //     await colyseusService.quickJoinGame();
  //     // Navigation will be handled by the game room connection
  //   } catch (error) {
  //     console.error('Quick join failed:', error);
  //     setError('No available games to join. Try creating one!');
  //   }
  // };
    
  const refreshRooms = async () => {
    try {
      const rooms = await roomAPI.getActive();
      setAvailableRooms(rooms);
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
      <div className="lobby-content">
        <div className="lobby-sections">
          <section className="available-rooms">
            <h2>Available Games</h2>
            {availableRooms.length === 0 ? (
              <div className="empty-state">
                <p>No Games Available. Why Not Create One?</p>
              </div>
            ) : (
              <div className="rooms-list">
                {availableRooms.map((room) => (
                  <div key={room.room_id || room.roomId} className="room-card">
                    <div className="room-info">
                      <h3 className="room-name">
                        {(room.room_name || room.name || `${room.host_name || room.hostName}'s Game`).replace(/\b\w/g, c => c.toUpperCase())}
                        {room.is_private && <span className="private-indicator">🔒</span>}
                      </h3>
                      <div className="room-details">
                        <span className="player-count">
                          {(room.current_players || room.playerCount || 0)}/{room.max_players || room.maxPlayers || 0}
                        </span>
                        <span className="game-mode">
                          {(room.game_mode || room.gameMode || '').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span className="room-status">
                          {room.status === 'waiting' ? 'Waiting' : 
                           room.status === 'playing' ? 'In Progress' : 'Ready'}
                        </span>
                      </div>
                    </div>
                    <div className="room-actions">
                      <button
                        className="join-room-btn"
                        onClick={() => handleJoinGame(room.room_id || room.roomId, room.is_private || room.isPrivate)}
                        disabled={((room.current_players || room.playerCount || 0) >= (room.max_players || room.maxPlayers || 0)) || room.status === 'playing'}
                      >
                        {((room.current_players || room.playerCount || 0) >= (room.max_players || room.maxPlayers || 0)) ? 'Full' : 'Join'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
          </section>
          
          <div className="lobby-actions">
          <button 
            className="create-game-btn primary-button"
            onClick={() => setShowCreateModal(true)}
          >
            Create New Game
          </button>
        </div>

          <section className="online-players">
            <h2>Online Players</h2>            
            <div className="players-list">
              {onlinePlayers.map((player, index) => (
                <div key={`player-${player.playerId || player.id || index}-${player.sessionId || ''}`} className="player-item">
                  <span className="player-name">{(player.playerName || player.name || '').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  {/* <span className={`player-status ${player.status}`}>
                    {player.status === 'browsing' ? 'Browsing' :
                     player.status === 'in_game' ? 'In Game' :
                     player.status === 'creating' ? 'Creating' : 'Ready'}
                  </span> */}
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
                {/* <label htmlFor="gameMode">Game Mode</label> */}
                <select
                  id="gameMode"
                  value={gameSettings.gameMode}
                  onChange={(e) => setGameSettings(prev => ({ ...prev, gameMode: e.target.value }))}
                >
                  <option value="classic">Classic</option>
                  <option value="ranked">Ranked</option>
                  <option value="quick">Quick Game</option>
                  <option value="tournament">Tournament</option>
                </select>
              </div>

              <div className="form-group">
                {/* <label htmlFor="maxPlayers">Player Count</label> */}
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
                    placeholder="Enter Password For Private Game"
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
