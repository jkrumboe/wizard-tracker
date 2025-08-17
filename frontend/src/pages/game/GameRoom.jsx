import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { lobbyService } from '@/shared/api/lobbyService';
import '@/styles/pages/GameRoom.css';
import '@/styles/pages/GameRoom.css';

const GameRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const loadRoomData = async () => {
      setLoading(true);
      try {
        const [roomResponse, membersResponse] = await Promise.all([
          lobbyService.getRoom(roomId),
          lobbyService.getRoomMembers(roomId)
        ]);

        if (!roomResponse.success) {
          setError('Room not found');
          return;
        }

        if (!membersResponse.success) {
          setError('Failed to load room members');
          return;
        }

        setRoom(roomResponse.room);
        setMembers(membersResponse.members);

        // Check if current user is ready
        const currentUserMember = membersResponse.members.find(m => m.user_id === user.$id);
        if (currentUserMember) {
          setIsReady(currentUserMember.is_ready);
        }

        // If room is starting, redirect to game
        if (roomResponse.room.status === 'starting') {
          navigate(`/multiplayer/${roomId}`);
        }
      } catch {
        setError('Failed to load room data');
      } finally {
        setLoading(false);
      }
    };

    const handleRoomUpdate = () => {
      // Refresh room data when updates occur
      loadRoomData();
    };

    loadRoomData();
    
    // Subscribe to real-time updates
    const unsubscribe = lobbyService.subscribeToRoom(roomId, handleRoomUpdate);
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, roomId, navigate]);

  const handleToggleReady = async () => {
    try {
      const response = await lobbyService.toggleReady(roomId);
      if (response.success) {
        setIsReady(response.isReady);
      } else {
        setError(response.error);
      }
    } catch {
      setError('Failed to toggle ready status');
    }
  };

  const handleStartGame = async () => {
    try {
      const response = await lobbyService.startGame(roomId);
      if (response.success) {
        // Game will start, navigation will happen via room update
      } else {
        setError(response.error);
      }
    } catch {
      setError('Failed to start game');
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await lobbyService.leaveRoom(roomId);
      navigate('/lobby');
    } catch {
      setError('Failed to leave room');
    }
  };

  if (loading) {
    return (
      <div className="game-room">
        <div className="room-container">
          <div className="loading">Loading room...</div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="game-room">
        <div className="room-container">
          <div className="error-message">
            <h2>Room Not Found</h2>
            <p>The room you're looking for doesn't exist or has been deleted.</p>
            <button onClick={() => navigate('/lobby')} className="btn btn-primary">
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isHost = room.host_id === user.$id;
  const allPlayersReady = members.length > 1 && members.every(member => member.is_ready);

  return (
    <div className="game-room">
      <div className="room-container">
        <div className="room-header">
          <h1>{room.room_name}</h1>
          <div className="room-info">
            <span className="room-id">Room ID: {roomId}</span>
            <span className="room-status">Status: {room.status}</span>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')} className="close-btn">×</button>
          </div>
        )}

        <div className="room-content">
          <div className="players-section">
            <h3>Players ({members.length}/{room.max_players})</h3>
            <div className="players-list">
              {members.map((member) => (
                <div key={member.$id} className={`player-card ${member.is_ready ? 'ready' : 'not-ready'}`}>
                  <div className="player-info">
                    <div className="player-name">
                      {member.user_name}
                      {member.user_id === room.host_id && <span className="host-badge">HOST</span>}
                    </div>
                    <div className="player-status">
                      {member.is_ready ? '✓ Ready' : '⏳ Not Ready'}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Show empty slots */}
              {Array.from({ length: room.max_players - members.length }).map((_, index) => (
                <div key={`empty-${index}`} className="player-card empty">
                  <div className="player-info">
                    <div className="player-name">Waiting for player...</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="game-settings">
            <h3>Game Settings</h3>
            <div className="settings-grid">
              <div className="setting-item">
                <label>Rounds:</label>
                <span>{room.game_settings?.rounds || 10}</span>
              </div>
              <div className="setting-item">
                <label>Mode:</label>
                <span>{room.game_settings?.mode || 'Standard'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="room-actions">
          <div className="player-actions">
            <button
              onClick={handleToggleReady}
              className={`btn ${isReady ? 'btn-warning' : 'btn-success'}`}
            >
              {isReady ? 'Not Ready' : 'Ready'}
            </button>
            <button
              onClick={handleLeaveRoom}
              className="btn btn-danger"
            >
              Leave Room
            </button>
          </div>

          {isHost && (
            <div className="host-actions">
              <button
                onClick={handleStartGame}
                disabled={!allPlayersReady || members.length < 2}
                className={`btn ${allPlayersReady && members.length >= 2 ? 'btn-primary' : 'btn-disabled'}`}
              >
                {!allPlayersReady ? 'Waiting for players to be ready' : 
                 members.length < 2 ? 'Need at least 2 players' : 
                 'Start Game'}
              </button>
            </div>
          )}
        </div>

        {!isHost && (
          <div className="waiting-message">
            <p>Waiting for the host to start the game...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameRoom;
