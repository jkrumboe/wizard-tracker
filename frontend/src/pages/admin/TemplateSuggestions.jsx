import React, { useState, useEffect } from 'react';
import gameTemplateService from '@/shared/api/gameTemplateService';
import '@/styles/pages/admin.css';

const TemplateSuggestions = () => {
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
                  
                  {suggestion.userId?.email && (
                    <div className="detail-item">
                      <label>Email:</label>
                      <span>{suggestion.userId.email}</span>
                    </div>
                  )}

                  {suggestion.targetNumber && (
                    <div className="detail-item">
                      <label>Target Number:</label>
                      <span>{suggestion.targetNumber}</span>
                    </div>
                  )}

                  <div className="detail-item">
                    <label>Scoring:</label>
                    <span>{suggestion.lowIsBetter ? 'Low Score Wins' : 'High Score Wins'}</span>
                  </div>

                  {suggestion.description && (
                    <div className="detail-item full-width">
                      <label>Description:</label>
                      <p>{suggestion.description}</p>
                    </div>
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
