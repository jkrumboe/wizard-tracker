/**
 * Local Table Game Template Storage Service
 * Handles saving, loading, and managing reusable game templates (game names)
 */

const LOCAL_TABLE_GAME_TEMPLATES_KEY = "wizardTracker_tableGameTemplates";

export class LocalTableGameTemplate {
  /**
   * Save a new game template
   * @param {string} gameName - The game name to save as a template
   * @param {Object} settings - Optional game settings (targetNumber, lowIsBetter)
   * @returns {string} - The template ID
   */
  static saveTemplate(gameName, settings = {}) {
    const templateId = this.generateTemplateId();
    const timestamp = new Date().toISOString();
    
    try {
      const template = {
        id: templateId,
        name: gameName.trim(),
        createdAt: timestamp,
        lastUsed: timestamp,
        usageCount: 0,
        targetNumber: settings.targetNumber || null,
        lowIsBetter: settings.lowIsBetter || false
      };

      const existingTemplates = this.getAllTemplates();
      existingTemplates[templateId] = template;

      localStorage.setItem(LOCAL_TABLE_GAME_TEMPLATES_KEY, JSON.stringify(existingTemplates));

      return templateId;
    } catch (error) {
      console.error("Error saving game template:", error);
      throw error;
    }
  }

  /**
   * Update an existing template
   * @param {string} templateId - The template ID to update
   * @param {string} newName - The new name for the template
   * @param {Object} settings - Optional game settings (targetNumber, lowIsBetter)
   */
  static updateTemplate(templateId, newName, settings = {}) {
    try {
      const templates = this.getAllTemplates();
      
      if (templates[templateId]) {
        templates[templateId].name = newName.trim();
        
        // Update settings if provided
        if (settings.targetNumber !== undefined) {
          templates[templateId].targetNumber = settings.targetNumber;
        }
        if (settings.lowIsBetter !== undefined) {
          templates[templateId].lowIsBetter = settings.lowIsBetter;
        }
        
        localStorage.setItem(LOCAL_TABLE_GAME_TEMPLATES_KEY, JSON.stringify(templates));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error updating game template:", error);
      throw error;
    }
  }

  /**
   * Delete a game template
   * @param {string} templateId - The template ID to delete
   */
  static deleteTemplate(templateId) {
    try {
      const templates = this.getAllTemplates();
      delete templates[templateId];
      localStorage.setItem(LOCAL_TABLE_GAME_TEMPLATES_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error("Error deleting game template:", error);
      throw error;
    }
  }

  /**
   * Get all game templates
   * @returns {Object} - Object containing all templates
   */
  static getAllTemplates() {
    try {
      const stored = localStorage.getItem(LOCAL_TABLE_GAME_TEMPLATES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error loading game templates:", error);
      return {};
    }
  }

  /**
   * Get templates as an array sorted by last used
   * @returns {Array} - Array of template objects
   */
  static getTemplatesList() {
    try {
      const templates = this.getAllTemplates();
      const templatesList = Object.values(templates)
        .filter(template => template && template.id)
        .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
      
      return templatesList;
    } catch (error) {
      console.error("Error getting templates list:", error);
      return [];
    }
  }

  /**
   * Get a specific template by ID
   * @param {string} templateId - The template ID
   * @returns {Object|null} - The template object or null
   */
  static getTemplate(templateId) {
    const templates = this.getAllTemplates();
    return templates[templateId] || null;
  }

  /**
   * Update template usage (increment count and update last used)
   * @param {string} templateId - The template ID
   */
  static recordTemplateUsage(templateId) {
    try {
      const templates = this.getAllTemplates();
      
      if (templates[templateId]) {
        templates[templateId].usageCount = (templates[templateId].usageCount || 0) + 1;
        templates[templateId].lastUsed = new Date().toISOString();
        localStorage.setItem(LOCAL_TABLE_GAME_TEMPLATES_KEY, JSON.stringify(templates));
      }
    } catch (error) {
      console.error("Error recording template usage:", error);
    }
  }

  /**
   * Check if a template exists
   * @param {string} templateId - The template ID to check
   * @returns {boolean} - True if template exists
   */
  static templateExists(templateId) {
    const templates = this.getAllTemplates();
    return Object.prototype.hasOwnProperty.call(templates, templateId);
  }

  /**
   * Generate a unique template ID
   * @returns {string} - Unique template ID
   */
  static generateTemplateId() {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all templates
   */
  static clearAllTemplates() {
    localStorage.removeItem(LOCAL_TABLE_GAME_TEMPLATES_KEY);
  }

  /**
   * Get template count
   * @returns {number} - Number of saved templates
   */
  static getTemplateCount() {
    const templates = this.getAllTemplates();
    return Object.keys(templates).length;
  }
}
