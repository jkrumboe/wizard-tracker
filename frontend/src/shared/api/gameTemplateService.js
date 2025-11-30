// Game Template Service
// Handles all game template API operations including user templates,
// system templates, and suggestion workflow

import { API_BASE_URL } from './config';

const ENDPOINTS = {
  templates: `${API_BASE_URL}/api/game-templates`,
  suggest: (id) => `${API_BASE_URL}/api/game-templates/${id}/suggest`,
  suggestChange: (id) => `${API_BASE_URL}/api/game-templates/system/${id}/suggest-change`,
  adminSuggestions: `${API_BASE_URL}/api/game-templates/admin/suggestions`,
  approveSuggestion: (id) => `${API_BASE_URL}/api/game-templates/admin/suggestions/${id}/approve`,
  rejectSuggestion: (id) => `${API_BASE_URL}/api/game-templates/admin/suggestions/${id}`,
  templateById: (id) => `${API_BASE_URL}/api/game-templates/${id}`,
};

/**
 * Get all accessible templates for current user
 * Returns system templates (public) + user's own templates
 * @returns {Promise<Array>} Array of template objects
 */
export const getTemplates = async () => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(ENDPOINTS.templates, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch templates');
    }

    const data = await response.json();
    return data.templates || [];
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
};

/**
 * Get only system templates (public, type='system')
 * No authentication required
 * @returns {Promise<Array>} Array of system template objects
 */
export const getSystemTemplates = async () => {
  try {
    const response = await fetch(`${ENDPOINTS.templates}/public`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch system templates');
    }

    const data = await response.json();
    return data.templates || [];
  } catch (error) {
    console.error('Error fetching system templates:', error);
    // Return empty array if error occurs
    return [];
  }
};

/**
 * Get only user's own templates (type='user')
 * @returns {Promise<Array>} Array of user template objects
 */
export const getUserTemplates = async () => {
  try {
    const templates = await getTemplates();
    return Array.isArray(templates) ? templates.filter(template => template.type === 'user') : [];
  } catch (error) {
    console.error('Error fetching user templates:', error);
    // Return empty array if not authenticated or error occurs
    return [];
  }
};

/**
 * Create a new user template
 * @param {Object} templateData - Template data
 * @param {string} templateData.localId - Local identifier for syncing
 * @param {string} templateData.name - Template name
 * @param {number} templateData.targetNumber - Target score/rounds
 * @param {boolean} templateData.lowIsBetter - Scoring direction
 * @param {string} [templateData.description] - Optional description
 * @returns {Promise<Object>} Created template object
 */
export const createTemplate = async (templateData) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(ENDPOINTS.templates, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create template');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
};

/**
 * Update an existing user template
 * @param {string} id - Template ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.name] - New name
 * @param {number} [updates.targetNumber] - New target
 * @param {boolean} [updates.lowIsBetter] - New scoring direction
 * @param {string} [updates.description] - New description
 * @returns {Promise<Object>} Updated template object
 */
export const updateTemplate = async (id, updates) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(ENDPOINTS.templateById(id), {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update template');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
};

/**
 * Delete a user template
 * @param {string} id - Template ID
 * @returns {Promise<Object>} Success message
 */
export const deleteTemplate = async (id) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(ENDPOINTS.templateById(id), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete template');
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
};

/**
 * Suggest a template to admin for promotion to system template
 * @param {string} id - Template ID
 * @param {string} [note] - Optional note to admin
 * @returns {Promise<Object>} Created suggestion object
 */
export const suggestTemplate = async (id, note = '') => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(ENDPOINTS.suggest(id), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to suggest template');
    }

    return await response.json();
  } catch (error) {
    console.error('Error suggesting template:', error);
    throw error;
  }
};

/**
 * Get all pending template suggestions (admin only)
 * @returns {Promise<Array>} Array of suggestion objects with user info
 */
export const getAdminSuggestions = async () => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(ENDPOINTS.adminSuggestions, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch suggestions');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching admin suggestions:', error);
    throw error;
  }
};

/**
 * Approve a template suggestion (admin only)
 * Converts suggested template to system template
 * @param {string} id - Suggestion ID
 * @returns {Promise<Object>} Approved system template
 */
export const approveSuggestion = async (id) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(ENDPOINTS.approveSuggestion(id), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve suggestion');
    }

    return await response.json();
  } catch (error) {
    console.error('Error approving suggestion:', error);
    throw error;
  }
};

/**
 * Reject a template suggestion (admin only)
 * Deletes the suggested template
 * @param {string} id - Suggestion ID
 * @returns {Promise<Object>} Success message
 */
export const rejectSuggestion = async (id) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(ENDPOINTS.rejectSuggestion(id), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject suggestion');
    }

    return await response.json();
  } catch (error) {
    console.error('Error rejecting suggestion:', error);
    throw error;
  }
};

/**
 * Suggest changes to a system template
 * @param {string} id - System template ID
 * @param {Object} changes - Proposed changes
 * @param {string} note - Explanation for the changes
 * @returns {Promise<Object>} Created suggestion
 */
export const suggestSystemTemplateChanges = async (id, changes, note) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(ENDPOINTS.suggestChange(id), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...changes, suggestionNote: note }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit change request');
    }

    return await response.json();
  } catch (error) {
    console.error('Error suggesting template changes:', error);
    throw error;
  }
};

export default {
  getTemplates,
  getSystemTemplates,
  getUserTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  suggestTemplate,
  suggestSystemTemplateChanges,
  getAdminSuggestions,
  approveSuggestion,
  rejectSuggestion,
};
