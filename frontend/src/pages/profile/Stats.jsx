import { useState, useEffect, useMemo } from 'react'
import PerformanceStatsEnhanced from './PerformanceStatsEnhanced'
import { useUser } from '@/shared/hooks/useUser'
import { userService } from '@/shared/api/userService'
import BackButton from '@/components/ui/BackButton'
import "@/styles/components/TableGame.css";
import { useTranslation } from 'react-i18next';

const Stats = () => {
  const { user } = useUser()
  const { t } = useTranslation()
  const [allGames, setAllGames] = useState([])
  const [profileIdentities, setProfileIdentities] = useState([])
  const [error, setError] = useState(null)

  // Create player object from user data - include identities for matching
  const currentPlayer = useMemo(() => {
    if (user) {
      return {
        id: user.id,
        name: user.name || user.username || 'User',
        username: user.username,
        identities: profileIdentities // Include linked identity names for matching
      }
    }
    return null
  }, [user, profileIdentities])

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentPlayer) {
          // Clear games when user logs out
          setAllGames([]);
          return;
        }

        // Fetch user profile from backend - includes games from linked guest identities
        const profileData = await userService.getUserPublicProfile(user.username);
        
        if (!profileData || !profileData.games) {
          setAllGames([]);
          setProfileIdentities([]);
          return;
        }

        // Store identity names for player matching in games
        setProfileIdentities(profileData.identities || [user.username]);

        // The backend already filters games for this user and their linked identities
        // Transform the games to match the expected format for the stats component
        const transformedGames = profileData.games.map(game => {
          if (game.gameType === 'wizard') {
            // Wizard game format
            return {
              gameId: game.id,
              gameType: 'wizard',
              gameFinished: true,
              created_at: game.created_at,
              gameState: {
                ...game.gameData,
                gameFinished: true,
                players: game.gameData.players,
                final_scores: game.gameData.final_scores,
                total_rounds: game.gameData.total_rounds,
                round_data: game.gameData.round_data,
                winner_ids: game.gameData.winner_ids
              }
            };
          } else {
            // Table game format
            return {
              gameId: game.id,
              gameType: 'table',
              gameTypeName: game.name || game.gameTypeName,
              name: game.name || game.gameTypeName,
              gameFinished: true,
              lowIsBetter: game.lowIsBetter,
              created_at: game.created_at,
              gameData: game.gameData,
              gameState: {
                players: game.gameData.players,
                lowIsBetter: game.lowIsBetter
              },
              winner_ids: game.winner_ids
            };
          }
        });
        
        setAllGames(transformedGames);
      } catch (err) {
        console.error('Error fetching stats data:', err)
        setError(t('profile.failedToLoadStats'))
      }
    }
    
    if (currentPlayer && user.username) {
      fetchData()
    }
  }, [currentPlayer, user, t])

  if (error) {
    return (
        <div className="error">{error}</div>
    )
  }

  if (!currentPlayer) {
    return (
        <div className="error">{t('profile.pleaseLoginForStats')}</div>
    )
  }

  return (
      <div className="stats-container">
        <div className="stats-header">
          <BackButton fallback="/account" label={t('profile.backToProfile')} />
        </div>

        <PerformanceStatsEnhanced games={allGames} currentPlayer={currentPlayer} gameType="wizard" />
      </div>
  )
}

export default Stats