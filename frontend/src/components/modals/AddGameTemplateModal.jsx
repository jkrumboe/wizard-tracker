import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { safeMarkdownToHtml } from '@/shared/utils/markdownSanitizer';
import { XIcon, MinusIcon, PlusIcon, UsersIcon, TrophyIcon, RefreshIcon, EyeIcon, EditIcon } from '@/components/ui/Icon';
import { calculateScore, generateRoundPattern } from '@/shared/utils/scoringFormulas';
import '@/styles/components/AddGameTemplateModal.css';

const ROUND_PATTERN_OPTIONS = [
  { key: 'pyramid', labelKey: 'templateModal.patternPyramidShort', descKey: 'templateModal.patternPyramid' },
  { key: 'ascending', labelKey: 'templateModal.patternAscendingShort', descKey: 'templateModal.patternAscending' },
  { key: 'fixed', labelKey: 'templateModal.patternFixedShort', descKey: 'templateModal.patternFixed' },
];

// Bar heights (in %) for the small round-pattern preview, using the real generators
const getPatternBars = (patternKey) => {
  const rounds = generateRoundPattern(patternKey, 7, { cardsPerRound: 3 });
  const peak = patternKey === 'fixed' ? 5 : Math.max(...rounds);
  return rounds.map((cards) => Math.round((cards / peak) * 100));
};

const Segmented = ({ options, value, onChange, ariaLabel }) => (
  <div className="agm-segmented" role="radiogroup" aria-label={ariaLabel}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        className={`agm-segment ${value === option.value ? 'is-active' : ''}`}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

/**
 * Number input with -/+ buttons. Keeps a text draft while typing so values
 * like "-" or "" can be entered without being coerced mid-edit.
 * onChange receives a number, or '' when allowEmpty and the field is cleared.
 */
const NumberStepper = ({ id, value, onChange, min, max, step = 1, allowEmpty = false, emptyStart, placeholder, t }) => {
  const [draft, setDraft] = useState(null);
  const numeric = value === '' || value == null ? null : Number(value);
  const clamp = (n) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

  const stepBy = (direction) => {
    setDraft(null);
    if (numeric == null) {
      onChange(clamp(emptyStart ?? min ?? 0));
      return;
    }
    onChange(clamp(numeric + direction * step));
  };

  const handleInput = (e) => {
    const raw = e.target.value;
    setDraft(raw);
    if (raw === '') {
      if (allowEmpty) onChange('');
      return;
    }
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) onChange(parsed);
  };

  const handleBlur = () => {
    setDraft(null);
    if (numeric == null) {
      if (!allowEmpty) onChange(clamp(min ?? 0));
      return;
    }
    if (clamp(numeric) !== numeric) onChange(clamp(numeric));
  };

  return (
    <div className="agm-stepper">
      <button
        type="button"
        className="agm-stepper-btn"
        onClick={() => stepBy(-1)}
        disabled={numeric != null && min != null && numeric <= min}
        aria-label={t('templateModal.decrease')}
        aria-controls={id}
      >
        <MinusIcon size={16} />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="agm-stepper-input"
        value={draft ?? (numeric ?? '')}
        onChange={handleInput}
        onBlur={handleBlur}
        placeholder={placeholder}
        min={min}
        max={max}
      />
      <button
        type="button"
        className="agm-stepper-btn"
        onClick={() => stepBy(1)}
        disabled={numeric != null && max != null && numeric >= max}
        aria-label={t('templateModal.increase')}
        aria-controls={id}
      >
        <PlusIcon size={16} />
      </button>
    </div>
  );
};

const ToggleRow = ({ label, hint, checked, onChange }) => (
  <label className="agm-toggle-row">
    <span className="agm-toggle-text">
      <span className="agm-toggle-label">{label}</span>
      {hint && <span className="agm-hint">{hint}</span>}
    </span>
    <input
      type="checkbox"
      role="switch"
      className="agm-switch"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);

