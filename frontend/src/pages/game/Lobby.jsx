import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { lobbyService } from '@/shared/api/lobbyService';
import '@/styles/pages/Lobby.css';

const Lobby = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    loadRooms();
  }, [user, navigate]);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const response = await lobbyService.getRooms();
      if (response.success) {
        setRooms(response.rooms);
      } else {
        setError(response.error);
      }
    } catch {
      setError('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) {
      setError('Room name is required');
      return;
    }

    try {
      const response = await lobbyService.createRoom({
        name: roomName.trim(),
        maxPlayers: maxPlayers,
        gameSettings: {
          rounds: 10, // default game settings
          mode: 'standard'
        }
      });

      if (response.success) {
        // Navigate to the room
        navigate(`/room/${response.room.room_id}`);
      } else {
        setError(response.error);
      }
    } catch {
      setError('Failed to create room');
    }
  };

  const handleJoinRoom = async (roomId) => {
    try {
      const response = await lobbyService.joinRoom(roomId);
      if (response.success) {
        navigate(`/room/${roomId}`);
      } else {
        setError(response.error);
      }
    } catch {
      setError('Failed to join room');
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="lobby">
        <div className="lobby-container">
          <div className="loading">Loading rooms...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby">
      <div className="lobby-container">
        <div className="lobby-header">
          <h1>Game Lobby</h1>
          <div className="lobby-actions">
            <button 
              onClick={() => setShowCreateRoom(!showCreateRoom)}
              className="btn btn-primary"
            >
              {showCreateRoom ? 'Cancel' : 'Create Room'}
            </button>
            <button 
              onClick={loadRooms}
              className="btn btn-secondary"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')} className="close-btn">×</button>
          </div>
        )}

        {showCreateRoom && (
          <div className="create-room-form">
            <h3>Create New Room</h3>
            <form onSubmit={handleCreateRoom}>
              <div className="form-group">
                <label htmlFor="roomName">Room Name:</label>
                <input
                  type="text"
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter room name..."
                  maxLength={50}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="maxPlayers">Max Players:</label>
                <select
                  id="maxPlayers"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                >
                  <option value={2}>2 Players</option>
                  <option value={3}>3 Players</option>
                  <option value={4}>4 Players</option>
                  <option value={5}>5 Players</option>
                  <option value={6}>6 Players</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Create Room</button>
                <button 
                  type="button" 
                  onClick={() => setShowCreateRoom(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rooms-list">
          <h3>Available Rooms ({rooms.length})</h3>
          {rooms.length === 0 ? (
            <div className="no-rooms">
              <p>No rooms available. Create one to get started!</p>
            </div>
          ) : (
            <div className="rooms-grid">
              {rooms.map((room) => (
                <div key={room.$id} className="room-card">
                  <div className="room-header">
                    <h4>{room.room_name}</h4>
                    <span className="room-status">{room.status}</span>
                  </div>
                  <div className="room-info">
                    <div className="room-host">
                      <strong>Host:</strong> {room.host_name}
                    </div>
                    <div className="room-players">
                      <strong>Players:</strong> {room.current_players}/{room.max_players}
                    </div>
                    <div className="room-created">
                      <strong>Created:</strong> {formatTimeAgo(room.created_at)}
                    </div>
                  </div>
                  <div className="room-actions">
                    <button
                      onClick={() => handleJoinRoom(room.room_id)}
                      disabled={room.current_players >= room.max_players}
                      className={`btn ${room.current_players >= room.max_players ? 'btn-disabled' : 'btn-primary'}`}
                    >
                      {room.current_players >= room.max_players ? 'Full' : 'Join'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
