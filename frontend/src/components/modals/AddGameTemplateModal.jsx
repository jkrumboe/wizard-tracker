import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { safeMarkdownToHtml } from '@/shared/utils/markdownSanitizer';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/AddGameTemplateModal.css';

const AddGameTemplateModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onSuggest, 
  onSuggestChange,
  onMakeLocalChanges,
  editMode = false, 
  initialData = null,
  isSystemTemplate = false
}) => {
  const [gameName, setGameName] = useState('');
  const [targetNumber, setTargetNumber] = useState('');
  const [lowIsBetter, setLowIsBetter] = useState(false);
  const [description, setDescription] = useState('');
  const [descriptionMarkdown, setDescriptionMarkdown] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' or 'rules'
  const [showPreview, setShowPreview] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      if (editMode && initialData) {
        // Populate with existing data when editing
        setGameName(initialData.name || '');
        setTargetNumber(initialData.targetNumber ? initialData.targetNumber.toString() : '');
        setLowIsBetter(initialData.lowIsBetter || false);
        setDescription(initialData.description || '');
        setDescriptionMarkdown(initialData.descriptionMarkdown || '');
      } else {
        // Clear fields when creating new
        setGameName('');
        setTargetNumber('');
        setLowIsBetter(false);
        setDescription('');
        setDescriptionMarkdown('');
      }
      setError('');
      setActiveTab('settings');
      setShowPreview(false);
    }
  }, [isOpen, editMode, initialData]);

  // Auto-show preview when switching to rules tab in edit mode
  useEffect(() => {
    if (activeTab === 'rules' && editMode) {
      setShowPreview(true);
    }
  }, [activeTab, editMode]);

  const handleSave = () => {
    const trimmedName = gameName.trim();
    
    if (!trimmedName) {
      setError(t('templateModal.enterGameNameError'));
      return;
    }

    // Parse target number if provided
    const target = targetNumber.trim() ? Number.parseInt(targetNumber, 10) : null;
    
    if (targetNumber.trim() && (Number.isNaN(target) || target <= 0)) {
      setError(t('templateModal.targetPositiveError'));
      return;
    }

    onSave(trimmedName, { 
      targetNumber: target, 
      lowIsBetter,
      description: description.trim(),
      descriptionMarkdown: descriptionMarkdown.trim()
    });
    onClose();
  };

  const handleSuggestChange = () => {
    const trimmedName = gameName.trim();
    
    if (!trimmedName) {
      setError(t('templateModal.enterGameNameError'));
      return;
    }

    const target = targetNumber.trim() ? Number.parseInt(targetNumber, 10) : null;
    
    if (targetNumber.trim() && (Number.isNaN(target) || target <= 0)) {
      setError(t('templateModal.targetPositiveError'));
      return;
    }

    onSuggestChange({
      name: trimmedName,
      targetNumber: target,
      lowIsBetter,
      description: description.trim(),
      descriptionMarkdown: descriptionMarkdown.trim()
    });
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="add-game-modal-overlay" onClick={onClose}>
      <div className="add-game-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editMode ? t('templateModal.editGameType') : t('templateModal.createNewGame')}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <div className="add-game-modal-content">
          {/* Tab Navigation */}
          <div className="modal-tabs">
            <button
              className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              {t('templateModal.gameSettingsTab')}
            </button>
            <button
              className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              {t('templateModal.gameRulesTab')}
            </button>
          </div>

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <>
              <div className="add-section">
            <label htmlFor="game-name-input" className="game-name-label">
              {t('templateModal.gameNameLabel')}
            </label>
            <input
              id="game-name-input"
              type="text"
              value={gameName}
              onChange={(e) => {
                setGameName(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('templateModal.gameNamePlaceholder')}
              className="game-name-input"
              autoFocus
            />
          </div>

          <div className="add-section">
          <label htmlFor="target-number-input" className="game-name-label">
            {t('templateModal.targetNumberLabel')}
          </label>
          <input
            id="target-number-input"
            type="number"
            min="1"
            value={targetNumber}
            onChange={(e) => {
              setTargetNumber(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('templateModal.targetNumberPlaceholder')}
            className="game-name-input"
          />
          </div>
          
          <div className="add-section">
            <label className="game-name-label">
              {t('templateModal.scoringPreference')}
            </label>
            <div className="scoring-prefernce-type" style={{ display: 'flex'}}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={!lowIsBetter}
                  onChange={() => setLowIsBetter(false)}
                />
                {t('templateModal.highScore')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer'}}>
                <input
                  type="radio"
                  checked={lowIsBetter}
                  onChange={() => setLowIsBetter(true)}
                />
                {t('templateModal.lowScore')}
              </label>
            </div>
          </div>

          {/* <div className="add-section">
            <label htmlFor="description-input" className="game-name-label">
              Short Description (optional):
            </label>
            <input
              id="description-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the game..."
              className="game-name-input"
            />
          </div> */}
            </>
          )}

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div className="add-section rules-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <label htmlFor="description-markdown-input" className="game-name-label" style={{ marginBottom: 0 }}>
                  {t('templateModal.rulesLabel')}
                </label>
                <button
                  type="button"
                  className="preview-toggle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPreview(!showPreview);
                  }}
                >
                  {showPreview ? t('templateModal.editBtn') : t('templateModal.preview')}
                </button>
              </div>
              {!showPreview ? (
                <>
                  <textarea
                    id="description-markdown-input"
                    value={descriptionMarkdown}
                    onChange={(e) => setDescriptionMarkdown(e.target.value)}
                    placeholder="## Setup&#10;- Each player gets 7 cards&#10;- Place deck in center&#10;&#10;## How to Play&#10;1. First step...&#10;2. Second step...&#10;&#10;## Scoring&#10;- Points are awarded for...&#10;&#10;"
                    className="game-markdown-input"
                    rows="20"
                  />
                  <p className="markdown-hint">
                    {t('templateModal.markdownHint')}
                  </p>
                </>
              ) : (
                <div className="markdown-preview">
                  {descriptionMarkdown && descriptionMarkdown.trim() ? (
                    <div 
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: safeMarkdownToHtml(descriptionMarkdown) }}
                    />
                  ) : (
                    <p className="markdown-hint" style={{ padding: '2rem', textAlign: 'center' }}>
                      {t('templateModal.noRulesYet')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <div className="modal-error">{error}</div>}
        </div>

        {(activeTab !== 'rules' && 
        <div className="add-game-modal-actions">
          {!editMode && (
          <button className="modal-btn cancel-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          )}
          {editMode && isSystemTemplate && onMakeLocalChanges && (
            <button className="modal-btn local-changes-btn" onClick={onMakeLocalChanges}>
              {t('templateModal.makeLocalChanges')}
            </button>
          )}
          {editMode && isSystemTemplate && onSuggestChange && (
            <button className="modal-btn suggest-btn" onClick={handleSuggestChange}>
              {t('templateModal.requestChanges')}
            </button>
          )}
          {editMode && !isSystemTemplate && onSuggest && (
            <button className="modal-btn suggest-btn" onClick={onSuggest}>
              {t('templateModal.suggestGameType')}
            </button>
          )}
          {!isSystemTemplate && (
            <button className="modal-btn save-btn" onClick={handleSave}>
              {editMode ? t('templateModal.saveChanges') : t('templateModal.createGame')}
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default AddGameTemplateModal;
