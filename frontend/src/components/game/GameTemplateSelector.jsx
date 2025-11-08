import React, { useState, useEffect } from 'react';
import { PlayIcon, EditIcon, TrashIcon, PlusIcon, ListIcon } from '@/components/ui/Icon';
import { LocalTableGameTemplate, LocalTableGameStorage } from '@/shared/api';
import AddGameTemplateModal from '@/components/modals/AddGameTemplateModal';
import LoadTableGameDialog from '@/components/modals/LoadTableGameDialog';
import '@/styles/components/GameTemplateSelector.css';

const GameTemplateSelector = ({ onSelectTemplate, onCreateNew, onLoadGame }) => {
  const [templates, setTemplates] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [filterGameName, setFilterGameName] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    const templatesList = LocalTableGameTemplate.getTemplatesList();
    setTemplates(templatesList);
  };

  const getSavedGamesCount = (templateName) => {
    const allSavedGames = LocalTableGameStorage.getSavedTableGamesList();
    return allSavedGames.filter(game => game.name === templateName).length;
  };

  const handleSelectTemplate = (template) => {
    // Record usage
    LocalTableGameTemplate.recordTemplateUsage(template.id);
    onSelectTemplate(template.name, {
      targetNumber: template.targetNumber,
      lowIsBetter: template.lowIsBetter
    });
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
    // Save as template with settings
    LocalTableGameTemplate.saveTemplate(gameName, settings);
    onCreateNew(gameName, settings);
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
          handleLoadGame({ ...gameData, gameName: savedGame.name, gameId: gamesForTemplate[0].id });
        }
      }
    } else {
      // Multiple games - show load dialog filtered to this template
      setFilterGameName(templateName);
      setShowLoadDialog(true);
    }
  };

  return (
    <div className="game-template-selector">
      <div className="template-selector-header">
        <h2>Select a Gametype</h2>
        {/* <p>Choose from your saved games or create a new one</p> */}
      </div>

      <div className="template-list">
        {templates.length > 0 ? (
          templates.map((template) => (
            <div
              key={template.id}
              className="template-item"
              onClick={() => handleSelectTemplate(template)}
            >
              <div className="template-info">
                <div className="template-name-row">
                  <div className="template-name">{template.name}</div>
                   <div className="template-meta">
                    {(() => {
                      const savedCount = getSavedGamesCount(template.name);
                      return savedCount > 0 ? (
                        <span className="template-usage">
                          {savedCount} saved {savedCount === 1 ? 'game' : 'games'}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <button
                    className="template-action-btn edit-btn-inline"
                    onClick={(e) => handleEditClick(template, e)}
                    title="Edit Name"
                  >
                    <EditIcon size={16} />
                  </button>
                </div>
               
              </div>
              <div className="template-actions">
                <button
                  className="template-action-btn play-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectTemplate(template);
                  }}
                  title="Start New Game"
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
                <button
                  className="template-action-btn delete-btn"
                  onClick={(e) => handleDeleteClick(template.id, e)}
                  title="Delete Game Type"
                >
                  <TrashIcon size={18} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="no-templates">
            <p>No saved games yet.</p>
            <p>Create your first game below!</p>
          </div>
        )}
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
        }}
        onSave={handleSaveEdit}
        editMode={true}
        initialData={editingTemplate}
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
    </div>
  );
};

export default GameTemplateSelector;
