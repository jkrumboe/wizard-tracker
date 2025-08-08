import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import '@/styles/pages/Lobby.css';

const Lobby = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
  }, [user, navigate]);

  return (
    <div className="lobby">
      <div className="lobby-container">
        <div className="error-message">
          <h2>Multiplayer Lobby Unavailable</h2>
          <p>The multiplayer lobby functionality has been temporarily disabled.</p>
          <p>The old Colyseus-based multiplayer system has been removed.</p>
          <button 
            onClick={() => navigate('/')}
            className="btn btn-primary"
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
