/**
 * Template Dual-Write Service
 * 
 * Mirrors game template write operations to PostgreSQL during the migration period.
 * Covers SystemGameTemplate, UserGameTemplate, and TemplateSuggestion.
 * All mirroring is non-blocking — PostgreSQL failures are logged but don't throw.
 */

const { getPrisma, usePostgres } = require('../database');
const SystemTemplateRepo = require('../repositories/SystemGameTemplateRepository');
const UserTemplateRepo = require('../repositories/UserGameTemplateRepository');
const SuggestionRepo = require('../repositories/TemplateSuggestionRepository');

// ========================================
// UserGameTemplate mirroring
// ========================================

async function mirrorUserTemplateCreate(mongoTemplate) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgTemplate = await UserTemplateRepo.create(prisma, {
      userId: mongoTemplate.userId?.toString() || mongoTemplate.userId,
      localId: mongoTemplate.localId || null,
      name: mongoTemplate.name,
      targetNumber: mongoTemplate.targetNumber ?? null,
      lowIsBetter: mongoTemplate.lowIsBetter || false,
      description: mongoTemplate.description || null,
      descriptionMarkdown: mongoTemplate.descriptionMarkdown || null
    });
    console.log(`[TemplateDualWrite] ✅ Mirrored user template create: ${mongoTemplate.name} → PG:${pgTemplate.id}`);
    return pgTemplate;
  } catch (error) {
    console.warn(`[TemplateDualWrite] ⚠️  Failed to mirror user template create (${mongoTemplate.name}):`, error.message);
    return null;
  }
}

async function mirrorUserTemplateUpdate(mongoTemplate, updates) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    let pgTemplate = null;
    if (mongoTemplate.localId) {
      pgTemplate = await UserTemplateRepo.findByLocalId(prisma, mongoTemplate.localId);
    }
    if (!pgTemplate) {
      // Try to find by userId + name
      pgTemplate = await UserTemplateRepo.findByUserAndName(
        prisma,
        mongoTemplate.userId?.toString(),
        mongoTemplate.name
      );
    }
    if (!pgTemplate) {
      return await mirrorUserTemplateCreate(mongoTemplate);
    }
    const updated = await UserTemplateRepo.update(prisma, pgTemplate.id, updates);
    console.log(`[TemplateDualWrite] ✅ Mirrored user template update: ${mongoTemplate.name}`);
    return updated;
  } catch (error) {
    console.warn(`[TemplateDualWrite] ⚠️  Failed to mirror user template update (${mongoTemplate.name}):`, error.message);
    return null;
  }
}

async function mirrorUserTemplateDelete(mongoTemplate) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    let pgTemplate = null;
    if (mongoTemplate.localId) {
      pgTemplate = await UserTemplateRepo.findByLocalId(prisma, mongoTemplate.localId);
    }
    if (!pgTemplate) {
      pgTemplate = await UserTemplateRepo.findByUserAndName(
        prisma,
        mongoTemplate.userId?.toString(),
        mongoTemplate.name
      );
    }
    if (!pgTemplate) {
      console.log(`[TemplateDualWrite] ℹ️  User template not found in PG for delete: ${mongoTemplate.name}`);
      return null;
    }
    await UserTemplateRepo.deleteById(prisma, pgTemplate.id);
    console.log(`[TemplateDualWrite] ✅ Mirrored user template delete: ${mongoTemplate.name}`);
    return true;
  } catch (error) {
    console.warn(`[TemplateDualWrite] ⚠️  Failed to mirror user template delete (${mongoTemplate.name}):`, error.message);
    return null;
  }
}

// ========================================
// SystemGameTemplate mirroring
// ========================================

async function mirrorSystemTemplateCreate(mongoTemplate) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgTemplate = await SystemTemplateRepo.create(prisma, {
      name: mongoTemplate.name,
      targetNumber: mongoTemplate.targetNumber ?? null,
      lowIsBetter: mongoTemplate.lowIsBetter || false,
      description: mongoTemplate.description || null,
      descriptionMarkdown: mongoTemplate.descriptionMarkdown || null,
      isActive: mongoTemplate.isActive !== undefined ? mongoTemplate.isActive : true,
      createdById: mongoTemplate.createdBy?.toString() || null
    });
    console.log(`[TemplateDualWrite] ✅ Mirrored system template create: ${mongoTemplate.name} → PG:${pgTemplate.id}`);
    return pgTemplate;
  } catch (error) {
    console.warn(`[TemplateDualWrite] ⚠️  Failed to mirror system template create (${mongoTemplate.name}):`, error.message);
    return null;
  }
}

async function mirrorSystemTemplateUpdate(mongoTemplate, updates) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgTemplate = await SystemTemplateRepo.findByName(prisma, mongoTemplate.name);
    if (!pgTemplate) {
      return await mirrorSystemTemplateCreate(mongoTemplate);
    }
    const updated = await SystemTemplateRepo.update(prisma, pgTemplate.id, updates);
    console.log(`[TemplateDualWrite] ✅ Mirrored system template update: ${mongoTemplate.name}`);
    return updated;
  } catch (error) {
    console.warn(`[TemplateDualWrite] ⚠️  Failed to mirror system template update (${mongoTemplate.name}):`, error.message);
    return null;
  }
}

// ========================================
// TemplateSuggestion mirroring
// ========================================

async function mirrorSuggestionCreate(mongoSuggestion) {
  if (!usePostgres()) return null;
  try {
    const prisma = getPrisma();
    const pgSuggestion = await SuggestionRepo.create(prisma, {
      name: mongoSuggestion.name,
      targetNumber: mongoSuggestion.targetNumber ?? null,
      lowIsBetter: mongoSuggestion.lowIsBetter || false,
      description: mongoSuggestion.description || null,
      descriptionMarkdown: mongoSuggestion.descriptionMarkdown || null,
      suggestedById: mongoSuggestion.userId?.toString() || mongoSuggestion.userId,
      suggestionNote: mongoSuggestion.suggestionNote || '',
      suggestionType: mongoSuggestion.suggestionType === 'change' ? 'change' : 'new_template',
      status: mongoSuggestion.status || 'pending'
    });
    console.log(`[TemplateDualWrite] ✅ Mirrored suggestion create: ${mongoSuggestion.name} → PG:${pgSuggestion.id}`);
    return pgSuggestion;
  } catch (error) {
    console.warn(`[TemplateDualWrite] ⚠️  Failed to mirror suggestion create (${mongoSuggestion.name}):`, error.message);
    return null;
  }
}

async function mirrorSuggestionStatusUpdate(mongoSuggestionId, status, reviewNote) {
  if (!usePostgres()) return null;
  try {
    // We can't easily find the PG counterpart by Mongo ID since IDs differ.
    // Log a warning — status updates will be handled by backfill reconciliation.
    console.log(`[TemplateDualWrite] ℹ️  Suggestion status update (${status}) — will be synced via backfill`);
    return null;
  } catch (error) {
    console.warn(`[TemplateDualWrite] ⚠️  Failed to mirror suggestion status update:`, error.message);
    return null;
  }
}

module.exports = {
  mirrorUserTemplateCreate,
  mirrorUserTemplateUpdate,
  mirrorUserTemplateDelete,
  mirrorSystemTemplateCreate,
  mirrorSystemTemplateUpdate,
  mirrorSuggestionCreate,
  mirrorSuggestionStatusUpdate
};
