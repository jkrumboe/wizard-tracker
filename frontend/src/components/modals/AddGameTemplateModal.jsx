import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/AddGameTemplateModal.css';

const AddGameTemplateModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onSuggest, 
  onSuggestChange,
  onSyncToCloud, 
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

  // Configure marked options
  useEffect(() => {
    marked.setOptions({
      breaks: true, // Convert \n to <br>
      gfm: true, // GitHub Flavored Markdown
    });
  }, []);

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

  const handleSave = () => {
    const trimmedName = gameName.trim();
    
    if (!trimmedName) {
      setError('Please enter a game name');
      return;
    }

    // Parse target number if provided
    const target = targetNumber.trim() ? parseInt(targetNumber, 10) : null;
    
    if (targetNumber.trim() && (isNaN(target) || target <= 0)) {
      setError('Target number must be a positive number');
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
      setError('Please enter a game name');
      return;
    }

    const target = targetNumber.trim() ? parseInt(targetNumber, 10) : null;
    
    if (targetNumber.trim() && (isNaN(target) || target <= 0)) {
      setError('Target number must be a positive number');
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
          <h2>{editMode ? 'Edit Game Type' : 'Create New Game'}</h2>
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
              Game Settings
            </button>
            <button
              className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              Game Rules
            </button>
          </div>

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <>
              <div className="add-section">
            <label htmlFor="game-name-input" className="game-name-label">
              Enter a name for the new game:
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
              placeholder="e.g., Wizard, Poker Night, Friday Games..."
              className="game-name-input"
              autoFocus
            />
          </div>

          <div className="add-section">
          <label htmlFor="target-number-input" className="game-name-label">
            Target Number (optional):
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
            placeholder="e.g., 100, 500..."
            className="game-name-input"
          />
          </div>
          
          <div className="add-section">
            <label className="game-name-label">
              Scoring Preference:
            </label>
            <div className="scoring-prefernce-type" style={{ display: 'flex'}}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={!lowIsBetter}
                  onChange={() => setLowIsBetter(false)}
                />
                High Score
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginLeft: '1rem' }}>
                <input
                  type="radio"
                  checked={lowIsBetter}
                  onChange={() => setLowIsBetter(true)}
                />
                Low Score
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
                  Game Rules & Instructions:
                </label>
                <button
                  type="button"
                  className="preview-toggle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPreview(!showPreview);
                  }}
                >
                  {showPreview ? 'Edit' : 'Preview'}
                </button>
              </div>
              <p className="markdown-hint">
                Explain how the game works. You can use markdown formatting for better organization.
              </p>
              {!showPreview ? (
                <>
                  <textarea
                    id="description-markdown-input"
                    value={descriptionMarkdown}
                    onChange={(e) => setDescriptionMarkdown(e.target.value)}
                    placeholder="## Setup&#10;- Each player gets 7 cards&#10;- Place deck in center&#10;&#10;## How to Play&#10;1. First step...&#10;2. Second step...&#10;&#10;## Scoring&#10;- Points are awarded for...&#10;&#10;## Images&#10;![Alt text](https://example.com/image.jpg)"
                    className="game-markdown-input"
                    rows="12"
                  />
                  <p className="markdown-hint">
                    💡 Tip: Use **bold**, *italic*, ## headers, - bullet lists, and ![alt](url) for images
                  </p>
                </>
              ) : (
                <div className="markdown-preview">
                  {descriptionMarkdown && descriptionMarkdown.trim() ? (
                    <div 
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: marked.parse(descriptionMarkdown) }}
                    />
                  ) : (
                    <p className="markdown-hint" style={{ padding: '2rem', textAlign: 'center' }}>
                      No rules written yet. Click "📝 Edit" to add game rules.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <div className="modal-error">{error}</div>}
        </div>

        <div className="add-game-modal-actions">
          <button className="modal-btn cancel-btn" onClick={onClose}>
            Cancel
          </button>
          {editMode && isSystemTemplate && onSuggestChange && (
            <button className="modal-btn suggest-btn" onClick={handleSuggestChange}>
              Request Changes
            </button>
          )}
          {editMode && !isSystemTemplate && onSuggest && (
            <button className="modal-btn suggest-btn" onClick={onSuggest}>
              Suggest Game Type
            </button>
          )}
          {!isSystemTemplate && (
            <button className="modal-btn save-btn" onClick={handleSave}>
              {editMode ? 'Save Changes' : 'Create Game'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddGameTemplateModal;
