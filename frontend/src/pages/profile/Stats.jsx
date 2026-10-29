import { useState, useEffect, useMemo } from 'react'
import PerformanceStatsEnhanced from './PerformanceStatsEnhanced'
import { useUser } from '@/shared/hooks/useUser'
import { userService } from '@/shared/api/userService'
import BackButton from '@/components/ui/BackButton'
import { getStatsGameTypes, filterGamesByType, WIZARD_GAME_TYPE } from '@/shared/utils/gameTypes'
import "@/styles/components/TableGame.css";
import { useTranslation } from 'react-i18next';

const Stats = () => {
  const { user } = useUser()
  const { t } = useTranslation()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)
  const [statsGameType, setStatsGameType] = useState(WIZARD_GAME_TYPE)

  const username = user?.username

  // Fetch once per user. This used to depend on the player object built from
  // the response, so every fetch produced a new object and triggered the next.
  useEffect(() => {
    if (!username) {
      setProfile(null)
      return
    }

    let cancelled = false
    userService.getUserPublicProfile(username)
      .then(data => {
        if (!cancelled) setProfile(data)
      })
      .catch(err => {
        console.error('Error fetching stats data:', err)
        if (!cancelled) setError(t('profile.failedToLoadStats'))
      })
    return () => { cancelled = true }
  }, [username, t])

  // Identity ids match players exactly (including merged guest identities);
  // the names are only a fallback for games that never reached the server
  const currentPlayer = useMemo(() => {
    if (!user) return null
    return {
      id: user.id,
      name: user.name || user.username || 'User',
      username: user.username,
      identityIds: profile?.identityIds || [],
      primaryIdentityId: profile?.primaryIdentityId || null,
      identities: profile?.identities || [user.username]
    }
  }, [user, profile])

  // The profile API already resolved which player is this user and whether
  // they won (userPlayerIndex / userWon) - pass its games through unchanged
  // instead of rebuilding them without those fields
  const gameTypes = useMemo(() => getStatsGameTypes(profile?.games), [profile])

  // One game type at a time - scores, bids and achievements don't mix across games
  const selectedGameType = gameTypes.some(type => type.value === statsGameType)
    ? statsGameType
    : gameTypes[0]?.value || WIZARD_GAME_TYPE
  const games = useMemo(
    () => filterGamesByType(profile?.games, selectedGameType),
    [profile, selectedGameType]
  )

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

        {gameTypes.length > 1 && (
          <div className="settings-section" style={{ padding: '0', backgroundColor: 'transparent', border: 'none', marginBottom: 'var(--spacing-sm)' }}>
            <select
              className="game-type-selector"
              value={selectedGameType}
              onChange={(e) => setStatsGameType(e.target.value)}
            >
              {gameTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <PerformanceStatsEnhanced
          games={games}
          currentPlayer={currentPlayer}
          isWizardGame={selectedGameType === WIZARD_GAME_TYPE}
          gameType={selectedGameType}
          identityId={profile?.primaryIdentityId}
        />
      </div>
  )
}

export default Stats
