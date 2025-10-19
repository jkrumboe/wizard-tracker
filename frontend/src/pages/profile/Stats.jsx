import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PerformanceStats from './PerformanceStats'
import { useUser } from '@/shared/hooks/useUser'
import { getRecentLocalGames } from '@/shared/api/gameService'
import { ArrowLeftCircleIcon } from '@/components/ui/Icon'

const Stats = () => {
  const navigate = useNavigate()
  const { user } = useUser()
  const [allGames, setAllGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Create player object from user data
  const currentPlayer = useMemo(() => {
    if (user) {
      return {
        id: user.id,
        name: user.name || user.username || 'User',
        username: user.username
      }
    }
    return null
  }, [user])

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentPlayer) {
          setLoading(false);
          return;
        }

        // Fetch all local games
        const localGames = await getRecentLocalGames(100);
        
        // Get all possible identifiers for the current user
        const userIdentifiers = [
          currentPlayer.id,
          currentPlayer.name,
          currentPlayer.username,
          user.id,
          user.name,
          user.username,
          user.$id
        ].filter(Boolean);
        
        // Filter games to only include games where the current user ACTUALLY PLAYED
        const userGames = localGames.filter(game => {
          // Check if user is in the players list by name/username
          if (game.gameState?.players && Array.isArray(game.gameState.players)) {
            const isInPlayers = game.gameState.players.some(player => {
              const playerName = player.name?.toLowerCase().trim();
              const playerUsername = player.username?.toLowerCase().trim();
              const currentName = currentPlayer.name?.toLowerCase().trim();
              const currentUsername = currentPlayer.username?.toLowerCase().trim();
              
              return playerName === currentName || playerUsername === currentUsername;
            });
            
            if (isInPlayers) return true;
          }
          
          // Fallback: Check by ID
          if (game.gameState?.players) {
            const isInPlayersById = game.gameState.players.some(player => {
              const playerIdentifiers = [player.id, player.userId].filter(Boolean);
              return playerIdentifiers.some(playerId => userIdentifiers.includes(playerId));
            });
            
            if (isInPlayersById) return true;
          }
          
          // Check player_ids array
          if (game.player_ids && Array.isArray(game.player_ids)) {
            if (game.player_ids.some(playerId => userIdentifiers.includes(playerId))) {
              return true;
            }
          }
          
          return false;
        });
        
        setAllGames(userGames || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching stats data:', err)
        setError('Failed to load statistics')
        setLoading(false)
      }
    }
    
    if (currentPlayer) {
      fetchData()
    }
  }, [currentPlayer, user])

  if (error) {
    return (
        <div className="error">{error}</div>
    )
  }

  if (!currentPlayer) {
    return (
        <div className="error">Please log in to view statistics</div>
    )
  }

  return (
      <div className="stats-container">
        <div className="stats-header">
          <button
            className="back-to-templates-btn"
            onClick={() => navigate('/profile')}
            title="Back to Profile"
          >
            <ArrowLeftCircleIcon size={20} />
            Back
          </button>
        </div>

        <PerformanceStats games={allGames} currentPlayer={currentPlayer} />
      </div>
  )
}

export default Stats