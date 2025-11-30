import React, { useState, useEffect } from 'react';
import { EditIcon, TrashIcon, PlusIcon, ListIcon, EyeIcon } from '@/components/ui/Icon';
import { LocalTableGameTemplate, LocalTableGameStorage } from '@/shared/api';
import gameTemplateService from '@/shared/api/gameTemplateService';
import SwipeableGameCard from '@/components/common/SwipeableGameCard';
import AddGameTemplateModal from '@/components/modals/AddGameTemplateModal';
import LoadTableGameDialog from '@/components/modals/LoadTableGameDialog';
import StartTableGameModal from '@/components/modals/StartTableGameModal';
import GameTemplateDetailsModal from '@/components/modals/GameTemplateDetailsModal';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/components/GameTemplateSelector.css';

const GameTemplateSelector = ({ onSelectTemplate, onCreateNew, onLoadGame }) => {
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
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsTemplate, setDetailsTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
    loadSystemTemplates();
    // Automatically download templates from cloud on mount
    handleDownloadTemplates();
  }, []);

  const loadTemplates = () => {
    const templatesList = LocalTableGameTemplate.getTemplatesList();
    // Filter out templates that have been approved as system templates
    const filteredTemplates = templatesList.filter(template => !template.approvedAsSystemTemplate);
    setTemplates(filteredTemplates);
  };

  const loadSystemTemplates = async () => {
    try {
      const systemTemplatesList = await gameTemplateService.getSystemTemplates();
      console.log('Loaded system templates:', systemTemplatesList);
      setSystemTemplates(systemTemplatesList);
    } catch (error) {
      console.error('Error loading system templates:', error);
      // If offline or error (including not logged in), continue with local templates only
      setSystemTemplates([]);
    }
  };

  const getSavedGamesCount = (templateName) => {
    const allSavedGames = LocalTableGameStorage.getSavedTableGamesList();
    return allSavedGames.filter(game => game.name === templateName).length;
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
      window.dispatchEvent(new CustomEvent('templateUpdated', { 
        detail: { templateName: gameName, settings } 
      }));
    }
  };

  const handleDeleteClick = (templateId, e) => {
    e.stopPropagation();
    setShowDeleteConfirm(templateId);
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

  const handleLoadSavedGamesForTemplate = (templateName, e) => {
    e.stopPropagation();
    // Get all saved games for this template/game type
    const allSavedGames = LocalTableGameStorage.getSavedTableGamesList();
    const gamesForTemplate = allSavedGames.filter(game => game.name === templateName);
    
    if (gamesForTemplate.length === 0) {
      alert(`No saved games found for "${templateName}"`);
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

  const handleStartWithFriends = (template, e) => {
    e.stopPropagation();
    setSelectedTemplate(template);
    setShowStartModal(true);
  };

  const handleStartGameWithPlayers = (playerNames, settings) => {
    if (selectedTemplate) {
      // Pass the player names to the parent component
      onSelectTemplate(selectedTemplate.name, {
        ...settings,
        playerNames: playerNames
      });
    }
  };

  const handleSyncToCloud = async (templateId) => {
    try {
      await LocalTableGameTemplate.syncToCloud(templateId);
      loadTemplates();
      // alert('Synced to cloud successfully!');
    } catch (error) {
      console.error('Error syncing to cloud:', error);
      alert('Sync failed. Please try again.');
    }
  };

  const handleSuggestToAdmin = async (templateId) => {
    const note = prompt('Add an optional note for the admin (why this should be a system template):');
    if (note === null) return; // User cancelled

    try {
      await LocalTableGameTemplate.suggestToAdmin(templateId, note);
      alert('Suggestion submitted successfully!');
    } catch (error) {
      console.error('Error suggesting to admin:', error);
      alert('Failed to submit suggestion. Please try again.');
    }
  };

  const handleEditSystemTemplate = (template, e) => {
    e.stopPropagation();
    setEditingSystemTemplate(template);
    setShowEditModal(true);
  };

  const handleSuggestSystemTemplateChanges = async (updatedData) => {
    if (editingSystemTemplate) {
      try {
        await gameTemplateService.suggestSystemTemplateChanges(editingSystemTemplate._id, updatedData);
        alert('Change request submitted successfully!');
        setShowEditModal(false);
        setEditingSystemTemplate(null);
      } catch (error) {
        console.error('Error submitting change request:', error);
        alert('Failed to submit change request. Please try again.');
      }
    }
  };

  const handleViewDetails = (template, e) => {
    e.stopPropagation();
    setDetailsTemplate(template);
    setShowDetailsModal(true);
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

  const getTemplateBadge = (template) => {
    if (template.isSynced || template.cloudId) {
      return <span className="template-badge cloud-badge" title="Synced to cloud">Cloud</span>;
    }
    return <span className="template-badge local-badge" title="Local only">Local</span>;
  };

  return (
    <div className="game-template-selector">
      <div className="template-selector-header">
        <h2>Select a Gametype</h2>
      </div>

      {/* System Templates Section */}
      {systemTemplates.length > 0 && (
        <div className="template-section">
          <h3 className="template-section-title">Templates</h3>
          <div className="template-list">
            {systemTemplates.map((template) => {
              const isCreator = user && template.createdBy && template.createdBy === user.id;
              const savedCount = getSavedGamesCount(template.name);
              const hasDetails = !!(template.description || template.descriptionMarkdown);
              
              return (
                <SwipeableGameCard
                  key={template._id}
                  onEdit={isCreator ? () => handleEditSystemTemplate(template, { stopPropagation: () => {} }) : null}
                  onViewDetails={hasDetails ? () => handleViewDetails(template, { stopPropagation: () => {} }) : null}
                  onDelete={() => {}} 
                  showEdit={isCreator}
                  showViewDetails={hasDetails && !isCreator}
                  showDelete={false}
                >
                  <div className="template-item">
                    <div className="template-info">
                      <div className="template-name-row">
                        <div className="template-name">{template.name}</div>
                        <span className="template-badge system-badge" title="Official system template">System</span>
                        <div className="template-meta">
                          {savedCount > 0 && (
                            <span className="template-usage">
                              {savedCount} {savedCount === 1 ? 'game' : 'games'}
                            </span>
                          )}
                        </div>
                      </div>
                      {template.description && (
                        <div className="template-description">{template.description}</div>
                      )}
                    </div>
                    <div className="template-actions">
                      <button
                        className="template-action-btn play-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTemplate(template);
                          setShowStartModal(true);
                        }}
                        title="Start New Game"
                      >
                        New Game
                      </button>
                      {savedCount > 0 && (
                        <button
                          className="template-action-btn continue-btn"
                          onClick={(e) => handleLoadSavedGamesForTemplate(template.name, e)}
                          title="View Saved Games"
                        >
                          <ListIcon size={18} />
                        </button>
                      )}
                      {(template.description || template.descriptionMarkdown) && (
                        <button
                          className="template-action-btn continue-btn"
                          onClick={(e) => handleViewDetails(template, e)}
                          title="View Details"
                        >
                          <EyeIcon size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </SwipeableGameCard>
              );
            })}
          </div>
        </div>
      )}

      {/* User Templates Section */}
      <div className="template-section">
        <h3 className="template-section-title">My Templates</h3>
        <div className="template-list">
        {templates.length > 0 ? (
          templates.map((template) => (
            <SwipeableGameCard
              key={template.id}
              onDelete={() => confirmDelete(template.id)}
              onEdit={() => handleEditClick(template, { stopPropagation: () => {} })}
              onSync={(!template.isSynced && !template.cloudId) ? () => handleSyncToCloud(template.id) : null}
              showEdit={true}
              showSync={!template.isSynced && !template.cloudId}
              syncTitle="Sync to Cloud"
            >
              <div className="template-item">
                <div className="template-info">
                  <div className="template-name-row">
                    <div className="template-name">{template.name}</div>
                    {getTemplateBadge(template)}
                     <div className="template-meta">
                      {(() => {
                        const savedCount = getSavedGamesCount(template.name);
                        return savedCount > 0 ? (
                          <span className="template-usage">
                            {savedCount} {savedCount === 1 ? 'game' : 'games'}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                 
                </div>
                <div className="template-actions">
                  <button
                    className="template-action-btn play-btn"
                    onClick={(e) => handleStartWithFriends(template, e)}
                    title="Start with Friends, New Game"
                  >
                    New Game
                  </button>
                  <button
                    className="template-action-btn continue-btn"
                    onClick={(e) => handleLoadSavedGamesForTemplate(template.name, e)}
                    title="View Saved Games"
                    disabled={getSavedGamesCount(template.name) === 0}
                  >
                    <ListIcon size={18} />
                  </button>
                </div>
              </div>
            </SwipeableGameCard>
          ))
        ) : (
          <div className="no-templates">
            <p>No saved games yet.</p>
            <p>Create your first game below!</p>
          </div>
        )}
        </div>
      </div>
      <div className="template-selector-actions">
        <button className="create-new-btn" onClick={() => setShowAddModal(true)}>
          <PlusIcon size={20} />
          Add New Game Type
        </button>
      </div>

      {/* Add Game Template Modal */}
      <AddGameTemplateModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleCreateNewGame}
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
        onSyncToCloud={editingTemplate && (!editingTemplate.isSynced && !editingTemplate.cloudId) ? () => handleSyncToCloud(editingTemplate.id) : null}
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

      {/* Start Table Game with Friends Modal */}
      <StartTableGameModal
        isOpen={showStartModal}
        onClose={() => {
          setShowStartModal(false);
          setSelectedTemplate(null);
        }}
        onStart={handleStartGameWithPlayers}
        templateName={selectedTemplate?.name || ''}
        templateSettings={{
          targetNumber: selectedTemplate?.targetNumber,
          lowIsBetter: selectedTemplate?.lowIsBetter
        }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="delete-modal-overlay" onClick={cancelDelete}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Game</h3>
            <p>Are you sure you want to delete this game?</p>
            <p className="delete-warning">This action cannot be undone.</p>
            <div className="delete-modal-actions">
              <button
                className="delete-modal-btn cancel"
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button
                className="delete-modal-btn confirm"
                onClick={() => confirmDelete(showDeleteConfirm)}
              >
                Delete
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
