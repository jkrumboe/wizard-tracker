const express = require('express');
const SystemGameTemplate = require('../models/SystemGameTemplate');
const UserGameTemplate = require('../models/UserGameTemplate');
const TemplateSuggestion = require('../models/TemplateSuggestion');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/game-templates - Get all accessible templates (system + user's own)
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Get system templates and user's own templates in parallel
    const [systemTemplates, userTemplates] = await Promise.all([
      SystemGameTemplate.find({ isActive: true })
        .select('_id name targetNumber lowIsBetter usageCount description createdAt updatedAt')
        .sort({ name: 1 }),
      UserGameTemplate.find({ userId })
        .select('_id localId name targetNumber lowIsBetter usageCount description createdAt updatedAt')
        .sort({ name: 1 })
    ]);

    // Mark templates with their type for frontend
    const templates = [
      ...systemTemplates.map(t => ({ ...t.toObject(), type: 'system', isPublic: true })),
      ...userTemplates.map(t => ({ ...t.toObject(), type: 'user', isPublic: false }))
    ];

    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

// POST /api/game-templates - Create a new user template
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, localId, targetNumber, lowIsBetter, description } = req.body;
    const userId = req.user._id;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    // Check for duplicate by localId
    if (localId) {
      const existingByLocalId = await UserGameTemplate.findOne({ localId, userId });
      if (existingByLocalId) {
        return res.status(200).json({
          message: 'Template already exists (by localId)',
          duplicate: true,
          template: existingByLocalId
        });
      }
    }

    // Check for duplicate by name for this user
    const existingByName = await UserGameTemplate.findOne({ 
      name: name.trim(), 
      userId
    });
    
    if (existingByName) {
      return res.status(200).json({
        message: 'Template with this name already exists',
        duplicate: true,
        template: existingByName
      });
    }

    // Create new template
    const template = new UserGameTemplate({
      userId,
      localId,
      name: name.trim(),
      targetNumber: targetNumber || null,
      lowIsBetter: lowIsBetter || false,
      description: description || ''
    });

    await template.save();

    res.status(201).json({
      message: 'Template created successfully',
      template,
      duplicate: false
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/game-templates/:id - Update a user template
router.put('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, targetNumber, lowIsBetter, description } = req.body;
    const userId = req.user._id;

    const template = await UserGameTemplate.findOne({ _id: id, userId });

    if (!template) {
      return res.status(404).json({ error: 'Template not found or not authorized' });
    }

    // Update fields
    if (name !== undefined) template.name = name.trim();
    if (targetNumber !== undefined) template.targetNumber = targetNumber;
    if (lowIsBetter !== undefined) template.lowIsBetter = lowIsBetter;
    if (description !== undefined) template.description = description;

    await template.save();

    res.json({
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/game-templates/:id - Delete a user template
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const template = await UserGameTemplate.findOneAndDelete({ 
      _id: id, 
      userId
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found or not authorized' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/game-templates/:id/suggest - Suggest a user template to become a system template
router.post('/:id/suggest', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { suggestionNote } = req.body;
    const userId = req.user._id;

    // Find the user's template
    const userTemplate = await UserGameTemplate.findOne({ 
      _id: id, 
      userId
    });

    if (!userTemplate) {
      return res.status(404).json({ error: 'Template not found or not authorized' });
    }

    // Check if already suggested
    const existingSuggestion = await TemplateSuggestion.findOne({
      userTemplateId: id,
      userId,
      status: 'pending'
    });

    if (existingSuggestion) {
      return res.status(400).json({ 
        error: 'You have already suggested this template',
        suggestion: existingSuggestion
      });
    }

    // Create a template suggestion
    const suggestion = new TemplateSuggestion({
      userId,
      userTemplateId: id,
      name: userTemplate.name,
      targetNumber: userTemplate.targetNumber,
      lowIsBetter: userTemplate.lowIsBetter,
      description: userTemplate.description,
      suggestionNote: suggestionNote || '',
      status: 'pending'
    });

    await suggestion.save();

    res.status(201).json({
      message: 'Template suggestion submitted successfully',
      suggestion
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/game-templates/suggestions - Get all pending template suggestions (admin only)
router.get('/admin/suggestions', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // TODO: Check if user is admin
    // For now, we'll just return the suggestions
    const suggestions = await TemplateSuggestion.find({
      status: 'pending'
    })
      .populate('userId', 'username email')
      .sort({ createdAt: -1 });

    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

// POST /api/game-templates/suggestions/:id/approve - Approve a suggestion and create system template (admin only)
router.post('/admin/suggestions/:id/approve', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    // TODO: Check if user is admin
    
    const suggestion = await TemplateSuggestion.findOne({
      _id: id,
      status: 'pending'
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Create system template from suggestion
    const systemTemplate = new SystemGameTemplate({
      name: suggestion.name,
      targetNumber: suggestion.targetNumber,
      lowIsBetter: suggestion.lowIsBetter,
      description: suggestion.description,
      isActive: true
    });

    await systemTemplate.save();

    // Update suggestion status
    suggestion.status = 'approved';
    suggestion.reviewedAt = new Date();
    await suggestion.save();

    res.json({
      message: 'Template suggestion approved and added to system templates',
      template: systemTemplate
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/game-templates/suggestions/:id - Reject a suggestion (admin only)
router.delete('/admin/suggestions/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewNote } = req.body;
    
    const suggestion = await TemplateSuggestion.findOne({
      _id: id,
      status: 'pending'
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Update suggestion status instead of deleting
    suggestion.status = 'rejected';
    suggestion.reviewedAt = new Date();
    suggestion.reviewNote = reviewNote || '';
    await suggestion.save();

    res.json({ message: 'Template suggestion rejected' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
