const express = require('express');
const GameTemplate = require('../models/GameTemplate');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/game-templates - Get all accessible templates (system + user's own)
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Get system/public templates and user's own templates
    const templates = await GameTemplate.find({
      $or: [
        { type: 'system', isPublic: true },
        { userId: userId }
      ]
    })
      .select('_id localId name type targetNumber lowIsBetter usageCount description isPublic createdAt updatedAt')
      .sort({ type: 1, name: 1 }); // System templates first, then alphabetically

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
      const existingByLocalId = await GameTemplate.findOne({ localId, userId });
      if (existingByLocalId) {
        return res.status(200).json({
          message: 'Template already exists (by localId)',
          duplicate: true,
          template: existingByLocalId
        });
      }
    }

    // Check for duplicate by name for this user
    const existingByName = await GameTemplate.findOne({ 
      name: name.trim(), 
      userId,
      type: 'user'
    });
    
    if (existingByName) {
      return res.status(200).json({
        message: 'Template with this name already exists',
        duplicate: true,
        template: existingByName
      });
    }

    // Create new template
    const template = new GameTemplate({
      userId,
      localId,
      name: name.trim(),
      type: 'user',
      targetNumber: targetNumber || null,
      lowIsBetter: lowIsBetter || false,
      description: description || '',
      isPublic: false
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

    const template = await GameTemplate.findOne({ _id: id, userId, type: 'user' });

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

    const template = await GameTemplate.findOneAndDelete({ 
      _id: id, 
      userId, 
      type: 'user' 
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
    const userTemplate = await GameTemplate.findOne({ 
      _id: id, 
      userId, 
      type: 'user' 
    });

    if (!userTemplate) {
      return res.status(404).json({ error: 'Template not found or not authorized' });
    }

    // Check if already suggested
    const existingSuggestion = await GameTemplate.findOne({
      name: userTemplate.name,
      type: 'suggested',
      suggestedBy: userId
    });

    if (existingSuggestion) {
      return res.status(400).json({ 
        error: 'You have already suggested this template',
        suggestion: existingSuggestion
      });
    }

    // Create a suggested template (copy of user template)
    const suggestedTemplate = new GameTemplate({
      name: userTemplate.name,
      type: 'suggested',
      targetNumber: userTemplate.targetNumber,
      lowIsBetter: userTemplate.lowIsBetter,
      description: userTemplate.description,
      suggestedBy: userId,
      suggestionNote: suggestionNote || '',
      approved: false,
      isPublic: false
    });

    await suggestedTemplate.save();

    res.status(201).json({
      message: 'Template suggestion submitted successfully',
      suggestion: suggestedTemplate
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/game-templates/suggestions - Get all suggested templates (admin only)
router.get('/admin/suggestions', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Check if user is admin (you'll need to implement admin check)
    // For now, we'll just return the suggestions
    const suggestions = await GameTemplate.find({
      type: 'suggested',
      approved: false
    })
      .populate('suggestedBy', 'username email')
      .sort({ createdAt: -1 });

    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

// POST /api/game-templates/suggestions/:id/approve - Approve a suggestion (admin only)
router.post('/admin/suggestions/:id/approve', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    // Check if user is admin (implement proper admin check)
    // For now, we'll just proceed
    
    const suggestion = await GameTemplate.findOne({
      _id: id,
      type: 'suggested'
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Convert to system template
    suggestion.type = 'system';
    suggestion.isPublic = true;
    suggestion.approved = true;
    suggestion.userId = null; // System templates have no owner

    await suggestion.save();

    res.json({
      message: 'Template suggestion approved and added to system templates',
      template: suggestion
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/game-templates/suggestions/:id - Reject a suggestion (admin only)
router.delete('/admin/suggestions/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const suggestion = await GameTemplate.findOneAndDelete({
      _id: id,
      type: 'suggested'
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    res.json({ message: 'Template suggestion rejected' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