const ScoreValue = ({ value }) => (
  <span className={`agm-score ${value < 0 ? 'is-negative' : 'is-positive'}`}>
    {value > 0 ? `+${value}` : value}
  </span>
);

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
  isAdmin = false,
  defaultGameCategory = 'table',
  // Locks the modal to one template type: 'table' | 'scoreboard' | 'callAndMade'.
  // When omitted, the user can pick between Table and Call & Made.
  templateType = null,
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
  // Player count limits
  const [minPlayersInput, setMinPlayersInput] = useState('');
  const [maxPlayersInput, setMaxPlayersInput] = useState('');

  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' or 'rules'
  const [showPreview, setShowPreview] = useState(false);
  const { t } = useTranslation();

  // In edit mode the type is derived from the template being edited;
  // changing the type of an existing template is not supported.
  const getInitialDataType = () => {
    if (!initialData) return null;
    if (initialData.scoreEntryMode === 'twoSideGesture') return 'scoreboard';
    return initialData.gameCategory || 'table';
  };
  const lockedType = editMode ? getInitialDataType() : templateType;
  const isScoreboard = lockedType === 'scoreboard';

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
        setMinPlayersInput(initialData.minPlayers == null ? '' : String(initialData.minPlayers));
        setMaxPlayersInput(initialData.maxPlayers == null ? '' : String(initialData.maxPlayers));
      } else {
        // Clear fields when creating new
        setGameName('');
        setGameCategory(
          templateType === 'callAndMade' ? 'callAndMade' : (templateType ? 'table' : defaultGameCategory)
        );
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
        setMinPlayersInput('');
        setMaxPlayersInput('');
      }
      setError('');
      setActiveTab('settings');
      setShowPreview(false);
    }
  }, [isOpen, editMode, initialData, defaultGameCategory, templateType]);

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

    const parsedMin = minPlayersInput.trim() ? Number.parseInt(minPlayersInput, 10) : null;
    const parsedMax = maxPlayersInput.trim() ? Number.parseInt(maxPlayersInput, 10) : null;

    if (parsedMin != null && (Number.isNaN(parsedMin) || parsedMin < 1)) {
      setError(t('templateModal.minPlayersError'));
      return;
    }
    if (parsedMax != null && (Number.isNaN(parsedMax) || parsedMax < 1)) {
      setError(t('templateModal.maxPlayersError'));
      return;
    }
    if (parsedMin != null && parsedMax != null && parsedMin > parsedMax) {
      setError(t('templateModal.minMaxPlayersError'));
      return;
    }

    const settings = {
      gameCategory,
      description: description.trim(),
      descriptionMarkdown: descriptionMarkdown.trim(),
      minPlayers: parsedMin,
      maxPlayers: parsedMax,
    };

    if (gameCategory === 'table') {
      settings.targetNumber = target;
      settings.lowIsBetter = isScoreboard ? false : lowIsBetter;
      if (isScoreboard) settings.scoreEntryMode = 'twoSideGesture';
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
      minPlayers: minPlayersInput.trim() ? Number.parseInt(minPlayersInput, 10) : null,
      maxPlayers: maxPlayersInput.trim() ? Number.parseInt(maxPlayersInput, 10) : null,
    };

    if (gameCategory === 'table') {
      suggestData.targetNumber = target;
      suggestData.lowIsBetter = isScoreboard ? false : lowIsBetter;
      if (isScoreboard) suggestData.scoreEntryMode = 'twoSideGesture';
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

  const scoringFormula = { baseCorrect, bonusPerTrick, penaltyPerDiff };
  const exampleCall = 2;

  if (!isOpen) return null;

  return (
    <div className="add-game-modal-overlay" onClick={onClose}>
      <div
        className="add-game-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-game-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header agm-header">
          <h2 id="add-game-modal-title">
            {editMode ? t('templateModal.editGameType') : t('templateModal.newGameType')}
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <div className="agm-tabs-bar">
          <Segmented
            ariaLabel={t('templateModal.gameSettingsTab')}
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'settings', label: t('templateModal.gameSettingsTab') },
              { value: 'rules', label: t('templateModal.gameRulesTab') },
            ]}
          />
        </div>

        <div className="add-game-modal-content">
          {activeTab === 'settings' && (
            <>
              <section className="agm-card">
                <label htmlFor="game-name-input" className="agm-field-label">
                  {t('templateModal.nameLabel')}
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
                  placeholder={isScoreboard
                    ? t('templateModal.scoreboardNamePlaceholder')
                    : t('templateModal.gameNamePlaceholder')}
                  className="agm-input"
                  autoFocus
                />

                {!lockedType && (
                  <div className="agm-field">
                    <span className="agm-field-label">{t('templateModal.typeLabel')}</span>
                    <Segmented
                      ariaLabel={t('templateModal.typeLabel')}
                      value={gameCategory}
                      onChange={setGameCategory}
                      options={[
                        { value: 'table', label: t('templateModal.tableCategory') },
                        { value: 'callAndMade', label: t('templateModal.callAndMadeCategory') },
                      ]}
                    />
                  </div>
                )}
              </section>

              <section className="agm-card">
                <h3 className="agm-card-title">
                  <UsersIcon size={16} />
                  {t('templateModal.playersSection')}
                </h3>
                <div className="agm-player-grid">
                  <div className="agm-player-field">
                    <label htmlFor="min-players-input">{t('templateModal.minShort')}</label>
                    <NumberStepper
                      id="min-players-input"
                      value={minPlayersInput}
                      onChange={(v) => { setMinPlayersInput(String(v)); setError(''); }}
                      min={1}
                      max={100}
                      allowEmpty
                      emptyStart={2}
                      placeholder="2"
                      t={t}
                    />
                  </div>
                  <div className="agm-player-field">
                    <label htmlFor="max-players-input">{t('templateModal.maxShort')}</label>
                    <NumberStepper
                      id="max-players-input"
                      value={maxPlayersInput}
                      onChange={(v) => { setMaxPlayersInput(String(v)); setError(''); }}
                      min={1}
                      max={100}
                      allowEmpty
                      emptyStart={Number.parseInt(minPlayersInput, 10) || 2}
                      placeholder="∞"
                      t={t}
                    />
                  </div>
                </div>
                <p className="agm-hint">{t('templateModal.maxPlayersHint')}</p>
              </section>

              {gameCategory === 'table' && (
                <section className="agm-card">
                  <h3 className="agm-card-title">
                    <TrophyIcon size={16} />
                    {t('templateModal.scoringSection')}
                  </h3>
                  <div className="agm-row">
                    <label htmlFor="target-number-input" className="agm-row-label">
                      {isScoreboard ? t('templateModal.pointsPerSetShort') : t('templateModal.targetScoreLabel')}
                    </label>
                    <input
                      id="target-number-input"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={targetNumber}
                      onChange={(e) => {
                        setTargetNumber(e.target.value);
                        setError('');
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={isScoreboard ? '25' : '—'}
                      className="agm-input agm-input-compact"
                    />
                  </div>
                  <p className="agm-hint">
                    {isScoreboard ? t('templateModal.pointsPerSetHint') : t('templateModal.targetScoreHint')}
                  </p>

                  {!isScoreboard && (
                    <div className="agm-field">
                      <span className="agm-field-label">{t('templateModal.winnerLabel')}</span>
                      <Segmented
                        ariaLabel={t('templateModal.winnerLabel')}
                        value={lowIsBetter ? 'low' : 'high'}
                        onChange={(v) => setLowIsBetter(v === 'low')}
                        options={[
                          { value: 'high', label: t('templateModal.highestWins') },
                          { value: 'low', label: t('templateModal.lowestWins') },
                        ]}
                      />
                    </div>
                  )}
                </section>
              )}

              {gameCategory === 'callAndMade' && (
                <>
                  <section className="agm-card">
                    <h3 className="agm-card-title">
                      <TrophyIcon size={16} />
                      {t('templateModal.scoringSection')}
                    </h3>
                    <div className="agm-row">
                      <label htmlFor="base-correct-input" className="agm-row-label">
                        {t('templateModal.baseCorrectLabel')}
                      </label>
                      <NumberStepper
                        id="base-correct-input"
                        value={baseCorrect}
                        onChange={(v) => setBaseCorrect(v === '' ? 0 : v)}
                        step={5}
                        t={t}
                      />
                    </div>
                    <div className="agm-row">
                      <label htmlFor="bonus-per-trick-input" className="agm-row-label">
                        {t('templateModal.bonusPerTrickLabel')}
                      </label>
                      <NumberStepper
                        id="bonus-per-trick-input"
                        value={bonusPerTrick}
                        onChange={(v) => setBonusPerTrick(v === '' ? 0 : v)}
                        step={5}
                        t={t}
                      />
                    </div>
                    <div className="agm-row">
                      <label htmlFor="penalty-per-diff-input" className="agm-row-label">
                        {t('templateModal.penaltyPerDiffLabel')}
                      </label>
                      <NumberStepper
                        id="penalty-per-diff-input"
                        value={penaltyPerDiff}
                        onChange={(v) => setPenaltyPerDiff(v === '' ? 0 : v)}
                        step={5}
                        t={t}
                      />
                    </div>
                    <div className="agm-example" aria-live="polite">
                      <span className="agm-example-title">{t('templateModal.exampleLabel')}</span>
                      <div className="agm-example-row">
                        <span>{t('templateModal.exampleCallMade', { call: exampleCall, made: exampleCall })}</span>
                        <ScoreValue value={calculateScore(scoringFormula, exampleCall, exampleCall)} />
                      </div>
                      <div className="agm-example-row">
                        <span>{t('templateModal.exampleCallMade', { call: exampleCall, made: 0 })}</span>
                        <ScoreValue value={calculateScore(scoringFormula, exampleCall, 0)} />
                      </div>
                    </div>
                  </section>

                  <section className="agm-card">
                    <h3 className="agm-card-title">
                      <RefreshIcon size={16} />
                      {t('templateModal.roundsSection')}
                    </h3>
                    <div className="agm-pattern-grid" role="radiogroup" aria-label={t('templateModal.roundPatternLabel')}>
                      {ROUND_PATTERN_OPTIONS.map(({ key, labelKey, descKey }) => (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={roundPattern === key}
                          title={t(descKey)}
                          className={`agm-pattern ${roundPattern === key ? 'is-active' : ''}`}
                          onClick={() => setRoundPattern(key)}
                        >
                          <span className="agm-pattern-bars" aria-hidden="true">
                            {getPatternBars(key).map((height, i) => (
                              <span key={i} style={{ height: `${height}%` }} />
                            ))}
                          </span>
                          <span className="agm-pattern-label">{t(labelKey)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="agm-row">
                      <label htmlFor="max-rounds-input" className="agm-row-label">
                        {t('templateModal.maxRoundsShort')}
                      </label>
                      <NumberStepper
                        id="max-rounds-input"
                        value={callAndMadeMaxRounds}
                        onChange={(v) => setCallAndMadeMaxRounds(v === '' ? 1 : v)}
                        min={1}
                        max={60}
                        t={t}
                      />
                    </div>
                  </section>

                  <section className="agm-card agm-card-flush">
                    <ToggleRow
                      label={t('templateModal.dealerRotationLabel')}
                      hint={t('templateModal.dealerRotationHint')}
                      checked={hasDealerRotation}
                      onChange={setHasDealerRotation}
                    />
                    <ToggleRow
                      label={t('templateModal.forbiddenCallLabel')}
                      hint={t('templateModal.forbiddenCallHint')}
                      checked={hasForbiddenCall}
                      onChange={setHasForbiddenCall}
                    />
                  </section>
                </>
              )}
            </>
          )}

          {activeTab === 'rules' && (
            <div className="rules-section">
              <div className="agm-rules-header">
                <label htmlFor="description-markdown-input" className="agm-field-label">
                  {t('templateModal.rulesLabel')}
                </label>
                <button
                  type="button"
                  className="agm-ghost-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPreview(!showPreview);
                  }}
                >
                  {showPreview ? <EditIcon size={14} /> : <EyeIcon size={14} />}
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
                    rows="16"
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
        </div>

        {error && <div className="modal-error agm-error" role="alert">{error}</div>}

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
          {editMode && isSystemTemplate && !isAdmin && onSuggestChange && (
            <button className="modal-btn suggest-btn" onClick={handleSuggestChange}>
              {t('templateModal.requestChanges')}
            </button>
          )}
          {editMode && isSystemTemplate && isAdmin && (
            <button className="modal-btn save-btn" onClick={handleSave}>
              {t('templateModal.saveChanges')}
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
      </div>
    </div>
  );
};

export default AddGameTemplateModal;
