import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { lobbyService } from '@/shared/api/lobbyService';
import {CopyIcon, XIcon, CheckMarkIcon} from '@/components/ui/Icon';
import '@/styles/pages/Lobby.css';
import '@/styles/components/modal.css';

const Lobby = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  // const [loading, setLoading] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [copiedRoomId, setCopiedRoomId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    loadRooms();

    // Subscribe to real-time room updates
    const unsubscribe = lobbyService.subscribeToLobby(() => {
      // Reload rooms when any room or member changes
      loadRooms();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, navigate]);

  const loadRooms = async () => {
    // setLoading(true);
    try {
      const response = await lobbyService.getRooms();
      if (response.success) {
        // For each room, get the actual member count to ensure accuracy
        const roomsWithMemberCounts = await Promise.all(
          response.rooms.map(async (room) => {
            const membersResponse = await lobbyService.getRoomMembers(room.room_id);
            const actualMemberCount = membersResponse.success ? membersResponse.members.length : room.current_players;
            return {
              ...room,
              current_players: actualMemberCount // Use actual member count instead of potentially stale database field
            };
          })
        );
        setRooms(roomsWithMemberCounts);
      } else {
        setError(response.error);
      }
    } catch {
      setError('Failed to load rooms');
    }
    //  finally {
    //   setLoading(false);
    // }
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

  // const formatTimeAgo = (dateString) => {
  //   const now = new Date();
  //   const created = new Date(dateString);
  //   const diffMs = now - created;
  //   const diffMins = Math.floor(diffMs / 60000);
    
  //   if (diffMins < 1) return 'Just now';
  //   if (diffMins < 60) return `${diffMins}m ago`;
  //   const diffHours = Math.floor(diffMins / 60);
  //   if (diffHours < 24) return `${diffHours}h ago`;
  //   const diffDays = Math.floor(diffHours / 24);
  //   return `${diffDays}d ago`;
  // };

  // if (loading) {
  //   return (
  //     <div className="lobby-loading">
  //       <div className="loading-content">
  //         <div className="loading-spinner"></div>
  //         <div>Loading rooms...</div>
  //         <div>Please wait while we fetch the latest rooms</div>
  //       </div>
  //     </div>
  //   );
  // }


  return (
      <div className="lobby-container">
        {error && (
          <div className="error-message">
            <span>{error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {showCreateRoom && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h2>Create New Room</h2>
                <button className="close-btn" onClick={() => setShowCreateRoom(false)}>
                  <XIcon size={20} />
                </button>
              </div>
              
              <div className="modal-content">
                <form onSubmit={handleCreateRoom} className="create-room-form">
                  <div className="form-group">
                    <label htmlFor="roomName">Room Name</label>
                    <input
                      type="text"
                      id="roomName"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Enter room name..."
                      maxLength={50}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="maxPlayers">Max Players</label>
                    <select
                      id="maxPlayers"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                    >
                      <option value={3}>3 Players</option>
                      <option value={4}>4 Players</option>
                      <option value={5}>5 Players</option>
                      <option value={6}>6 Players</option>
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="modal-button secondary" onClick={() => setShowCreateRoom(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="modal-button primary">
                      Create Room
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className="rooms-section">
          <div className='section-header'>
            <h2>Available Rooms </h2>
          </div>
          {rooms.length === 0 ? (
            <div className="no-rooms">
              <p>No rooms available</p>
              <p>Create one to get started!</p>
            </div>
          ) : (
            <div className="rooms-grid">
              {rooms.map((room) => (
                <div key={room.$id} className="room-card">
                  <div className="room-header">
                    <span
                      className="room-id copyable"
                      onClick={async () => {
                        await navigator.clipboard.writeText(room.room_id);
                        setCopiedRoomId(room.room_id);
                        setTimeout(() => setCopiedRoomId(null), 3500);
                      }}
                    >
                      {room.room_id}{' '}
                      {copiedRoomId === room.room_id ? (
                        <CheckMarkIcon className="Icon-Check"  size={12} />
                      ) : (
                        <CopyIcon size={12} />
                      )}
                    </span>
                    {/*<span className="room-name">{room.room_name}</span>*/}

                  </div>
                  <div className="room-details">
                    <div className="room-detail">
                      <span className="detail-label">Host </span>
                      <span className="detail-value">{room.host_name}</span>
                    </div>
                    <div className="room-detail">
                      <span className="detail-label">Players </span> 
                      <span className="detail-value">{room.current_players}/{room.max_players}</span>
                    </div>
                    <div className="room-detail">
                      <span className="detail-label">State </span>
                      <span className="room-status">{room.status}</span>
                    </div>

                    {/* <div className="room-detail">
                      <span className="detail-label">Created: </span>
                      <span className="detail-value">{formatTimeAgo(room.created_at)}</span>
                    </div> */}
                  </div>
                  <div className="room-actions">
                    <button
                      onClick={() => handleJoinRoom(room.room_id)}
                      disabled={room.current_players >= room.max_players}
                      className={`join-button 
                        ${room.current_players >= room.max_players ? 'disabled' : ''}
                      `}
                    >
                      {room.current_players >= room.max_players ? 'Full' : 'Join'}
                      
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rooms-actions">
            <button 
              onClick={() => setShowCreateRoom(!showCreateRoom)}
              className="create-room-button"
            >
              {showCreateRoom ? 'Cancel' : 'Create'}
            </button>
            <button 
              onClick={loadRooms}
              className="refresh-button"
            >
              Refresh
            </button>
          </div>
      </div>
  );
};

export default Lobby;
