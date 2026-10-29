// Game Template Service
// Handles all game template API operations including user templates,
// system templates, and suggestion workflow

import { API_BASE_URL } from './config';
import { queryClient, queryKeys } from './queryClient';

const ENDPOINTS = {
  templates: `${API_BASE_URL}/api/game-templates`,
  suggest: (id) => `${API_BASE_URL}/api/game-templates/${id}/suggest`,
  suggestChange: (id) => `${API_BASE_URL}/api/game-templates/system/${id}/suggest-change`,
  updateSystemTemplate: (id) => `${API_BASE_URL}/api/game-templates/system/${id}`,
  systemGameInfo: (id) => `${API_BASE_URL}/api/game-templates/system/${id}/game-info`,
  suggestBoxArt: (id) => `${API_BASE_URL}/api/game-templates/system/${id}/suggest-box-art`,
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
 * No authentication required. Throws on failure so the error isn't cached
 * as an empty list (see templateResolver.loadSystemTemplates).
 * @returns {Promise<Array>} Array of system template objects
 */
export const getSystemTemplates = async () => {
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
};

// System templates changed on the server; the next load fetches them fresh
const invalidateSystemTemplates = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.systemTemplates });

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
      body: JSON.stringify({ suggestionNote: note }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || `Failed to suggest template (HTTP ${response.status})`);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  } catch (error) {
    console.error('Error suggesting template:', error);
    throw error;
  }
};

/**
 * Template suggestions for review (admin only)
 * @param {'pending'|'approved'|'rejected'|'all'} [status='pending'] - The queue, or the review history
 * @returns {Promise<{suggestions: Array, counts: {pending: number, approved: number, rejected: number}}>}
 */
export const getAdminSuggestions = async (status = 'pending') => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${ENDPOINTS.adminSuggestions}?status=${encodeURIComponent(status)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch suggestions');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching admin suggestions:', error);
    throw error;
  }
};

/**
 * Approve a template suggestion (admin only) and apply it to the system templates
 * @param {string} id - Suggestion ID
 * @param {Object} [options]
 * @param {string} [options.reviewNote] - Kept with the suggestion for the history
 * @param {boolean} [options.allowDuplicate] - Add a new template even if one has that name
 * @returns {Promise<Object>} The system template and the fields that were applied
 * @throws {Error} With `code: 'DUPLICATE_NAME'` and `duplicateOf` when the name is taken
 */
export const approveSuggestion = async (id, { reviewNote = '', allowDuplicate = false } = {}) => {
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
      body: JSON.stringify({ reviewNote, allowDuplicate }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to approve suggestion');
      err.status = response.status;
      err.code = error.code;
      err.duplicateOf = error.duplicateOf;
      throw err;
    }

    void invalidateSystemTemplates();
    return await response.json();
  } catch (error) {
    console.error('Error approving suggestion:', error);
    throw error;
  }
};

/**
 * Reject a template suggestion (admin only). It stays in the review history.
 * @param {string} id - Suggestion ID
 * @param {string} [reviewNote] - Why it was rejected
 * @returns {Promise<Object>} Success message
 */
export const rejectSuggestion = async (id, reviewNote = '') => {
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
      body: JSON.stringify({ reviewNote }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to reject suggestion');
      err.status = response.status;
      throw err;
    }

    return await response.json();
  } catch (error) {
    console.error('Error rejecting suggestion:', error);
    throw error;
  }
};

/**
 * Directly update a system template (admin only)
 * @param {string} id - System template ID or builtin template key
 * @param {Object} data - Updated template data
 * @returns {Promise<Object>} Updated template
 */
export const updateSystemTemplate = async (id, data) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(ENDPOINTS.updateSystemTemplate(id), {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update system template');
    }

    void invalidateSystemTemplates();
    return await response.json();
  } catch (error) {
    console.error('Error updating system template:', error);
    throw error;
  }
};

/**
 * Share box art from a scan on a system game with everyone. The server only
 * takes it when the game has none yet.
 * @param {string} id - System template ID (Mongo or built-in)
 * @param {Object} gameInfo
 * @returns {Promise<Object|null>} { updated, gameInfo }, or null when logged out or it failed
 */
export const shareSystemGameInfo = async (id, gameInfo) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token || !id || !gameInfo) return null;

    const response = await fetch(ENDPOINTS.systemGameInfo(id), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gameInfo }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (result?.updated) void invalidateSystemTemplates();
    return result;
  } catch (error) {
    console.warn('Could not share box art:', error);
    return null;
  }
};

/**
 * Suggest other box art for a system game. An admin approves it before anyone
 * sees it; a newer pick replaces the user's pending one.
 * @param {string} id - System template ID (Mongo or built-in)
 * @param {Object} gameInfo
 * @param {string} [note]
 * @returns {Promise<Object>} Created or updated suggestion
 */
export const suggestSystemBoxArt = async (id, gameInfo, note = '') => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(ENDPOINTS.suggestBoxArt(id), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gameInfo, suggestionNote: note }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to suggest box art (HTTP ${response.status})`);
  }

  return (await response.json()).suggestion;
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

/**
 * Look up what product a game box barcode (EAN/UPC) belongs to
 * @param {string} code
 * @returns {Promise<{title: string, names: string[], gameInfo: Object|null, details: Object|null,
 *   verified: boolean, candidates: Array<{name: string, gameInfo: Object|null}>,
 *   detailsStatus: 'ok'|'unavailable'|'failed'|null}|null>}
 *   Display title, clean game names for exact matching, box art/BGG metadata, (when the
 *   server has a BGG token) description and player counts, whether the match is verified,
 *   the games it could be otherwise, and whether the BGG details could be fetched;
 *   null if unknown/unavailable
 */
export const lookupBarcodeProduct = async (code) => {
  try {
    // Lookups are for logged-in users only (BGG API terms)
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    const response = await fetch(`${ENDPOINTS.templates}/barcode/${encodeURIComponent(code)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.title) return null;
    return {
      title: data.title,
      names: data.names || [],
      gameInfo: data.gameInfo || null,
      details: data.details || null,
      verified: Boolean(data.verified),
      candidates: data.candidates || [],
      detailsStatus: data.detailsStatus || null,
    };
  } catch (error) {
    console.warn('Barcode product lookup failed:', error);
    return null;
  }
};

/**
 * Find games on BoardGameGeek by name
 * @param {string} query - At least 2 characters
 * @returns {Promise<Array<{name: string, gameInfo: Object|null,
 *   details: {description: string, minPlayers: number|null, maxPlayers: number|null}}>|null>}
 *   Best matches first; null when logged out, offline or the search is unavailable
 */
export const searchGames = async (query) => {
  try {
    // Lookups are for logged-in users only (BGG API terms)
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    const response = await fetch(`${ENDPOINTS.templates}/search?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.warn('Game search failed:', error);
    return null;
  }
};

export default {
  getTemplates,
  lookupBarcodeProduct,
  searchGames,
  getSystemTemplates,
  getUserTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  suggestTemplate,
  updateSystemTemplate,
  shareSystemGameInfo,
  suggestSystemBoxArt,
  suggestSystemTemplateChanges,
  getAdminSuggestions,
  approveSuggestion,
  rejectSuggestion,
};
