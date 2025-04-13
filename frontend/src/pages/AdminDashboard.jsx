import { useState, useEffect } from "react";
import { getPlayers, createPlayer } from "../services/playerService";
import { getGames, createGame } from "../services/gameService";

const AdminDashboard = () => {
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [newPlayer, setNewPlayer] = useState({ name: "", avatar: "", elo: 1000 });
  const [newGame, setNewGame] = useState({ date: "", players: [], winner: "", scores: {} });

  useEffect(() => {
    const fetchData = async () => {
      const playersData = await getPlayers();
      const gamesData = await getGames();
      setPlayers(playersData);
      setGames(gamesData);
    };
    fetchData();
  }, []);

  const handleAddPlayer = async () => {
    const addedPlayer = await createPlayer(newPlayer);
    setPlayers([...players, addedPlayer]);
  };

  const handleAddGame = async () => {
    const addedGame = await createGame(newGame);
    setGames([...games, addedGame]);
  };

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>

      <section>
        <h2>Players</h2>
        <ul>
          {players.map((player) => (
            <li key={player.id}>{player.name}</li>
          ))}
        </ul>
        <input
          type="text"
          placeholder="Name"
          value={newPlayer.name}
          onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
        />
        <button onClick={handleAddPlayer}>Add Player</button>
      </section>

      <section>
        <h2>Games</h2>
        <ul>
          {games.map((game) => (
            <li key={game.id}>{game.date}</li>
          ))}
        </ul>
        <input
          type="text"
          placeholder="Date"
          value={newGame.date}
          onChange={(e) => setNewGame({ ...newGame, date: e.target.value })}
        />
        <button onClick={handleAddGame}>Add Game</button>
      </section>
    </div>
  );
};

export default AdminDashboard;