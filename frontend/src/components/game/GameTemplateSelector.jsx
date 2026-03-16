import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EditIcon, TrashIcon, PlusIcon, ListIcon, EyeIcon } from '@/components/ui/Icon';
import { LocalTableGameTemplate, LocalTableGameStorage } from '@/shared/api';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { BUILTIN_SYSTEM_TEMPLATES } from '@/shared/constants/gameTemplates';
import SwipeableGameCard from '@/components/common/SwipeableGameCard';
import AddGameTemplateModal from '@/components/modals/AddGameTemplateModal';
import LoadTableGameDialog from '@/components/modals/LoadTableGameDialog';
import GameTemplateDetailsModal from '@/components/modals/GameTemplateDetailsModal';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/components/GameTemplateSelector.css';

const GameTemplateSelector = ({ onSelectTemplate, onCreateNew, onLoadGame, onLoadWizardGames, embedded, gameCategory, hideCreateButton }) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const [templates, setTemplates] = useState([]);
  const [systemTemplates, setSystemTemplates] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingSystemTemplate, setEditingSystemTemplate] = useState(null);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [filterGameName, setFilterGameName] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsTemplate, setDetailsTemplate] = useState(null);

  const loadTemplates = () => {
    const templatesList = LocalTableGameTemplate.getTemplatesList();
    // Filter out templates that have been approved as system templates
    let filteredTemplates = templatesList.filter(template => !template.approvedAsSystemTemplate);
    // Filter by game category if specified
    if (gameCategory) {
      filteredTemplates = filteredTemplates.filter(template => (template.gameCategory || 'table') === gameCategory);
    }
    setTemplates(filteredTemplates);
  };

  const loadSystemTemplates = async () => {
    // Start with built-in templates filtered by category
    let builtins = BUILTIN_SYSTEM_TEMPLATES;
    if (gameCategory) {
      builtins = builtins.filter(t => (t.gameCategory || 'table') === gameCategory);
    }

    try {
      let serverTemplates = await gameTemplateService.getSystemTemplates();
      if (gameCategory) {
        serverTemplates = serverTemplates.filter(t => (t.gameCategory || 'table') === gameCategory);
      }

      // Merge server templates with built-ins by name, preserving builtin defaults for missing fields.
      const builtinsByName = new Map(builtins.map((b) => [b.name, b]));
      const mergedServer = serverTemplates.map((serverTemplate) => {
        const builtin = builtinsByName.get(serverTemplate.name);
        if (!builtin) return serverTemplate;

        return {
          ...builtin,
          ...serverTemplate,
          gameCategory: serverTemplate.gameCategory || builtin.gameCategory,
          scoringFormula: serverTemplate.scoringFormula || builtin.scoringFormula,
          roundPattern: serverTemplate.roundPattern || builtin.roundPattern,
          maxRounds: serverTemplate.maxRounds || builtin.maxRounds,
          hasDealerRotation: serverTemplate.hasDealerRotation !== undefined ? serverTemplate.hasDealerRotation : builtin.hasDealerRotation,
          hasForbiddenCall: serverTemplate.hasForbiddenCall !== undefined ? serverTemplate.hasForbiddenCall : builtin.hasForbiddenCall,
        };
      });

      const serverNames = new Set(mergedServer.map(t => t.name));
      const extraBuiltins = builtins.filter(b => !serverNames.has(b.name));
      const merged = [...extraBuiltins, ...mergedServer];

      console.log('Loaded system templates:', merged);
      setSystemTemplates(merged);
    } catch (error) {
      console.error('Error loading system templates:', error);
      // Offline or error — use built-in templates so games are still playable
      console.log('Using built-in system templates (offline):', builtins);
      setSystemTemplates(builtins);
    }
  };

  const handleDownloadTemplates = async () => {
    try {
      await LocalTableGameTemplate.downloadFromCloud();
      loadTemplates();
      loadSystemTemplates();
    } catch (error) {
      console.error('Error downloading templates:', error);
      // Fail silently - user can still use local templates
    }
  };

  useEffect(() => {
    loadTemplates();
    loadSystemTemplates();
    // Automatically download templates from cloud on mount
    handleDownloadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if a local template is a variant of a system template
  const isLocalVariant = (localTemplate, systemTemplates) => {
    const systemTemplate = systemTemplates.find(st => st.name === localTemplate.name);
    if (!systemTemplate) return false;
    
    // Check if any settings differ
    return (
      localTemplate.targetNumber !== systemTemplate.targetNumber ||
      localTemplate.lowIsBetter !== systemTemplate.lowIsBetter ||
      (localTemplate.gameCategory || 'table') !== (systemTemplate.gameCategory || 'table') ||
      (localTemplate.roundPattern || null) !== (systemTemplate.roundPattern || null) ||
      (localTemplate.maxRounds || null) !== (systemTemplate.maxRounds || null) ||
      JSON.stringify(localTemplate.scoringFormula || null) !== JSON.stringify(systemTemplate.scoringFormula || null) ||
      (localTemplate.hasDealerRotation !== false) !== (systemTemplate.hasDealerRotation !== false) ||
      (localTemplate.hasForbiddenCall !== false) !== (systemTemplate.hasForbiddenCall !== false) ||
      localTemplate.description !== systemTemplate.description ||
      localTemplate.descriptionMarkdown !== systemTemplate.descriptionMarkdown
    );
  };

  // Get templates that don't have a system template with the same name
  const getUniqueLocalTemplates = () => {
    const systemTemplateNames = systemTemplates.map(st => st.name);
    return templates.filter(template => {
      const hasSystemVersion = systemTemplateNames.includes(template.name);
      if (!hasSystemVersion) return true;
      // If there's a system version, only show if it's a local variant
      return isLocalVariant(template, systemTemplates);
    });
  };

  // Handle creating a local copy of a system template
  const handleMakeLocalChanges = (systemTemplate) => {
    // Create a local copy with the same settings
    const localCopy = {
      name: systemTemplate.name,
      targetNumber: systemTemplate.targetNumber,
      lowIsBetter: systemTemplate.lowIsBetter,
      description: systemTemplate.description || '',
      descriptionMarkdown: systemTemplate.descriptionMarkdown || ''
    };
    
    // Save it locally
    LocalTableGameTemplate.saveTemplate(
      localCopy.name,
      {
        targetNumber: localCopy.targetNumber,
        lowIsBetter: localCopy.lowIsBetter,
        description: localCopy.description,
        descriptionMarkdown: localCopy.descriptionMarkdown
      }
    );
    
    // Reload templates and switch to edit mode
    loadTemplates();
    
    // Open the edit modal with the new local copy
    setTimeout(() => {
      const localTemplates = LocalTableGameTemplate.getTemplatesList();
      const newLocal = localTemplates.find(t => t.name === localCopy.name);
      if (newLocal) {
        setEditingTemplate(newLocal);
        setShowEditModal(true);
      }
    }, 100);
  };

  // Handle syncing a local variant back to system template settings
  const handleSyncLocalVariant = (localTemplate) => {
    const systemTemplate = systemTemplates.find(st => st.name === localTemplate.name);
    if (!systemTemplate) {
      console.error('System template not found for:', localTemplate.name);
      return;
    }

    console.log('Syncing local variant to system template:', {
      localTemplate,
      systemTemplate
    });

    // Update the existing local template with system template data
    LocalTableGameTemplate.updateTemplate(
      localTemplate.id,
      systemTemplate.name,
      {
        targetNumber: systemTemplate.targetNumber,
        lowIsBetter: systemTemplate.lowIsBetter,
        description: systemTemplate.description || '',
        descriptionMarkdown: systemTemplate.descriptionMarkdown || ''
      }
    );

    // Reload templates to reflect changes
    loadTemplates();
  };

  const getSavedGamesCount = (template) => {
    if (template.gameCategory === 'callAndMade' && template.isBuiltin) {
      try {
        const savedGames = JSON.parse(localStorage.getItem('wizardTracker_localGames') || '{}');
        return Object.keys(savedGames).length;
      } catch { return 0; }
    }
    const allSavedGames = LocalTableGameStorage.getSavedTableGamesList();
    return allSavedGames.filter(game => game.name === template.name).length;
  };

  const handleEditClick = (template, e) => {
    e.stopPropagation();
    setEditingTemplate(template);
    setShowEditModal(true);
  };

  const handleSaveEdit = (gameName, settings) => {
    if (editingTemplate) {
      LocalTableGameTemplate.updateTemplate(editingTemplate.id, gameName, settings);
      loadTemplates();
      setShowEditModal(false);
      setEditingTemplate(null);
      
      // Dispatch event to notify active games that template was updated
      globalThis.dispatchEvent(new CustomEvent('templateUpdated', { 
        detail: { templateName: gameName, settings } 
      }));
    }
  };

  const confirmDelete = (templateId) => {
    LocalTableGameTemplate.deleteTemplate(templateId);
    loadTemplates();
    setShowDeleteConfirm(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  const handleCreateNewGame = (gameName, settings) => {
    // Just pass to parent - parent will handle saving the template
    onCreateNew(gameName, settings);
    // Reload templates to show the new one
    loadTemplates();
  };

  const handleLoadGame = (gameData) => {
    onLoadGame(gameData);
    setShowLoadDialog(false);
  };

  const handleDeleteSavedGame = (gameId) => {
    LocalTableGameStorage.deleteTableGame(gameId);
  };

  const handleLoadSavedGamesForTemplate = (template, e) => {
    e.stopPropagation();

    // Wizard/built-in callAndMade games use the wizard history modal
    if (template.gameCategory === 'callAndMade' && template.isBuiltin && onLoadWizardGames) {
      onLoadWizardGames();
      return;
    }

    // Get all saved games for this template/game type
    const templateName = typeof template === 'string' ? template : template.name;
    const allSavedGames = LocalTableGameStorage.getSavedTableGamesList();
    const gamesForTemplate = allSavedGames.filter(game => game.name === templateName);
    
    if (gamesForTemplate.length === 0) {
      alert(t('gameTemplates.noSavedGamesForTemplate', { name: templateName }));
      return;
    }
    
    // If only one game, load it directly
    if (gamesForTemplate.length === 1) {
      const games = LocalTableGameStorage.getAllSavedTableGames();
      const savedGame = games[gamesForTemplate[0].id];
      if (savedGame) {
        const gameData = LocalTableGameStorage.loadTableGame(gamesForTemplate[0].id);
        if (gameData) {
          handleLoadGame({ 
            ...gameData, 
            gameName: savedGame.name, 
            gameId: gamesForTemplate[0].id,
            gameFinished: savedGame.gameFinished || gameData.gameFinished || false
          });
        }
      }
    } else {
      // Multiple games - show load dialog filtered to this template
      setFilterGameName(templateName);
      setShowLoadDialog(true);
    }
  };

  const handleSyncToCloud = async (templateId) => {
    try {
      await LocalTableGameTemplate.syncToCloud(templateId);
      loadTemplates();
      // alert('Synced to cloud successfully!');
    } catch (error) {
      console.error('Error syncing to cloud:', error);
      alert(t('gameTemplates.syncFailed'));
    }
  };

  const handleSuggestToAdmin = async (templateId) => {
    const note = prompt(t('gameTemplates.suggestNote'));
    if (note === null) return; // User cancelled

    try {
      await LocalTableGameTemplate.suggestToAdmin(templateId, note);
      alert(t('gameTemplates.suggestionSubmitted'));
    } catch (error) {
      console.error('Error suggesting to admin:', error);
      alert(t('gameTemplates.suggestionFailed'));
    }
  };

  const handleEditSystemTemplate = (template, e) => {
    e.stopPropagation();
    setEditingSystemTemplate(template);
    setShowEditModal(true);
  };

  const handleMakeLocalChangesClick = () => {
    if (editingSystemTemplate) {
      handleMakeLocalChanges(editingSystemTemplate);
      setEditingSystemTemplate(null);
      setShowEditModal(false);
    }
  };

  const handleSuggestSystemTemplateChanges = async (updatedData) => {
    if (editingSystemTemplate) {
      try {
        await gameTemplateService.suggestSystemTemplateChanges(editingSystemTemplate._id, updatedData);
        alert(t('gameTemplates.changeRequestSubmitted'));
        setShowEditModal(false);
        setEditingSystemTemplate(null);
      } catch (error) {
        console.error('Error submitting change request:', error);
        alert(t('gameTemplates.changeRequestFailed'));
      }
    }
  };

  const handleViewDetails = (template, e) => {
    e.stopPropagation();
    setDetailsTemplate(template);
    setShowDetailsModal(true);
  };

  const getTemplateBadge = (template) => {
    if (template.isSynced || template.cloudId) {
      return <span className="template-badge cloud-badge" title={t('gameTemplates.cloudBadgeTitle')}>{t('gameTemplates.cloudBadge')}</span>;
    }
    return <span className="template-badge local-badge" title={t('gameTemplates.localBadgeTitle')}>{t('gameTemplates.localBadge')}</span>;
  };

  return (
    <div className={`game-template-selector ${embedded ? 'embedded' : ''}`}>
      {/* <div className="template-selector-header">
        <h2>Select a Gametype</h2>
      </div> */}

      {/* System Templates Section */}
      {systemTemplates.length > 0 && (
        <div className="template-section">
          <h3 className="template-section-title">{t('gameTemplates.templatesSection')}</h3>
          <div className="template-list">
            {systemTemplates.map((template) => {
              const isCreator = user && template.createdBy && template.createdBy === user.id;
              const isAdmin = user && user.role === 'admin';
              const canEdit = isCreator || isAdmin;
              const savedCount = getSavedGamesCount(template);

              return (
                <SwipeableGameCard
                  key={template._id}
                  onEdit={canEdit ? () => handleEditSystemTemplate(template, { stopPropagation: () => {} }) : null}
                  onViewDetails={() => handleViewDetails(template, { stopPropagation: () => {} })}
                  onDelete={() => {}}
                  showEdit={canEdit}
                  showViewDetails={true}
                  showDelete={false}
                >
                  <div className="template-item">
                    <div className="template-info">
                      <div className="template-name-row">
                        <div className="template-name">{template.name}</div>
                        <div className="template-meta">
                          {savedCount > 0 && (
                            <span className="template-usage">
                              {t('gameTemplates.gameCount', { count: savedCount })}
                            </span>
                          )}
                        </div>
                        <span className="template-badge system-badge" title={t('gameTemplates.systemBadgeTitle')}>{t('gameTemplates.systemBadge')}</span>
                      </div>
                    </div>
                    <div className="template-actions">
                      <button
                        className="template-action-btn play-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTemplate(template.name, {
                            targetNumber: template.targetNumber,
                            lowIsBetter: template.lowIsBetter,
                            gameCategory: template.gameCategory || 'table',
                            scoringFormula: template.scoringFormula,
                            roundPattern: template.roundPattern,
                            maxRounds: template.maxRounds,
                            hasDealerRotation: template.hasDealerRotation,
                            hasForbiddenCall: template.hasForbiddenCall,
                          });
                        }}
                        title={t('gameTemplates.startNewGame')}
                      >
                        {t('gameTemplates.newGame')}
                      </button>
                      <button
                        className="template-action-btn continue-btn"
                        onClick={(e) => handleLoadSavedGamesForTemplate(template, e)}
                        title={t('gameTemplates.viewSavedGames')}
                        disabled={savedCount === 0}
                      >
                        <ListIcon size={18} />
                      </button>
                    </div>
                  </div>
                </SwipeableGameCard>
              );
            })}
          </div>
        </div>
      )}

      {/* User Templates Section - hide entirely when empty and hideCreateButton is set */}
      {(getUniqueLocalTemplates().length > 0 || !hideCreateButton) && (
      <div className="template-section">
        <h3 className="template-section-title">{t('gameTemplates.myTemplatesSection')}</h3>
        <div className="template-list">
        {getUniqueLocalTemplates().length > 0 ? (
          getUniqueLocalTemplates().map((template) => {
            const isVariant = isLocalVariant(template, systemTemplates);
            const hasCloudSync = !template.isSynced && !template.cloudId;

            return (
              <SwipeableGameCard
                key={template.id}
                onDelete={() => confirmDelete(template.id)}
                onEdit={() => handleEditClick(template, { stopPropagation: () => {} })}
                onSync={hasCloudSync ? () => handleSyncToCloud(template.id) : null}
                onSyncToSystem={isVariant ? () => handleSyncLocalVariant(template) : null}
                showEdit={true}
                showSync={hasCloudSync}
                showSyncToSystem={isVariant}
                syncTitle={t('gameTemplates.syncToCloud')}
                syncToSystemTitle={t('gameTemplates.syncToSystem')}
              >
                <div className="template-item">
                  <div className="template-info">
                    <div className="template-name-row">
                      <div className="template-name">{template.name}</div>
                      <div className="template-meta">
                        {(() => {
                          const savedCount = getSavedGamesCount(template);
                          return savedCount > 0 ? (
                            <span className="template-usage">
                              {t('gameTemplates.gameCount', { count: savedCount })}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      {isVariant && (
                        <span className="template-badge altered-badge" title={t('gameTemplates.alteredBadgeTitle')}>{t('gameTemplates.alteredBadge')}</span>
                      )}
                      {getTemplateBadge(template)}
                    </div>
                  </div>
                  <div className="template-actions">
                    <button
                      className="template-action-btn play-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTemplate(template.name, {
                          targetNumber: template.targetNumber,
                          lowIsBetter: template.lowIsBetter,
                          gameCategory: template.gameCategory || 'table',
                          scoringFormula: template.scoringFormula,
                          roundPattern: template.roundPattern,
                          maxRounds: template.maxRounds,
                          hasDealerRotation: template.hasDealerRotation,
                          hasForbiddenCall: template.hasForbiddenCall,
                        });
                      }}
                      title={t('gameTemplates.startWithFriends')}
                    >
                      {t('gameTemplates.newGame')}
                    </button>
                    <button
                      className="template-action-btn continue-btn"
                      onClick={(e) => handleLoadSavedGamesForTemplate(template, e)}
                      title={t('gameTemplates.viewSavedGames')}
                      disabled={getSavedGamesCount(template) === 0}
                    >
                      <ListIcon size={18} />
                    </button>
                  </div>
                </div>
              </SwipeableGameCard>
            );
          })
        ) : (
          <div className="no-templates">
            <p>{t('gameTemplates.noSavedGamesYet')}</p>
            <p>{t('gameTemplates.createFirstGame')}</p>
          </div>
        )}
        </div>
      </div>
      )}
      {!hideCreateButton && (
      <div className="template-selector-actions">
        <button className="create-new-btn" onClick={() => setShowAddModal(true)}>
          <PlusIcon size={20} />
          {t('gameTemplates.addNewGameType')}
        </button>
      </div>
      )}

      {/* Add Game Template Modal */}
      <AddGameTemplateModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleCreateNewGame}
        defaultGameCategory={gameCategory || 'table'}
      />

      {/* Edit Game Template Modal */}
      <AddGameTemplateModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingTemplate(null);
          setEditingSystemTemplate(null);
        }}
        onSave={editingSystemTemplate ? undefined : handleSaveEdit}
        onSuggest={editingTemplate ? () => handleSuggestToAdmin(editingTemplate.id) : null}
        onSuggestChange={editingSystemTemplate ? handleSuggestSystemTemplateChanges : null}
        onMakeLocalChanges={editingSystemTemplate ? handleMakeLocalChangesClick : null}
        editMode={true}
        initialData={editingSystemTemplate || editingTemplate}
        isSystemTemplate={!!editingSystemTemplate}
      />

      {/* Load Table Game Dialog */}
      <LoadTableGameDialog
        isOpen={showLoadDialog}
        onClose={() => {
          setShowLoadDialog(false);
          setFilterGameName(null);
        }}
        onLoadGame={handleLoadGame}
        onDeleteGame={handleDeleteSavedGame}
        filterByGameName={filterGameName}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="delete-modal-overlay" onClick={cancelDelete}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('gameTemplates.deleteGameTitle')}</h3>
            <p>{t('gameTemplates.deleteGameConfirm')}</p>
            <p className="delete-warning">{t('gameTemplates.deleteGameWarning')}</p>
            <div className="delete-modal-actions">
              <button
                className="delete-modal-btn cancel"
                onClick={cancelDelete}
              >
                {t('common.cancel')}
              </button>
              <button
                className="delete-modal-btn confirm"
                onClick={() => confirmDelete(showDeleteConfirm)}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Template Details Modal */}
      <GameTemplateDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setDetailsTemplate(null);
        }}
        template={detailsTemplate}
      />
    </div>
  );
};

export default GameTemplateSelector;
