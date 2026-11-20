import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Icon from '@/components/ui/Icon';
import { useModalDismiss } from '@/shared/hooks/useModalDismiss';
import { publishGameFromPlayedGame } from '@/shared/api/gameTemplateService';
import '@/styles/components/modal.css';
import '@/styles/components/publishGameModal.css';

/**
 * Admin dialog that turns the game a played table game belongs to into a game
 * for everyone. Settings come from the game (and the template copy uploaded with
 * it); box art and details are looked up on BoardGameGeek by the name.
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.gameName - Name the new game gets; other games link to it by this name
 * @param {string} props.gameId - Cloud id or localId of the played game
 * @param {(result: {template: Object, alreadyPublic: boolean}) => void} props.onPublished
 */
const PublishGameModal = ({ isOpen, onClose, gameName, gameId, onPublished }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const close = () => {
    if (busy) return;
    setError(null);
    onClose();
  };
  const backdrop = useModalDismiss(isOpen, close);
  if (!isOpen) return null;

  const handlePublish = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await publishGameFromPlayedGame(gameId);
      onPublished({ template: result.template, alreadyPublic: false });
    } catch (err) {
      if (err.code === 'DUPLICATE_NAME') {
        onPublished({ template: null, alreadyPublic: true });
      } else {
        setError(err.message || t('gameTemplates.publishFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  // Portaled to <body>: the details header is its own stacking context and
  // would otherwise trap the fixed overlay underneath the bottom navigation.
  return createPortal(
    <div className="modal-overlay publish-game-overlay" {...backdrop}>
      <div
        className="modal-container publish-game-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-game-title"
        aria-describedby="publish-game-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="publish-game-icon" aria-hidden="true">
          <Icon name="Users" size={22} />
        </div>
        <h2 id="publish-game-title" className="publish-game-title">{t('publishGame.title')}</h2>
        <p className="publish-game-name">{gameName}</p>
        <p id="publish-game-desc" className="publish-game-desc">{t('publishGame.description')}</p>
        {error && <p className="modal-error" role="alert">{error}</p>}
        <div className="publish-game-actions">
          <button className="modal-button secondary" onClick={close} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="modal-button primary" onClick={() => void handlePublish()} disabled={busy}>
            {busy ? t('publishGame.publishing') : t('publishGame.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

PublishGameModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  gameName: PropTypes.string.isRequired,
  gameId: PropTypes.string.isRequired,
  onPublished: PropTypes.func.isRequired,
};

export default PublishGameModal;
