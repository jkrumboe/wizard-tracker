import React, { useState } from "react";
import "../../styles/components/TableGame.css";

const MIN_PLAYERS = 2;

const TableGame = () => {
  const [rows, setRows] = useState(12);
  const [players, setPlayers] = useState([
    { name: "Player 1", points: [] },
    { name: "Player 2", points: [] },
  ]);

  const handleNameChange = (idx, value) => {
    const updated = [...players];
    updated[idx].name = value;
    setPlayers(updated);
  };

  const handlePointChange = (playerIdx, rowIdx, value) => {
    const updated = [...players];
    updated[playerIdx].points[rowIdx] = value === "" ? "" : parseInt(value, 10) || 0;
    setPlayers(updated);
  };

  // Insert a player at a specific index
  const insertPlayer = (idx) => {
    const newPlayers = [...players];
    newPlayers.splice(idx, 0, { name: `Player ${players.length + 1}`, points: [] });
    setPlayers(newPlayers);
  };

  const addRow = () => {
    setRows(rows + 1);
  };

  const getTotal = (player) => {
    return player.points.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
  };

  return (
    <div className="table-game-container">
      <button
        className="table-game-add-player-above"
        title="Add Player"
        onClick={() => insertPlayer(players.length)}
      >
        + Add Player
      </button>
      <div className="table-game-scroll">
        <table className="table-game-table">
          <thead>
            <tr>
              {players.map((player, idx) => (
                <th key={idx}>
                  <input
                    type="text"
                    value={player.name}
                    onChange={(e) => handleNameChange(idx, e.target.value)}
                    className="table-game-player-input"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, rowIdx) => (
              <tr key={rowIdx}>
                {players.map((player, playerIdx) => (
                  <td key={playerIdx}>
                    <input
                      type="number"
                      value={player.points[rowIdx] || ""}
                      onChange={(e) => handlePointChange(playerIdx, rowIdx, e.target.value)}
                      className="table-game-point-input"
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td colSpan={players.length}>
                <button
                  className="table-game-add-row-inline"
                  title="Add Row"
                  onClick={addRow}
                >
                  Add Row
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              {players.map((player, idx) => (
                <td key={idx} className="table-game-total">
                  {getTotal(player)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default TableGame;
