import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import gameTemplateService from '@/shared/api/gameTemplateService';
import '@/styles/pages/admin.css';

// Simple diff display component
const DiffView = ({ label, oldValue, newValue }) => {
  const hasChanged = oldValue !== newValue;
  
  if (!hasChanged && !oldValue) return null;
  
  return (
    <div className="diff-item">
      <label>{label}:</label>
      {hasChanged ? (
        <div className="diff-changes">
          {oldValue !== undefined && (
            <div className="diff-old">
              <span className="diff-label">- Old:</span> {oldValue?.toString() || '(empty)'}
            </div>
          )}
          <div className="diff-new">
            <span className="diff-label">+ New:</span> {newValue?.toString() || '(empty)'}
          </div>
        </div>
      ) : (
        <span>{newValue?.toString() || oldValue?.toString()}</span>
      )}
    </div>
  );
};

const TemplateSuggestions = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Configure marked options
  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }, []);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const data = await gameTemplateService.getAdminSuggestions();
      setSuggestions(data.suggestions || []);
      setError('');
    } catch (err) {
      console.error('Error loading suggestions:', err);
      setError('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!confirm('Are you sure you want to approve this template suggestion?')) return;
    
    try {
      await gameTemplateService.approveSuggestion(id);
      alert('Template approved and added to system templates!');
      loadSuggestions();
    } catch (err) {
      console.error('Error approving suggestion:', err);
      alert('Failed to approve suggestion: ' + err.message);
    }
  };

  const handleReject = async (id) => {
    const note = prompt('Reason for rejection (optional):');
    if (note === null) return; // User cancelled
    
    try {
      await gameTemplateService.rejectSuggestion(id);
      alert('Template suggestion rejected');
      loadSuggestions();
    } catch (err) {
      console.error('Error rejecting suggestion:', err);
      alert('Failed to reject suggestion: ' + err.message);
    }
  };

  if (loading) {
    return <div className="admin-container"><div className="loading">Loading suggestions...</div></div>;
  }

  if (error) {
    return <div className="admin-container"><div className="error">{error}</div></div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Template Suggestions</h1>
        <p className="subtitle">Review and approve user-submitted game templates</p>
      </div>

      {suggestions.length === 0 ? (
        <div className="no-suggestions">
          <p>No pending suggestions</p>
        </div>
      ) : (
        <div className="suggestions-list">
          {suggestions.map((suggestion) => (
            <div key={suggestion._id} className="suggestion-card">
              <div className="suggestion-header">
                <h2>{suggestion.name}</h2>
                <div className="suggestion-meta">
                  <span className={`badge badge-${suggestion.suggestionType || 'new'}`}>
                    {suggestion.suggestionType === 'change' ? '📝 Change Request' : '✨ New Template'}
                  </span>
                  <span className="badge">
                    {new Date(suggestion.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="suggestion-content">
                <div className="suggestion-details">
                  <div className="detail-item">
                    <label>Submitted by:</label>
                    <span>{suggestion.userId?.username || 'Unknown'}</span>
                  </div>

                  {/* Show diff view for change requests */}
                  {suggestion.suggestionType === 'change' && suggestion.systemTemplateId ? (
                    <>
                      <div className="detail-item full-width">
                        <label>Modifying Template:</label>
                        <span className="template-ref">{suggestion.systemTemplateId.name || 'System Template'}</span>
                      </div>
                      
                      <div className="detail-item full-width">
                        <label>Changes Requested:</label>
                        <div className="diff-container">
                          <DiffView 
                            label="Template Name" 
                            oldValue={suggestion.systemTemplateId.name}
                            newValue={suggestion.name}
                          />
                          <DiffView 
                            label="Target Number" 
                            oldValue={suggestion.systemTemplateId.targetNumber}
                            newValue={suggestion.targetNumber}
                          />
                          <DiffView 
                            label="Scoring" 
                            oldValue={suggestion.systemTemplateId.lowIsBetter ? 'Low Score' : 'High Score'}
                            newValue={suggestion.lowIsBetter ? 'Low Score' : 'High Score'}
                          />
                          <DiffView 
                            label="Description" 
                            oldValue={suggestion.systemTemplateId.description}
                            newValue={suggestion.description}
                          />
                        </div>
                      </div>

                      {/* Show markdown diff */}
                      {(suggestion.descriptionMarkdown || suggestion.systemTemplateId.descriptionMarkdown) && (
                        <div className="detail-item full-width">
                          <label>Game Rules Changes:</label>
                          {suggestion.systemTemplateId.descriptionMarkdown !== suggestion.descriptionMarkdown ? (
                            <div className="markdown-diff">
                              {suggestion.systemTemplateId.descriptionMarkdown && (
                                <div className="markdown-old">
                                  <h4>Previous Rules:</h4>
                                  <div 
                                    className="markdown-preview-admin"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(suggestion.systemTemplateId.descriptionMarkdown) }}
                                  />
                                </div>
                              )}
                              {suggestion.descriptionMarkdown && (
                                <div className="markdown-new">
                                  <h4>New Rules:</h4>
                                  <div 
                                    className="markdown-preview-admin"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(suggestion.descriptionMarkdown) }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div 
                              className="markdown-preview-admin"
                              dangerouslySetInnerHTML={{ __html: marked.parse(suggestion.descriptionMarkdown || suggestion.systemTemplateId.descriptionMarkdown) }}
                            />
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Show regular fields for new templates */
                    <>
                      {suggestion.targetNumber && (
                        <div className="detail-item">
                          <label>Target Number:</label>
                          <span>{suggestion.targetNumber}</span>
                        </div>
                      )}

                      <div className="detail-item">
                        <label>Scoring:</label>
                        <span>{suggestion.lowIsBetter ? 'Low Score' : 'High Score'}</span>
                      </div>

                      {suggestion.description && (
                        <div className="detail-item full-width">
                          <label>Description:</label>
                          <p>{suggestion.description}</p>
                        </div>
                      )}

                      {suggestion.descriptionMarkdown && (
                        <div className="detail-item full-width">
                          <label>Game Rules:</label>
                          <div 
                            className="markdown-preview-admin"
                            dangerouslySetInnerHTML={{ __html: marked.parse(suggestion.descriptionMarkdown) }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {suggestion.suggestionNote && (
                    <div className="detail-item full-width">
                      <label>User's Note:</label>
                      <p className="suggestion-note">{suggestion.suggestionNote}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="suggestion-actions">
                <button 
                  className="btn-reject" 
                  onClick={() => handleReject(suggestion._id)}
                >
                  Reject
                </button>
                <button 
                  className="btn-approve" 
                  onClick={() => handleApprove(suggestion._id)}
                >
                  Approve & Add to System
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateSuggestions;
