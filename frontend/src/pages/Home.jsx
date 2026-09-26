import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import FriendsModal from '@/components/modals/FriendsModal'
import { useGameStateContext } from '@/shared/hooks/useGameState'
import { getResumableGames } from '@/shared/utils/resumableGames'
import { UsersIcon, PlayIcon } from '@/components/ui/Icon'
import "@/styles/pages/home.css"

const Home = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { gameState, resumeGame } = useGameStateContext()
  const [showFriendsModal, setShowFriendsModal] = useState(false)
  const [resumeError, setResumeError] = useState('')

  // Paused Call & Made, table and scoreboard games are all candidates, so
  // leaving any game type can be picked up again from the home screen. Only the
  // game that was left most recently is offered; the rest stay in the saved
  // games lists under Play.
  const resumableGame = useMemo(() => {
    const games = getResumableGames()
    const hasActiveGame = gameState.gameStarted && !gameState.gameFinished
    const activeGameListed = games.some(
      (game) => game.type === 'wizard' && game.id === gameState.gameId
    )

    // A game still in memory without a paused save of its own has not been left
    // yet, which makes it the most recent one
    if (hasActiveGame && !activeGameListed) {
      games.unshift({
        id: gameState.gameId,
        type: 'wizard',
        name: gameState.gameName || null,
        players: gameState.players.map((player) => player.name),
        currentRound: gameState.currentRound,
        maxRounds: gameState.maxRounds,
        lastPlayed: null,
        route: '/game/current',
      })
    }

    return games[0] || null
  }, [gameState])

  const handleResumeGame = (game) => {
    setResumeError('')

    if (game.type !== 'wizard') {
      navigate(game.route)
      return
    }

    // The game currently in memory needs no reload from storage
    const isActiveGame = gameState.gameStarted
      && !gameState.gameFinished
      && (!game.id || gameState.gameId === game.id)

    if (isActiveGame) {
      navigate('/game/current')
      return
    }

    const result = resumeGame(game.id)
    if (result?.success) {
      navigate('/game/current')
      return
    }

    console.error('Failed to resume game:', result?.error)
    setResumeError(t('gameHistory.resumeFailedCorrupted', {
      defaultValue: 'Could not resume this paused game. The save appears to be corrupted.'
    }))
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>{t('home.title')}</h1>
        <p>{t('home.subtitle')}</p>
      </header>

      <div className="home-actions">
        <button
          className="home-play-btn"
          onClick={() => navigate('/games')}
        >
          <PlayIcon size={20} />
          <span>Play</span>
        </button>

        <div className="home-secondary-row">
          {resumableGame && (
            <button
              className="active-game-banner"
              onClick={() => handleResumeGame(resumableGame)}
            >
              <PlayIcon size={16} />
              <span className="active-game-banner-label">
                {resumableGame.name || t('home.continueGame')}
              </span>
            </button>
          )}

          <div className="friends-section">
            <button
              className="friends-button"
              onClick={() => setShowFriendsModal(true)}
              aria-label={t('home.manageFriends')}
            >
              <UsersIcon size={16} />
              <span>{t('home.friends')}</span>
            </button>
          </div>
        </div>

        {resumeError && (
          <p className="home-resume-error" role="alert">{resumeError}</p>
        )}
      </div>

      <FriendsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
      />
    </div>
  )
}

export default Home
