import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getPlayers, createPlayer, updatePlayer } from "@/shared/api/playerService";
import { getGames } from "@/shared/api/gameService";
import { authService } from "@/shared/api/authService";
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
// import { getOnlineStatus, updateOnlineStatus } from '@/shared/utils/appwrite';
import { LogOutIcon, UsersIcon, GamepadIcon, BarChartIcon, SearchIcon, PlusIcon, EditIcon, TrashIcon } from "@/components/ui/Icon";
import "@/styles/pages/admin.css";
import "@/styles/components/offline-notification.css";

const AdminDashboard = () => {
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [newPlayer, setNewPlayer] = useState({ name: "", avatar: "", elo: 1000 });
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [stats, setStats] = useState({ totalPlayers: 0, totalGames: 0, totalScores: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlineStatusDoc, setOnlineStatusDoc] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { isOnline, lastUpdated } = useOnlineStatus();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const playersData = await getPlayers();
        const gamesData = await getGames();
        const totalScores = gamesData.reduce((sum, game) => sum + Object.values(game.final_scores || {}).reduce((a, b) => a + b, 0), 0);

        setPlayers(playersData);
        setGames(gamesData);
        setStats({
          totalPlayers: playersData.length,
          totalGames: gamesData.length,
          totalScores,
        });
      } catch (error) {
        console.error('Failed to fetch admin data:', error);
        if (error.message.includes('401') || error.message.includes('authentication')) {
          navigate('/admin/login');
        } else {
          setError('Failed to load dashboard data');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    
    // Fetch current online status document
    fetchOnlineStatus();
  }, [navigate]);

  const fetchOnlineStatus = async () => {
    try {
      const result = await getOnlineStatus();
      if (result.success) {
        setOnlineStatusDoc(result.document);
      }
    } catch (error) {
      console.error('Error fetching online status:', error);
    }
  };

  const handleToggleOnlineStatus = async () => {
    if (!onlineStatusDoc) return;
    
    setUpdatingStatus(true);
    try {
      const newStatus = !onlineStatusDoc.status;
      const result = await updateOnlineStatus(onlineStatusDoc.$id, newStatus);
      
      if (result.success) {
        setOnlineStatusDoc(result.document);
        console.log(`Online status updated to: ${newStatus}`);
      } else {
        console.error('Failed to update online status:', result.error);
      }
    } catch (error) {
      console.error('Error updating online status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.adminLogout();
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if logout fails
      navigate('/admin/login');
    }
  };

  const handleAddPlayer = async () => {
    const addedPlayer = await createPlayer(newPlayer);
    setPlayers([...players, addedPlayer]);
    setStats((prev) => ({ ...prev, totalPlayers: prev.totalPlayers + 1 }));
    setNewPlayer({ name: "", avatar: "", elo: 1000 });
  };

  const handleUpdatePlayer = async (id, updatedData) => {
    const updatedPlayer = await updatePlayer(id, updatedData);
    setPlayers(players.map((player) => (player.id === id ? updatedPlayer : player)));
    setEditingPlayer(null);
  };

  const filteredPlayers = players.filter((player) =>
    player.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  return (
    <div className="admin-dashboard-container">
      <div className="admin-header">
        <h1>🔧 Admin Dashboard</h1>
        <div className="header-actions">
          <Link to="/realtime-test" className="test-link">
            🚀 Realtime Test
          </Link>
          <button onClick={handleLogout} className="logout-btn">
            <LogOutIcon size={16} />
            Logout
          </button>
        </div>
      </div>
      
      {/* Online Status Banner */}
      <div className={`online-status-banner ${isOnline ? 'online' : 'offline'}`}>
        <div className="status-indicator"></div>
        <div className="status-text">
          <strong>Server Status:</strong> {isOnline ? 'ONLINE' : 'OFFLINE'} 
          {lastUpdated && <span className="status-time">Last updated: {new Date(lastUpdated).toLocaleString()}</span>}
        </div>
      </div>

      {loading && (
        <div className="loading-message">Loading dashboard...</div>
      )}

      {error && (
        <div className="error-message">{error}</div>
      )}

      {!loading && !error && (

      <><section className="stats-section">
          <h2><BarChartIcon size={20} /> App Statistics</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <h3><UsersIcon size={16} /> Total Players</h3>
              <p>{stats.totalPlayers}</p>
            </div>
            <div className="stat-item">
              <h3><GamepadIcon size={16} /> Total Games</h3>
              <p>{stats.totalGames}</p>
            </div>
            <div className="stat-item">
              <h3><BarChartIcon size={16} /> Total Scores</h3>
              <p>{stats.totalScores}</p>
            </div>
          </div>
        </section>

        {/* Online Status Control Section */}
        <section className="online-status-control">
          <h2>🌐 Online Status Control</h2>
          <div className="status-control-container">
            <div className="current-status">
              <p>Current Status: <strong className={isOnline ? 'status-online' : 'status-offline'}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </strong></p>
              {lastUpdated && (
                <p className="last-updated">Last updated: {new Date(lastUpdated).toLocaleString()}</p>
              )}
            </div>
            <button 
              onClick={handleToggleOnlineStatus}
              disabled={updatingStatus || !onlineStatusDoc}
              className={`toggle-status-btn ${onlineStatusDoc?.status ? 'online' : 'offline'}`}
            >
              {updatingStatus ? 'Updating...' : 
               onlineStatusDoc?.status ? 'Set Offline' : 'Set Online'}
            </button>
          </div>
          <div className="status-info">
            <p>💡 Toggle this to enable/disable online features for all users. When offline, users will only have access to local features.</p>
          </div>
        </section>        <section className="player-management">
            <h2><UsersIcon size={20} /> Player Management</h2>
            <div className="search-container">
              <SearchIcon size={16} />
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input" />
            </div>
            <ul className="player-list">
              {filteredPlayers.map((player) => (
                <li key={player.id} className="player-item" onClick={() => setSelectedPlayer(player)}>
                  <span>{player.name}</span>
                  {editingPlayer === player.id ? (
                    <div>
                      <input
                        type="text"
                        value={player.name}
                        onChange={(e) => setEditingPlayer({ ...player, name: e.target.value })} />
                      <button
                        onClick={() => handleUpdatePlayer(player.id, editingPlayer)}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div>
                      {player.name} - ELO: {player.elo}
                      <button onClick={() => setEditingPlayer(player.id)}>Edit</button>
                    </div>
                  )}
                  <button
                    onClick={() => handleUpdatePlayer(player.id, { ...player, elo: player.elo + 10 })}
                  >
                    +10 ELO
                  </button>
                </li>
              ))}
            </ul>
            <div className="add-player-form">
              <h3>{selectedPlayer ? "Edit Player" : "Add Player"}</h3>
              <input
                type="text"
                placeholder="Name"
                value={selectedPlayer ? selectedPlayer.name : newPlayer.name}
                onChange={(e) => selectedPlayer
                  ? setSelectedPlayer({ ...selectedPlayer, name: e.target.value })
                  : setNewPlayer({ ...newPlayer, name: e.target.value })} />
              <input
                type="text"
                placeholder="Avatar URL"
                value={selectedPlayer ? selectedPlayer.avatar : newPlayer.avatar}
                onChange={(e) => selectedPlayer
                  ? setSelectedPlayer({ ...selectedPlayer, avatar: e.target.value })
                  : setNewPlayer({ ...newPlayer, avatar: e.target.value })} />
              <input
                type="tel"
                placeholder="ELO"
                value={selectedPlayer ? selectedPlayer.elo : newPlayer.elo}
                onChange={(e) => selectedPlayer
                  ? setSelectedPlayer({ ...selectedPlayer, elo: parseInt(e.target.value) })
                  : setNewPlayer({ ...newPlayer, elo: parseInt(e.target.value) })} />
              <button onClick={selectedPlayer ? handleUpdatePlayer : handleAddPlayer}>
                {selectedPlayer ? "Update Player" : "Add Player"}
              </button>
            </div>
          </section><section className="games-section">
            <h2>Games</h2>            <ul>
              {games.map((game) => (
                <li key={game.id}>Game {game.id} - {new Date(game.created_at).toLocaleDateString()}</li>
              ))}
            </ul>
          </section></>
      )}
    </div>
  );
};

export default AdminDashboard;