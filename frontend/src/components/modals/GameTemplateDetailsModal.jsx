import React from 'react';
import { marked } from 'marked';
import { XIcon } from '@/components/ui/Icon';
import '@/styles/components/GameTemplateDetailsModal.css';

const GameTemplateDetailsModal = ({ isOpen, onClose, template }) => {
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
            <h3>Game Settings</h3>
            <div className="details-grid">
              {template.targetNumber && (
                <div className="detail-item">
                  <label>Target Number:</label>
                  <span>{template.targetNumber}</span>
                </div>
              )}
              <div className="detail-item">
                <label>Scoring Target:</label>
                <span>{template.lowIsBetter ? 'Low Scores' : 'High Scores'}</span>
              </div>
            </div>
          </div>

          {/* Short Description */}
          {template.description && (
            <div className="details-section">
              <h3>Description</h3>
              <p className="template-description">{template.description}</p>
            </div>
          )}

          {/* Game Rules & Instructions */}
          {template.descriptionMarkdown && template.descriptionMarkdown.trim() && (
            <div className="details-section">
              {/* <h3>Game Rules & Instructions</h3> */}
              <div 
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: marked.parse(template.descriptionMarkdown) }}
              />
            </div>
          )}

          {!template.description && !template.descriptionMarkdown && (
            <div className="details-section">
              <p className="no-details">No additional details available for this game.</p>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="modal-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameTemplateDetailsModal;
