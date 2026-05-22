import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import FriendsModal from '@/components/modals/FriendsModal'
import { useGameStateContext } from '@/shared/hooks/useGameState'
import { UsersIcon, PlayIcon } from '@/components/ui/Icon'
import "@/styles/pages/home.css"

const Home = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { gameState } = useGameStateContext()
  const [showFriendsModal, setShowFriendsModal] = useState(false)

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

        {gameState.gameStarted && !gameState.gameFinished && (
          <div className="active-game-banner">
            <div className="active-game-info">
              <span className="active-game-label">{t('home.activeGameLabel')}</span>
              <span className="active-game-progress">
                {t('home.activeGameProgress', { current: gameState.currentRound, max: gameState.maxRounds })}
              </span>
              {gameState.players?.length > 0 && (
                <span className="active-game-players">
                  {gameState.players.map(p => p.name).join(', ')}
                </span>
              )}
            </div>
            <button
              className="active-game-continue-btn"
              onClick={() => navigate('/game/current')}
            >
              <PlayIcon size={18} />
              {t('home.continueGame')}
            </button>
          </div>
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

      <FriendsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
      />
    </div>
  )
}

export default Home
