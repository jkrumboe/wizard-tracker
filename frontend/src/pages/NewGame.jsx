import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const NewGame = () => {
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [allPlayers, setAllPlayers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentRound, setCurrentRound] = useState(1)
  const [maxRounds, setMaxRounds] = useState(10)
  const [gameStarted, setGameStarted] = useState(false)
  const [roundData, setRoundData] = useState([])

  // Mock player data - would be fetched from API in production
  useEffect(() => {
    const mockPlayers = [
      { id: 1, name: 'Alice', avatar: 'https://via.placeholder.com/40' },
      { id: 2, name: 'Bob', avatar: 'https://via.placeholder.com/40' },
      { id: 3, name: 'Charlie', avatar: 'https://via.placeholder.com/40' },
      { id: 4, name: 'David', avatar: 'https://via.placeholder.com/40' },
      { id: 5, name: 'Eve', avatar: 'https://via.placeholder.com/40' },
      { id: 6, name: 'Frank', avatar: 'https://via.placeholder.com/40' },
    ]
    setAllPlayers(mockPlayers)
  }, [])

  const handleAddPlayer = (player) => {
    if (players.length < 6 && !players.some(p => p.id === player.id)) {
      setPlayers([...players, player])
      setSearchQuery('')
    }
  }

  const handleRemovePlayer = (playerId) => {
    setPlayers(players.filter(player => player.id !== playerId))
  }

  const handleStartGame = () => {
    if (players.length >= 2) {
      // Initialize game data
      const initialRoundData = []
      for (let i = 1; i <= maxRounds; i++) {
        initialRoundData.push({
          round: i,
          cards: i <= 10 ? i : 20 - i, // Wizard card distribution
          players: players.map(player => ({
            id: player.id,
            name: player.name,
            call: null,
            made: null,
            score: null,
            totalScore: i === 1 ? 0 : null // Initialize with 0 for first round
          }))
        })
      }
      setRoundData(initialRoundData)
      setGameStarted(true)
    }
  }

  const handleCallChange = (playerId, call) => {
    const roundIndex = currentRound - 1
    const currentRoundData = { ...roundData[roundIndex] }
    const playerIndex = currentRoundData.players.findIndex(p => p.id === playerId)
    
    // Update the call for this player
    currentRoundData.players[playerIndex].call = Math.max(0, Math.min(call, currentRoundData.cards))
    
    // Update round data
    const newRoundData = [...roundData]
    newRoundData[roundIndex] = currentRoundData
    setRoundData(newRoundData)
  }

  const handleMadeChange = (playerId, made) => {
    const roundIndex = currentRound - 1
    const currentRoundData = { ...roundData[roundIndex] }
    const playerIndex = currentRoundData.players.findIndex(p => p.id === playerId)
    
    // Update the tricks made for this player
    currentRoundData.players[playerIndex].made = Math.max(0, Math.min(made, currentRoundData.cards))
    
    // Calculate score for this player
    const player = currentRoundData.players[playerIndex]
    if (player.call !== null && player.made !== null) {
      if (player.call === player.made) {
        // 20 points + 10 points per trick
        player.score = 20 + (player.made * 10)
      } else {
        // -10 points per difference
        player.score = -10 * Math.abs(player.call - player.made)
      }
      
      // Calculate total score
      const prevRound = roundIndex > 0 ? roundData[roundIndex - 1] : null
      const prevScore = prevRound ? prevRound.players[playerIndex].totalScore : 0
      player.totalScore = prevScore + player.score
    }
    
    // Update round data
    const newRoundData = [...roundData]
    newRoundData[roundIndex] = currentRoundData
    setRoundData(newRoundData)
  }

  const isRoundComplete = () => {
    if (!roundData[currentRound - 1]) return false
    
    const allPlayersEntered = roundData[currentRound - 1].players.every(
      player => player.call !== null && player.made !== null
    )
    
    return allPlayersEntered
  }

  const handleNextRound = () => {
    if (isRoundComplete() && currentRound < maxRounds) {
      setCurrentRound(currentRound + 1)
    }
  }

  const handlePreviousRound = () => {
    if (currentRound > 1) {
      setCurrentRound(currentRound - 1)
    }
  }

  const handleFinishGame = () => {
    // In a real app, you'd save the game data to the backend here
    alert('Game finished! Results would be saved to backend.')
    navigate('/')
  }

  const filteredPlayers = allPlayers.filter(player => 
    player.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Game setup view
  if (!gameStarted) {
    return (
      <div className="new-game-container">
        <h1>New Wizard Game</h1>
        
        <div className="setup-section">
          <h2>Select Players</h2>
          <div className="player-search">
            <input 
              type="text" 
              placeholder="Search players..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            
            {searchQuery && (
              <div className="search-results">
                {filteredPlayers.length > 0 ? (
                  filteredPlayers.map(player => (
                    <div 
                      key={player.id} 
                      className="player-result"
                      onClick={() => handleAddPlayer(player)}
                    >
                      <img src={player.avatar} alt={player.name} className="player-avatar" />
                      <span>{player.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="no-results">No players found</div>
                )}
              </div>
            )}
          </div>
          
          <div className="selected-players">
            <h3>Selected Players ({players.length}/6)</h3>
            {players.length > 0 ? (
              <div className="player-list">
                {players.map(player => (
                  <div key={player.id} className="player-item">
                    <img src={player.avatar} alt={player.name} className="player-avatar" />
                    <span>{player.name}</span>
                    <button 
                      onClick={() => handleRemovePlayer(player.id)}
                      className="remove-btn"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-message">No players selected</div>
            )}
          </div>
        </div>
        
        <div className="settings-section">
          <h2>Game Settings</h2>
          <div className="setting-item">
            <label htmlFor="rounds">Number of Rounds:</label>
            <input 
              type="number" 
              id="rounds" 
              min="1" 
              max="20" 
              value={maxRounds}
              onChange={(e) => setMaxRounds(parseInt(e.target.value))}
            />
          </div>
        </div>
        
        <div className="action-buttons">
          <button 
            className="btn btn-primary"
            onClick={handleStartGame}
            disabled={players.length < 2}
          >
            Start Game
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Game in progress view
  const currentRoundData = roundData[currentRound - 1]
  
  return (
    <div className="game-in-progress">
      <div className="game-header">
        <h1>Wizard Game</h1>
        <div className="round-info">
          <span>Round {currentRound} of {maxRounds}</span>
          <span className="cards-info">Cards: {currentRoundData.cards}</span>
        </div>
      </div>
      
      <div className="round-navigation">
        <button 
          onClick={handlePreviousRound}
          disabled={currentRound === 1}
          className="nav-btn"
        >
          ← Previous
        </button>
        <span className="round-display">Round {currentRound}</span>
        <button 
          onClick={handleNextRound}
          disabled={!isRoundComplete() || currentRound === maxRounds}
          className="nav-btn"
        >
          Next →
        </button>
      </div>
      
      <div className="player-scores">
        <table className="score-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Call</th>
              <th>Made</th>
              <th>Round Score</th>
              <th>Total Score</th>
            </tr>
          </thead>
          <tbody>
            {currentRoundData.players.map(player => (
              <tr key={player.id}>
                <td className="player-cell">
                  <span>{player.name}</span>
                </td>
                <td>
                  <input 
                    type="number" 
                    min="0" 
                    max={currentRoundData.cards}
                    value={player.call === null ? '' : player.call}
                    onChange={(e) => handleCallChange(player.id, parseInt(e.target.value) || 0)}
                    className="game-input"
                  />
                </td>
                <td>
                  <input 
                    type="number" 
                    min="0" 
                    max={currentRoundData.cards}
                    value={player.made === null ? '' : player.made}
                    onChange={(e) => handleMadeChange(player.id, parseInt(e.target.value) || 0)}
                    className="game-input"
                    disabled={player.call === null}
                  />
                </td>
                <td className={player.score !== null ? (player.score >= 0 ? 'positive-score' : 'negative-score') : ''}>
                  {player.score !== null ? player.score : '-'}
                </td>
                <td>{player.totalScore !== null ? player.totalScore : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {currentRound === maxRounds && isRoundComplete() && (
        <button 
          onClick={handleFinishGame}
          className="finish-btn"
        >
          Finish Game
        </button>
      )}
    </div>
  )
}

export default NewGame 