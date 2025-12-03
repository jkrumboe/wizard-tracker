/**
 * Local Table Game Template Storage Service
 * Handles saving, loading, and managing reusable game templates (game names)
 * Supports both local-only templates and cloud-synced templates
 */

import gameTemplateService from './gameTemplateService';

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
        lowIsBetter: settings.lowIsBetter || false,
        description: settings.description || '',
        descriptionMarkdown: settings.descriptionMarkdown || ''
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
        if (settings.description !== undefined) {
          templates[templateId].description = settings.description;
        }
        if (settings.descriptionMarkdown !== undefined) {
          templates[templateId].descriptionMarkdown = settings.descriptionMarkdown;
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
    return generateSecureId('template');
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

  /**
   * Mark a local template as synced to cloud
   * @param {string} templateId - Local template ID
   * @param {string} cloudId - Cloud template ID from backend
   */
  static markAsSynced(templateId, cloudId) {
    try {
      const templates = this.getAllTemplates();
      if (templates[templateId]) {
        templates[templateId].cloudId = cloudId;
        templates[templateId].isSynced = true;
        templates[templateId].lastSyncedAt = new Date().toISOString();
        localStorage.setItem(LOCAL_TABLE_GAME_TEMPLATES_KEY, JSON.stringify(templates));
      }
    } catch (error) {
      console.error("Error marking template as synced:", error);
    }
  }

  /**
   * Sync a local template to the cloud
   * Creates or updates the template on the backend
   * @param {string} templateId - Local template ID
   * @returns {Promise<Object>} - Cloud template object
   */
  static async syncToCloud(templateId) {
    try {
      const template = this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const templateData = {
        localId: template.id,
        name: template.name,
        targetNumber: template.targetNumber,
        lowIsBetter: template.lowIsBetter,
        description: template.description || '',
        descriptionMarkdown: template.descriptionMarkdown || ''
      };

      // If already synced, update; otherwise create
      let cloudTemplate;
      if (template.cloudId) {
        cloudTemplate = await gameTemplateService.updateTemplate(template.cloudId, templateData);
      } else {
        const response = await gameTemplateService.createTemplate(templateData);
        // Extract template from response object
        cloudTemplate = response.template || response;
        const cloudId = cloudTemplate._id;
        if (!cloudId) {
          throw new Error('No template ID returned from server');
        }
        this.markAsSynced(templateId, cloudId);
      }

      return cloudTemplate;
    } catch (error) {
      console.error("Error syncing template to cloud:", error);
      throw error;
    }
  }

  /**
   * Download cloud templates and merge with local templates
   * System templates are kept separate, user templates are synced with local
   * @returns {Promise<Object>} - Object with systemTemplates and userTemplates arrays
   */
  static async downloadFromCloud() {
    try {
      const allTemplates = await gameTemplateService.getTemplates();
      
      // Ensure we have an array
      if (!Array.isArray(allTemplates)) {
        console.error('Expected array of templates, got:', allTemplates);
        return { systemTemplates: [], userTemplates: [] };
      }
      
      // Separate system and user templates
      const systemTemplates = allTemplates.filter(t => t.type === 'system' && t.isPublic);
      const userTemplates = allTemplates.filter(t => t.type === 'user');

      // Merge user templates with local storage
      const localTemplates = this.getAllTemplates();
      
      userTemplates.forEach(cloudTemplate => {
        // Check if we already have this template locally by cloudId or localId
        const existingLocalTemplate = Object.values(localTemplates).find(
          local => local.cloudId === cloudTemplate._id || local.id === cloudTemplate.localId
        );

        if (existingLocalTemplate) {
          // Update existing local template with cloud data
          localTemplates[existingLocalTemplate.id] = {
            ...existingLocalTemplate,
            name: cloudTemplate.name,
            targetNumber: cloudTemplate.targetNumber,
            lowIsBetter: cloudTemplate.lowIsBetter,
            description: cloudTemplate.description || existingLocalTemplate.description,
            descriptionMarkdown: cloudTemplate.descriptionMarkdown || existingLocalTemplate.descriptionMarkdown,
            usageCount: cloudTemplate.usageCount || existingLocalTemplate.usageCount,
            approvedAsSystemTemplate: cloudTemplate.approvedAsSystemTemplate || false,
            systemTemplateId: cloudTemplate.systemTemplateId || null,
            cloudId: cloudTemplate._id,
            isSynced: true,
            lastSyncedAt: new Date().toISOString()
          };
        } else {
          // Add new cloud template to local storage
          const newLocalId = cloudTemplate.localId || this.generateTemplateId();
          localTemplates[newLocalId] = {
            id: newLocalId,
            name: cloudTemplate.name,
            targetNumber: cloudTemplate.targetNumber,
            lowIsBetter: cloudTemplate.lowIsBetter,
            description: cloudTemplate.description || '',
            descriptionMarkdown: cloudTemplate.descriptionMarkdown || '',
            usageCount: cloudTemplate.usageCount || 0,
            approvedAsSystemTemplate: cloudTemplate.approvedAsSystemTemplate || false,
            systemTemplateId: cloudTemplate.systemTemplateId || null,
            createdAt: cloudTemplate.createdAt,
            lastUsed: cloudTemplate.updatedAt || cloudTemplate.createdAt,
            cloudId: cloudTemplate._id,
            isSynced: true,
            lastSyncedAt: new Date().toISOString()
          };
        }
      });

      localStorage.setItem(LOCAL_TABLE_GAME_TEMPLATES_KEY, JSON.stringify(localTemplates));

      return { systemTemplates, userTemplates };
    } catch (error) {
      console.error("Error downloading templates from cloud:", error);
      throw error;
    }
  }

  /**
   * Suggest a template to admin for promotion to system template
   * @param {string} templateId - Local template ID
   * @param {string} note - Optional note to admin
   * @returns {Promise<Object>} - Suggestion object
   */
  static async suggestToAdmin(templateId, note = '') {
    try {
      const template = this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Ensure template is synced to cloud first
      if (!template.cloudId) {
        const cloudTemplate = await this.syncToCloud(templateId);
        // Reload template from storage to get updated cloudId
        const updatedTemplate = this.getTemplate(templateId);
        if (!updatedTemplate || !updatedTemplate.cloudId) {
          throw new Error('Failed to sync template to cloud');
        }
        // Submit suggestion using the cloudId from storage
        const suggestion = await gameTemplateService.suggestTemplate(updatedTemplate.cloudId, note);
        return suggestion;
      }

      // Submit suggestion with existing cloudId
      const suggestion = await gameTemplateService.suggestTemplate(template.cloudId, note);
      
      return suggestion;
    } catch (error) {
      console.error("Error suggesting template to admin:", error);
      throw error;
    }
  }

  /**
   * Get unsynced templates (local-only templates)
   * @returns {Array} - Array of templates not yet synced to cloud
   */
  static getUnsyncedTemplates() {
    try {
      const templates = this.getAllTemplates();
      return Object.values(templates)
        .filter(template => !template.isSynced && !template.cloudId);
    } catch (error) {
      console.error("Error getting unsynced templates:", error);
      return [];
    }
  }

  /**
   * Delete template from both local and cloud
   * @param {string} templateId - Local template ID
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteTemplateEverywhere(templateId) {
    try {
      const template = this.getTemplate(templateId);
      
      // Delete from cloud if synced
      if (template && template.cloudId) {
        try {
          await gameTemplateService.deleteTemplate(template.cloudId);
        } catch (cloudError) {
          console.warn("Error deleting from cloud, will delete locally:", cloudError);
        }
      }

      // Delete locally
      this.deleteTemplate(templateId);
      
      return true;
    } catch (error) {
      console.error("Error deleting template everywhere:", error);
      throw error;
    }
  }
}

