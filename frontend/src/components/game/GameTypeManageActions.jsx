import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '@/components/ui/Icon';
import AddGameTemplateModal from '@/components/modals/AddGameTemplateModal';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import { LocalTableGameTemplate } from '@/shared/api';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { useUser } from '@/shared/hooks/useUser';
import { notifyTemplatesChanged } from '@/shared/hooks/useGameTemplates';

const isLocalTemplate = (template) => Boolean(template?.id && LocalTableGameTemplate.getTemplate(template.id));

/**
 * Edit / delete / sync / suggest actions for one game template, shown on its
 * info page. System templates can be edited by admins, suggested changes by
 * creators, or copied into a local variant by anyone.
 *
 * `children({ editButton, moreActions })` lets the page place the Edit button
 * apart from the rarer actions (moreActions is null when there are none).
 * Without children everything renders as one row.
 */
const GameTypeManageActions = ({ template, children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingSystemTemplate, setEditingSystemTemplate] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const isLocal = isLocalTemplate(template);
  const isSystem = !isLocal;
  const canEditSystem = isSystem && (isAdmin || (user && template.createdBy === user.id));
  const canSync = isLocal && !template.isSynced && !template.cloudId && Boolean(user);

  const closeEdit = () => {
    setEditingTemplate(null);
    setEditingSystemTemplate(null);
  };

  const goToTemplate = (name, replace = true) => {
    navigate(`/game-types/${encodeURIComponent(name)}/info`, { replace });
  };

  // --- Local templates ---
  const handleSaveLocal = (gameName, settings) => {
    LocalTableGameTemplate.updateTemplate(editingTemplate.id, gameName, settings);
    globalThis.dispatchEvent(new CustomEvent('templateUpdated', { detail: { templateName: gameName, settings } }));
    closeEdit();
    if (gameName.trim() !== template.name) goToTemplate(gameName.trim());
  };

  const handleDelete = () => {
    LocalTableGameTemplate.deleteTemplate(template.id);
    setShowDeleteConfirm(false);
    notifyTemplatesChanged();
    // A deleted variant falls back to the shared template of the same name
    navigate(template.isVariant ? `/game-types/${encodeURIComponent(template.name)}/info` : '/start', { replace: true });
  };

  const handleSyncToCloud = async () => {
    setBusy(true);
    try {
      await LocalTableGameTemplate.syncToCloud(template.id);
      notifyTemplatesChanged();
    } catch (error) {
      console.error('Error syncing to cloud:', error);
      alert(t('gameTemplates.syncFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleSuggestToAdmin = async () => {
    const note = prompt(t('gameTemplates.suggestNote'));
    if (note === null) return;
    try {
      await LocalTableGameTemplate.suggestToAdmin(template.id, note);
      alert(t('gameTemplates.suggestionSubmitted'));
    } catch (error) {
      console.error('Error suggesting to admin:', error);
      alert(error?.message
        ? `${t('gameTemplates.suggestionFailed')}\n\n${error.message}`
        : t('gameTemplates.suggestionFailed'));
    }
  };

  // --- System templates ---
  const handleSaveSystemDirectly = async (gameName, settings) => {
    try {
      await gameTemplateService.updateSystemTemplate(editingSystemTemplate._id, { name: gameName, ...settings });
      closeEdit();
      notifyTemplatesChanged();
      if (gameName.trim() !== template.name) goToTemplate(gameName.trim());
    } catch (error) {
      console.error('Error saving system template:', error);
      alert(t('gameTemplates.changeRequestFailed'));
    }
  };

  const handleSuggestSystemChanges = async (updatedData) => {
    try {
      await gameTemplateService.suggestSystemTemplateChanges(editingSystemTemplate._id, updatedData);
      alert(t('gameTemplates.changeRequestSubmitted'));
      closeEdit();
    } catch (error) {
      console.error('Error submitting change request:', error);
      alert(t('gameTemplates.changeRequestFailed'));
    }
  };

  // Copy the system template locally and open the copy for editing
  const handleMakeLocalChanges = () => {
    const system = editingSystemTemplate;
    const localId = LocalTableGameTemplate.saveTemplate(system.name, {
      targetNumber: system.targetNumber,
      lowIsBetter: system.lowIsBetter,
      gameCategory: system.gameCategory,
      scoreEntryMode: system.scoreEntryMode || null,
      scoringFormula: system.scoringFormula,
      roundPattern: system.roundPattern,
      maxRounds: system.maxRounds,
      hasDealerRotation: system.hasDealerRotation,
      hasForbiddenCall: system.hasForbiddenCall,
      description: system.description || '',
      descriptionMarkdown: system.descriptionMarkdown || '',
      minPlayers: system.minPlayers ?? null,
      maxPlayers: system.maxPlayers ?? null,
      gameInfo: system.gameInfo || null,
    });
    setEditingSystemTemplate(null);
    setEditingTemplate(LocalTableGameTemplate.getTemplate(localId));
  };

  // Only admins save system templates directly; everyone else suggests or copies
  const systemOnSave = isAdmin ? handleSaveSystemDirectly : undefined;

  const handleEditClick = () => {
    if (isLocal) setEditingTemplate(template);
    else setEditingSystemTemplate(template);
  };

  const editButton = (
    <button type="button" className="games-quick-link game-type-edit-button" onClick={handleEditClick}>
      <Icon name="Edit" size={18} aria-hidden="true" />
      <span className="games-quick-link-label">
        {isSystem && !canEditSystem ? t('gameType.customize') : t('gameType.edit')}
      </span>
    </button>
  );

  // Suggest and delete need a local template, sync implies one
  const moreActions = isLocal ? (
    <div className="game-type-manage">
      {canSync && (
        <button type="button" className="game-type-pill" onClick={() => void handleSyncToCloud()} disabled={busy}>
          <Icon name="Cloud" size={16} aria-hidden="true" />
          <span>{t('gameTemplates.syncToCloud')}</span>
        </button>
      )}
      {isLocal && user && !template.isVariant && (
        <button type="button" className="game-type-pill" onClick={() => void handleSuggestToAdmin()}>
          <Icon name="Megaphone" size={16} aria-hidden="true" />
          <span>{t('gameType.suggest')}</span>
        </button>
      )}
      {isLocal && (
        <button type="button" className="game-type-pill danger" onClick={() => setShowDeleteConfirm(true)}>
          <Icon name={template.isVariant ? 'RotateCcw' : 'Trash2'} size={16} aria-hidden="true" />
          <span>{template.isVariant ? t('gameType.resetToDefault') : t('common.delete')}</span>
        </button>
      )}
    </div>
  ) : null;

  return (
    <>
      {children ? children({ editButton, moreActions }) : (
        <div className="game-type-manage">
          {editButton}
          {moreActions}
        </div>
      )}

      <AddGameTemplateModal
        isOpen={Boolean(editingTemplate || editingSystemTemplate)}
        onClose={closeEdit}
        onSave={editingSystemTemplate ? systemOnSave : handleSaveLocal}
        onSuggest={editingTemplate && user ? () => void handleSuggestToAdmin() : null}
        onSuggestChange={editingSystemTemplate && user ? handleSuggestSystemChanges : null}
        onMakeLocalChanges={editingSystemTemplate ? handleMakeLocalChanges : null}
        editMode
        initialData={editingSystemTemplate || editingTemplate}
        isSystemTemplate={Boolean(editingSystemTemplate)}
        isAdmin={isAdmin}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={template.isVariant ? t('gameType.resetToDefault') : t('gameTemplates.deleteGameTitle')}
        message={template.isVariant ? t('gameType.resetConfirm') : t('gameTemplates.deleteGameConfirm')}
        confirmText={template.isVariant ? t('gameType.resetToDefault') : undefined}
      />
    </>
  );
};

export default GameTypeManageActions;
