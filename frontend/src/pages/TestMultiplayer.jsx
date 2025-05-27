import React, { useState } from 'react';
import colyseusService from '../services/colyseusClient';
import { useAuth } from '../hooks/useAuth';

const TestMultiplayer = () => {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState('');

  const addResult = (test, status, message, data = null) => {
    setTestResults(prev => [...prev, {
      test,
      status, // 'success', 'error', 'warning', 'info'
      message,
      data,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const runMultiplayerTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      // Test 1: Player Data Setup
      setCurrentStep('Setting up player data...');
      if (!user) {
        addResult('Player Setup', 'error', 'No user logged in');
        return;
      }
      
      colyseusService.setPlayerData({
        id: user.player_id,
        name: user.username,
        avatar: user.avatar,
        elo: user.elo || 1000
      });
      addResult('Player Setup', 'success', `Player data set for ${user.username}`);

      // Test 2: API Endpoints
      setCurrentStep('Testing API endpoints...');
      
      // Test active rooms API
      try {
        const response = await fetch('/api/rooms/active', { credentials: 'include' });
        if (response.ok) {
          const rooms = await response.json();
          addResult('API - Active Rooms', 'success', `Fetched ${rooms.length} active rooms`, rooms);
        } else {
          addResult('API - Active Rooms', 'error', `API returned ${response.status}`);
        }
      } catch (error) {
        addResult('API - Active Rooms', 'error', error.message);
      }

      // Test 3: Lobby Connection
      setCurrentStep('Connecting to lobby...');
      try {
        const lobby = await colyseusService.joinLobbyWithTracking();
        addResult('Lobby Connection', 'success', `Connected to lobby: ${lobby.sessionId}`);
        
        // Set up lobby listeners
        lobby.onStateChange((state) => {
          addResult('Lobby State', 'info', `Lobby updated - ${state.players?.size || 0} players online`);
        });

        lobby.onError((code, message) => {
          addResult('Lobby Error', 'error', `Code ${code}: ${message}`);
        });

      } catch (error) {
        addResult('Lobby Connection', 'error', error.message);
      }

      // Test 4: Room Creation
      setCurrentStep('Creating game room...');
      try {
        const gameSettings = {
          roomName: `Test Room ${Date.now()}`,
          maxPlayers: 4,
          gameMode: 'classic',
          isPrivate: false,
          maxRounds: 5
        };

        const gameRoom = await colyseusService.createGameRoomWithTracking(gameSettings);
        addResult('Room Creation', 'success', `Created room: ${gameRoom.sessionId}`, gameSettings);

        // Set up game room listeners
        gameRoom.onStateChange((state) => {
          addResult('Game State', 'info', `Game updated - ${state.players?.size || 0} players, Started: ${state.gameStarted}`);
        });

        gameRoom.onMessage('welcome', (message) => {
          addResult('Game Welcome', 'success', 'Received welcome message', message);
        });

        gameRoom.onError((code, message) => {
          addResult('Game Error', 'error', `Code ${code}: ${message}`);
        });

        // Test 5: Player Actions
        setCurrentStep('Testing player actions...');
        
        // Test ready functionality
        setTimeout(() => {
          gameRoom.send('playerReady', { ready: true });
          addResult('Player Action', 'info', 'Sent player ready signal');
        }, 1000);

        // Test game settings update (only works if host)
        setTimeout(() => {
          gameRoom.send('updateGameSettings', { maxRounds: 6 });
          addResult('Player Action', 'info', 'Sent game settings update');
        }, 2000);

        // Test 6: Database Integration
        setCurrentStep('Testing database integration...');
        setTimeout(async () => {
          try {
            const response = await fetch('/api/rooms/active', { credentials: 'include' });
            if (response.ok) {
              const rooms = await response.json();
              const ourRoom = rooms.find(r => r.room_name === gameSettings.roomName);
              if (ourRoom) {
                addResult('Database Integration', 'success', 'Room found in database', ourRoom);
              } else {
                addResult('Database Integration', 'warning', 'Room not found in database');
              }
            }
          } catch (error) {
            addResult('Database Integration', 'error', error.message);
          }
        }, 3000);

        // Clean up after 10 seconds
        setTimeout(() => {
          setCurrentStep('Cleaning up...');
          gameRoom.leave();
          colyseusService.leaveLobby();
          addResult('Cleanup', 'success', 'Test completed and cleaned up');
          setCurrentStep('Test completed!');
          setIsRunning(false);
        }, 10000);

      } catch (error) {
        addResult('Room Creation', 'error', error.message);
        setIsRunning(false);
      }

    } catch (error) {
      addResult('Test Suite', 'error', `Test suite failed: ${error.message}`);
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'error': return '#f44336';
      case 'warning': return '#ff9800';
      case 'info': return '#2196F3';
      default: return '#666';
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>🎮 Multiplayer System Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={runMultiplayerTests}
          disabled={isRunning || !user}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: isRunning ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? '🔄 Running Tests...' : '🚀 Run Multiplayer Tests'}
        </button>
        
        {!user && (
          <div style={{ marginTop: '10px', color: '#f44336' }}>
            ⚠️ Please log in to run tests
          </div>
        )}
      </div>

      {currentStep && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#e3f2fd', 
          borderRadius: '4px', 
          marginBottom: '20px',
          border: '1px solid #2196F3'
        }}>
          <strong>Current Step:</strong> {currentStep}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h3>Test Results ({testResults.length})</h3>
        <div style={{ 
          maxHeight: '500px', 
          overflowY: 'auto', 
          border: '1px solid #ddd', 
          borderRadius: '4px',
          backgroundColor: '#f9f9f9'
        }}>
          {testResults.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              No test results yet. Click "Run Multiplayer Tests" to start.
            </div>
          ) : (
            testResults.map((result, index) => (
              <div 
                key={index}
                style={{ 
                  padding: '12px', 
                  borderBottom: '1px solid #eee',
                  backgroundColor: index % 2 === 0 ? '#fff' : '#f5f5f5'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ marginRight: '8px', fontSize: '16px' }}>
                    {getStatusIcon(result.status)}
                  </span>
                  <strong style={{ color: getStatusColor(result.status) }}>
                    {result.test}
                  </strong>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>
                    {result.timestamp}
                  </span>
                </div>
                <div style={{ marginLeft: '24px', color: '#333' }}>
                  {result.message}
                </div>
                {result.data && (
                  <details style={{ marginLeft: '24px', marginTop: '8px' }}>
                    <summary style={{ cursor: 'pointer', color: '#666', fontSize: '12px' }}>
                      View Data
                    </summary>
                    <pre style={{ 
                      backgroundColor: '#f0f0f0', 
                      padding: '8px', 
                      borderRadius: '4px',
                      fontSize: '11px',
                      overflow: 'auto',
                      maxHeight: '200px'
                    }}>
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h3>Test Information</h3>
        <p>This test suite verifies the following multiplayer functionality:</p>
        <ul>
          <li>✅ Player data setup and authentication</li>
          <li>🌐 API endpoint connectivity (rooms, database)</li>
          <li>🏛️ Lobby connection and real-time updates</li>
          <li>🎯 Game room creation with database integration</li>
          <li>🎮 Player actions (ready, settings update)</li>
          <li>💾 Database persistence verification</li>
          <li>🧹 Proper cleanup and disconnection</li>
        </ul>
        
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
          <strong>Note:</strong> The test creates a temporary game room that will be automatically cleaned up after 10 seconds.
          All WebSocket connections are properly closed to prevent memory leaks.
        </div>
      </div>
    </div>
  );
};

export default TestMultiplayer;
