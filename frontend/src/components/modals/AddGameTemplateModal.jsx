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
  isSystemTemplate = false,
  defaultGameCategory = 'table',
}) => {
  const [gameName, setGameName] = useState('');
  const [gameCategory, setGameCategory] = useState('table');
  const [targetNumber, setTargetNumber] = useState('');
  const [lowIsBetter, setLowIsBetter] = useState(false);
  const [description, setDescription] = useState('');
  const [descriptionMarkdown, setDescriptionMarkdown] = useState('');
  // Call & Made settings
  const [baseCorrect, setBaseCorrect] = useState(20);
  const [bonusPerTrick, setBonusPerTrick] = useState(10);
  const [penaltyPerDiff, setPenaltyPerDiff] = useState(-10);
  const [roundPattern, setRoundPattern] = useState('pyramid');
  const [callAndMadeMaxRounds, setCallAndMadeMaxRounds] = useState(20);
  const [hasDealerRotation, setHasDealerRotation] = useState(true);
  const [hasForbiddenCall, setHasForbiddenCall] = useState(true);

  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' or 'rules'
  const [showPreview, setShowPreview] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      if (editMode && initialData) {
        // Populate with existing data when editing
        setGameName(initialData.name || '');
        setGameCategory(initialData.gameCategory || 'table');
        setTargetNumber(initialData.targetNumber ? initialData.targetNumber.toString() : '');
        setLowIsBetter(initialData.lowIsBetter || false);
        setDescription(initialData.description || '');
        setDescriptionMarkdown(initialData.descriptionMarkdown || '');
        // Call & Made fields
        if (initialData.scoringFormula) {
          setBaseCorrect(initialData.scoringFormula.baseCorrect ?? 20);
          setBonusPerTrick(initialData.scoringFormula.bonusPerTrick ?? 10);
          setPenaltyPerDiff(initialData.scoringFormula.penaltyPerDiff ?? -10);
        } else {
          setBaseCorrect(20);
          setBonusPerTrick(10);
          setPenaltyPerDiff(-10);
        }
        setRoundPattern(initialData.roundPattern || 'pyramid');
        setCallAndMadeMaxRounds(initialData.maxRounds || 20);
        setHasDealerRotation(initialData.hasDealerRotation !== false);
        setHasForbiddenCall(initialData.hasForbiddenCall !== false);
      } else {
        // Clear fields when creating new
        setGameName('');
        setGameCategory(defaultGameCategory);
        setTargetNumber('');
        setLowIsBetter(false);
        setDescription('');
        setDescriptionMarkdown('');
        setBaseCorrect(20);
        setBonusPerTrick(10);
        setPenaltyPerDiff(-10);
        setRoundPattern('pyramid');
        setCallAndMadeMaxRounds(20);
        setHasDealerRotation(true);
        setHasForbiddenCall(true);
      }
      setError('');
      setActiveTab('settings');
      setShowPreview(false);
    }
  }, [isOpen, editMode, initialData, defaultGameCategory]);

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

    // Parse target number if provided (table games only)
    const target = gameCategory === 'table' && targetNumber.trim() ? Number.parseInt(targetNumber, 10) : null;

    if (gameCategory === 'table' && targetNumber.trim() && (Number.isNaN(target) || target <= 0)) {
      setError(t('templateModal.targetPositiveError'));
      return;
    }

    const settings = {
      gameCategory,
      description: description.trim(),
      descriptionMarkdown: descriptionMarkdown.trim(),
    };

    if (gameCategory === 'table') {
      settings.targetNumber = target;
      settings.lowIsBetter = lowIsBetter;
    } else {
      settings.scoringFormula = { baseCorrect, bonusPerTrick, penaltyPerDiff };
      settings.roundPattern = roundPattern;
      settings.maxRounds = callAndMadeMaxRounds;
      settings.hasDealerRotation = hasDealerRotation;
      settings.hasForbiddenCall = hasForbiddenCall;
    }

    onSave(trimmedName, settings);
    onClose();
  };

  const handleSuggestChange = () => {
    const trimmedName = gameName.trim();

    if (!trimmedName) {
      setError(t('templateModal.enterGameNameError'));
      return;
    }

    const target = gameCategory === 'table' && targetNumber.trim() ? Number.parseInt(targetNumber, 10) : null;

    if (gameCategory === 'table' && targetNumber.trim() && (Number.isNaN(target) || target <= 0)) {
      setError(t('templateModal.targetPositiveError'));
      return;
    }

    const suggestData = {
      name: trimmedName,
      gameCategory,
      description: description.trim(),
      descriptionMarkdown: descriptionMarkdown.trim(),
    };

    if (gameCategory === 'table') {
      suggestData.targetNumber = target;
      suggestData.lowIsBetter = lowIsBetter;
    } else {
      suggestData.scoringFormula = { baseCorrect, bonusPerTrick, penaltyPerDiff };
      suggestData.roundPattern = roundPattern;
      suggestData.maxRounds = callAndMadeMaxRounds;
      suggestData.hasDealerRotation = hasDealerRotation;
      suggestData.hasForbiddenCall = hasForbiddenCall;
    }

    onSuggestChange(suggestData);
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
                <label className="game-name-label">
                  {t('templateModal.gameCategoryLabel')}
                </label>
                <div className="category-toggle">
                  <button
                    type="button"
                    className={`category-btn ${gameCategory === 'table' ? 'active' : ''}`}
                    onClick={() => setGameCategory('table')}
                  >
                    {t('templateModal.tableCategory')}
                  </button>
                  <button
                    type="button"
                    className={`category-btn ${gameCategory === 'callAndMade' ? 'active' : ''}`}
                    onClick={() => setGameCategory('callAndMade')}
                  >
                    {t('templateModal.callAndMadeCategory')}
                  </button>
                </div>
              </div>

              {/* Table game settings */}
              {gameCategory === 'table' && (
                <>
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
                </>
              )}

              {/* Call & Made game settings */}
              {gameCategory === 'callAndMade' && (
                <>
                  <div className="add-section">
                    <label className="game-name-label">
                      {t('templateModal.scoringFormulaLabel')}
                    </label>
                    <div className="scoring-formula-fields">
                      <div className="formula-field">
                        <label htmlFor="base-correct-input">{t('templateModal.baseCorrectLabel')}</label>
                        <input
                          id="base-correct-input"
                          type="number"
                          value={baseCorrect}
                          onChange={(e) => setBaseCorrect(Number(e.target.value) || 0)}
                          className="game-name-input"
                        />
                      </div>
                      <div className="formula-field">
                        <label htmlFor="bonus-per-trick-input">{t('templateModal.bonusPerTrickLabel')}</label>
                        <input
                          id="bonus-per-trick-input"
                          type="number"
                          value={bonusPerTrick}
                          onChange={(e) => setBonusPerTrick(Number(e.target.value) || 0)}
                          className="game-name-input"
                        />
                      </div>
                      <div className="formula-field">
                        <label htmlFor="penalty-per-diff-input">{t('templateModal.penaltyPerDiffLabel')}</label>
                        <input
                          id="penalty-per-diff-input"
                          type="number"
                          value={penaltyPerDiff}
                          onChange={(e) => setPenaltyPerDiff(Number(e.target.value) || 0)}
                          className="game-name-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="add-section">
                    <label htmlFor="round-pattern-select" className="game-name-label">
                      {t('templateModal.roundPatternLabel')}
                    </label>
                    <select
                      id="round-pattern-select"
                      value={roundPattern}
                      onChange={(e) => setRoundPattern(e.target.value)}
                      className="game-name-input"
                    >
                      <option value="pyramid">{t('templateModal.patternPyramid')}</option>
                      <option value="ascending">{t('templateModal.patternAscending')}</option>
                      <option value="fixed">{t('templateModal.patternFixed')}</option>
                    </select>
                  </div>

                  <div className="add-section">
                    <label htmlFor="max-rounds-input" className="game-name-label">
                      {t('templateModal.maxRoundsLabel')}
                    </label>
                    <input
                      id="max-rounds-input"
                      type="number"
                      min="1"
                      max="60"
                      value={callAndMadeMaxRounds}
                      onChange={(e) => setCallAndMadeMaxRounds(Number(e.target.value) || 1)}
                      className="game-name-input"
                    />
                  </div>

                  <div className="add-section">
                    <label className="game-name-label call-made-checkboxes-label">
                      {t('templateModal.gameRulesLabel')}
                    </label>
                    <div className="call-made-checkboxes">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={hasDealerRotation}
                          onChange={(e) => setHasDealerRotation(e.target.checked)}
                        />
                        {t('templateModal.dealerRotationLabel')}
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={hasForbiddenCall}
                          onChange={(e) => setHasForbiddenCall(e.target.checked)}
                        />
                        {t('templateModal.forbiddenCallLabel')}
                      </label>
                    </div>
                  </div>
                </>
              )}
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
