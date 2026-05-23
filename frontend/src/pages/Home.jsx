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

        <div className="home-secondary-row">
          {gameState.gameStarted && !gameState.gameFinished && (
            <button
              className="active-game-banner"
              onClick={() => navigate('/game/current')}
            >
              <PlayIcon size={16} />
              <span>{t('home.continueGame')}</span>
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
      </div>

      <FriendsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
      />
    </div>
  )
}

export default Home
