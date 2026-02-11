import React from 'react';
import { useTranslation } from 'react-i18next';
import { safeMarkdownToHtml } from '@/shared/utils/markdownSanitizer';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/GameTemplateDetailsModal.css';

const GameTemplateDetailsModal = ({ isOpen, onClose, template }) => {
  const { t } = useTranslation();
  if (!isOpen || !template) return null;

  return (
    <div className="game-details-modal-overlay" onClick={onClose}>
      <div className="game-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{template.name}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <div className="game-details-content">
          {/* Game Settings */}
          <div className="details-section">
            <h3>{t('templateDetails.gameSettings')}</h3>
            <div className="details-grid">
              {template.targetNumber && (
                <div className="detail-item">
                  <label>{t('templateDetails.targetNumber')}:</label>
                  <span>{template.targetNumber}</span>
                </div>
              )}
              <div className="detail-item">
                <label>{t('templateDetails.scoringTarget')}:</label>
                <span>{template.lowIsBetter ? t('templateDetails.lowScores') : t('templateDetails.highScores')}</span>
              </div>
            </div>
          </div>

          {/* Short Description */}
          {template.description && (
            <div className="details-section">
              <h3>{t('templateDetails.description')}</h3>
              <p className="template-description">{template.description}</p>
            </div>
          )}

          {/* Game Rules & Instructions */}
          {template.descriptionMarkdown && template.descriptionMarkdown.trim() && (
            <div className="details-section">
              {/* <h3>Game Rules & Instructions</h3> */}
              <div 
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: safeMarkdownToHtml(template.descriptionMarkdown) }}
              />
            </div>
          )}

          {!template.description && !template.descriptionMarkdown && (
            <div className="details-section">
              <p className="no-details">{t('templateDetails.noDetails')}</p>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="modal-btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameTemplateDetailsModal;
