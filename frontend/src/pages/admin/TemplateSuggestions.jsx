import React, { useState, useEffect } from 'react';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { safeMarkdownToHtml } from '@/shared/utils/markdownSanitizer';
import { useTranslation } from 'react-i18next';
import '@/styles/pages/admin.css';

// Simple diff display component
const DiffView = ({ label, oldValue, newValue }) => {
  const { t } = useTranslation();
  const hasChanged = oldValue !== newValue;
  
  if (!hasChanged && !oldValue) return null;
  
  return (
    <div className="diff-item">
      <label>{label}:</label>
      {hasChanged ? (
        <div className="diff-changes">
          {oldValue !== undefined && (
            <div className="diff-old">
              <span className="diff-label">{t('adminTemplates.oldLabel')}</span> {oldValue?.toString() || t('adminTemplates.empty')}
            </div>
          )}
          <div className="diff-new">
            <span className="diff-label">{t('adminTemplates.newLabel')}</span> {newValue?.toString() || t('adminTemplates.empty')}
          </div>
        </div>
      ) : (
        <span>{newValue?.toString() || oldValue?.toString()}</span>
      )}
    </div>
  );
};

const TemplateSuggestions = () => {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    if (!confirm(t('adminTemplates.approveConfirm'))) return;
    
    try {
      await gameTemplateService.approveSuggestion(id);
      alert(t('adminTemplates.approvedSuccess'));
      loadSuggestions();
    } catch (err) {
      console.error('Error approving suggestion:', err);
      alert(t('adminTemplates.approveFailed', { error: err.message }));
    }
  };

  const handleReject = async (id) => {
    const note = prompt(t('adminTemplates.rejectReason'));
    if (note === null) return; // User cancelled
    
    try {
      await gameTemplateService.rejectSuggestion(id);
      alert(t('adminTemplates.rejectedSuccess'));
      loadSuggestions();
    } catch (err) {
      console.error('Error rejecting suggestion:', err);
      alert(t('adminTemplates.rejectFailed', { error: err.message }));
    }
  };

  if (loading) {
    return <div className="admin-container"><div className="loading">{t('adminTemplates.loadingSuggestions')}</div></div>;
  }

  if (error) {
    return <div className="admin-container"><div className="error">{error}</div></div>;
  }

  return (
    <div className="admin-container">
      {/* <div className="admin-header">
        <h1>Template Suggestions</h1>
        <p className="subtitle">Review and approve user-submitted game templates</p>
      </div> */}

      {suggestions.length === 0 ? (
        <div className="no-suggestions">
          <p>{t('adminTemplates.noSuggestions')}</p>
        </div>
      ) : (
        <div className="suggestions-list">
          {suggestions.map((suggestion) => (
            <div key={suggestion._id} className="suggestion-card">
              <div className="suggestion-header">
                <h2>{suggestion.name}</h2>
                <div className="suggestion-meta">
                  <span className={`badge badge-${suggestion.suggestionType || 'new'}`}>
                    {suggestion.suggestionType === 'change' ? t('adminTemplates.changeRequest') : t('adminTemplates.newTemplate')}
                  </span>
                  <span className="badge">
                    {new Date(suggestion.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="suggestion-content">
                <div className="suggestion-details">
                  <div className="detail-item" id='submitter'>
                    <label>{t('adminTemplates.submittedBy')}</label>
                    <span>{suggestion.userId?.username || t('common.unknown')}</span>
                  </div>

                  {/* Show diff view for change requests */}
                  {suggestion.suggestionType === 'change' && suggestion.systemTemplateId ? (
                    <>
                      {/* <div className="detail-item full-width">
                        <label>Modifying Template:</label>
                        <span className="template-ref">{suggestion.systemTemplateId.name || 'System Template'}</span>
                      </div> */}
                      
                      <div className="detail-item full-width">
                        <label>{t('adminTemplates.changesRequested')}</label>
                        <div className="diff-container">
                          <DiffView 
                            label={t('adminTemplates.templateName')} 
                            oldValue={suggestion.systemTemplateId.name}
                            newValue={suggestion.name}
                          />
                          <DiffView 
                            label={t('adminTemplates.targetNumber')} 
                            oldValue={suggestion.systemTemplateId.targetNumber}
                            newValue={suggestion.targetNumber}
                          />
                          <DiffView 
                            label={t('adminTemplates.scoring')} 
                            oldValue={suggestion.systemTemplateId.lowIsBetter ? t('adminTemplates.lowScore') : t('adminTemplates.highScore')}
                            newValue={suggestion.lowIsBetter ? t('adminTemplates.lowScore') : t('adminTemplates.highScore')}
                          />
                          <DiffView 
                            label={t('adminTemplates.description')} 
                            oldValue={suggestion.systemTemplateId.description}
                            newValue={suggestion.description}
                          />
                        </div>
                      </div>

                      {/* Show markdown diff */}
                      {(suggestion.descriptionMarkdown || suggestion.systemTemplateId.descriptionMarkdown) && (
                        <div className="detail-item full-width">
                          <label>{t('adminTemplates.gameRulesChanges')}</label>
                          {suggestion.systemTemplateId.descriptionMarkdown !== suggestion.descriptionMarkdown ? (
                            <div className="markdown-diff">
                              {suggestion.systemTemplateId.descriptionMarkdown && (
                                <div className="markdown-old">
                                  <h4>{t('adminTemplates.previousRules')}</h4>
                                  <div 
                                    className="markdown-preview-admin"
                                    dangerouslySetInnerHTML={{ __html: safeMarkdownToHtml(suggestion.systemTemplateId.descriptionMarkdown) }}
                                  />
                                </div>
                              )}
                              {suggestion.descriptionMarkdown && (
                                <div className="markdown-new">
                                  <h4>{t('adminTemplates.newRules')}</h4>
                                  <div 
                                    className="markdown-preview-admin"
                                    dangerouslySetInnerHTML={{ __html: safeMarkdownToHtml(suggestion.descriptionMarkdown) }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div 
                              className="markdown-preview-admin"
                              dangerouslySetInnerHTML={{ __html: safeMarkdownToHtml(suggestion.descriptionMarkdown || suggestion.systemTemplateId.descriptionMarkdown) }}
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
                          <label>{t('adminTemplates.targetNumberLabel')}</label>
                          <span>{suggestion.targetNumber}</span>
                        </div>
                      )}

                      <div className="detail-item">
                        <label>{t('adminTemplates.scoringLabel')}</label>
                        <span>{suggestion.lowIsBetter ? t('adminTemplates.lowScore') : t('adminTemplates.highScore')}</span>
                      </div>

                      {suggestion.description && (
                        <div className="detail-item full-width">
                          <label>{t('adminTemplates.descriptionLabel')}</label>
                          <p>{suggestion.description}</p>
                        </div>
                      )}

                      {suggestion.descriptionMarkdown && (
                        <div className="detail-item full-width">
                          <label>{t('adminTemplates.gameRulesLabel')}</label>
                          <div 
                            className="markdown-preview-admin"
                            dangerouslySetInnerHTML={{ __html: safeMarkdownToHtml(suggestion.descriptionMarkdown) }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {suggestion.suggestionNote && (
                    <div className="detail-item full-width">
                      <label>{t('adminTemplates.usersNote')}</label>
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
                  {t('adminTemplates.reject')}
                </button>
                <button 
                  className="btn-approve" 
                  onClick={() => handleApprove(suggestion._id)}
                >
                  {t('adminTemplates.approveAndAdd')}
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
