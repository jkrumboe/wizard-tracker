import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { lobbyService } from '@/shared/api/lobbyService';
import {CopyIcon, XIcon, CheckMarkIcon} from '@/components/ui/Icon';
import '@/styles/pages/GameRoom.css';


const GameRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  // const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const loadRoomData = async () => {
      // setLoading(true);
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
      }
      //  finally {
      //   setLoading(false);
      // }
    };

    const handleRoomUpdate = async (response) => {
      try {
        // Handle different types of updates more efficiently
        if (response.payload) {
          const eventType = response.events[0];
          
          if (eventType.includes('room_members')) {
            // Only update members if it's a member change
            const membersResponse = await lobbyService.getRoomMembers(roomId);
            if (membersResponse.success) {
              setMembers(membersResponse.members);
              
              // Update current user ready status
              const currentUserMember = membersResponse.members.find(m => m.user_id === user.$id);
              if (currentUserMember) {
                setIsReady(currentUserMember.is_ready);
              }
            }
          } else if (eventType.includes('game_rooms')) {
            // Only update room data if it's a room change
            const roomResponse = await lobbyService.getRoom(roomId);
            if (roomResponse.success) {
              setRoom(roomResponse.room);
              
              // If room is starting, redirect to game
              if (roomResponse.room.status === 'starting') {
                navigate(`/multiplayer/${roomId}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error handling room update:', error);
        // Fallback to full reload if selective update fails
        loadRoomData();
      }
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

  // if (loading) {
  //   return (
  //     <div className="loading-container">
  //       <div className="loading-content">
  //         <div className="loading-spinner"></div>
  //         <div>Loading room...</div>
  //         <div>Please wait while we fetch room details</div>
  //       </div>
  //     </div>
  //   );
  // }

  if (!room) {
    return (
      <div className="room-not-found">
        <div className="room-not-found-content">
          <div className="room-not-found-card">
            <h2>Room Not Found</h2>
            <p>The room you're looking for doesn't exist or has been deleted.</p>
            <button onClick={() => navigate('/lobby')}>
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
      <div className="game-room-container">
                {error && (
          <div className="error-message">
            <span>{error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        <div className="game-room-content">
          {/* Players Section */}
          <div className="players-section">
            {/* Header */}
            <div className="game-room-header">
              <h1>Roomname: {room.room_name}</h1>
              <div className="room-info">
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
                {/*<span>Status: {room.status}</span>*/}
              </div>
            </div>
            {/* <h3>Players ({members.length}/{room.max_players})</h3> */}
            <div className="players-list">
              {members.map((member) => (
                <div key={member.$id} className={`gameRoom-player-card ${member.is_ready ? 'ready' : 'not-ready'}`}>
                  <div className="player-info">
                    <div className="player-avatar">
                      {member.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="player-details">
                      <div className="player-name">
                        {member.user_name}
                        {member.user_id === room.host_id && (
                          <span className="host-badge">HOST</span>
                        )}
                      </div>
                      <div className="player-status">
                        {member.is_ready ? 'Ready' : 'Not Ready'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Empty slots */}
              {Array.from({ length: room.max_players - members.length }).map((_, index) => (
                <div key={`empty-${index}`} className="gameRoom-player-card empty">
                  <div className="player-info">
                    {/* <div className="player-avatar empty">?</div> */}
                    <div className="player-details" style={{ color: '#999' }}>
                      Waiting for player...
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Game Settings Section */}
          {/* <div className="settings-section">
            <h3>Game Settings</h3>
            <div className="settings-card">
              <div className="setting-item">
                <label>Rounds:</label>
                <span>{room.game_settings?.rounds || 10}</span>
              </div>
              <div className="setting-item">
                <label>Mode:</label>
                <span>{room.game_settings?.mode || 'Standard'}</span>
              </div>
            </div>
          </div> */}
        </div>

        <div className="game-room-actions">
          <div className="action-buttons">
            <button
              onClick={handleToggleReady}
              className={`ready-button ${isReady ? 'not-ready' : 'ready'}`}
            >
              {isReady ? 'Not Ready' : 'Ready'}
            </button>
            <button onClick={handleLeaveRoom} className="leave-button">
              Leave Room
            </button>
          </div>

          {isHost && (
            <div className="host-actions">
              <button
                onClick={handleStartGame}
                disabled={!allPlayersReady || members.length < 2}
                className="start-game-button"
              >
                {!allPlayersReady ? 'Waiting for players to be ready' : 
                 members.length < 2 ? 'Need at least 2 players' : 
                 'Start Game'}
              </button>
            </div>
          )}

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
