"use client"

import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useGameStateContext } from "@/shared/hooks/useGameState"
import { useUser } from "@/shared/hooks/useUser"
import { userService, LocalTableGameStorage, LocalScoreboardGameStorage, LocalTableGameTemplate } from "@/shared/api"
import { secureArrayShuffle, generateSecureId } from "@/shared/utils/secureRandom"
import { SelectFriendsModal, AddPlayersChoiceModal, SelectRecentGroupModal } from '@/components/modals'
import WizardGameHistoryModal from '@/components/modals/WizardGameHistoryModal'
import AddGameTemplateModal from '@/components/modals/AddGameTemplateModal'
import GameTemplateSelector from '@/components/game/GameTemplateSelector'
import PlayerSetup from '@/components/game/PlayerSetup'
import TeamBuilderSetup from '@/components/game/TeamBuilderSetup'
import { useTranslation } from 'react-i18next'
import { ArrowLeftIcon, ArrowLeftCircleIcon, PlusIcon } from '@/components/ui/Icon'
import '@/styles/pages/startGame.css'
import '@/styles/components/players.css'
import '@/styles/components/components.css'
import '@/styles/components/GameTemplateSelector.css'

const MAX_PLAYERS_WIZARD = 8;
const MAX_PLAYERS_TABLE = 10;
const MIN_PLAYERS_WIZARD = 3;
const MIN_PLAYERS_TABLE = 2;

const StartGame = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const {
    startGameWithSetup,
    resumeGame,
  } = useGameStateContext();

  const startType = searchParams.get('type');
  const selectorGameCategory = startType === 'call-made' ? 'callAndMade' : (startType === 'scoreboard' || startType === 'table' ? 'table' : undefined);
  const selectorTableMode = startType === 'scoreboard' ? 'scoreboard' : (startType === 'table' ? 'table' : 'all');

  // View state
  const [activeView, setActiveView] = useState('select'); // 'select' or 'setup'
  const [selectedGameType, setSelectedGameType] = useState(null); // null or template object

  // Player state (local, not from game context)
  const [players, setPlayers] = useState([]);
  const [hasInitializedUser, setHasInitializedUser] = useState(false);

  // Wizard settings
  const [maxRounds, setMaxRoundsLocal] = useState(20);
  const [totalCards, setTotalCards] = useState(60);

  // User lookup state
  const [lookingUpPlayers, setLookingUpPlayers] = useState(new Set());
  const [friends, setFriends] = useState([]);

  // Scoreboard team naming
  const [teamNames, setTeamNames] = useState({
    teamOne: t('startTableGame.teamOne'),
    teamTwo: t('startTableGame.teamTwo'),
  });

  // Friends modal
  const [showAddPlayersChoiceModal, setShowAddPlayersChoiceModal] = useState(false);
  const [showSelectFriendsModal, setShowSelectFriendsModal] = useState(false);
  const [showSelectRecentGroupModal, setShowSelectRecentGroupModal] = useState(false);
  const [selectedRecentGroup, setSelectedRecentGroup] = useState(null);

  // Wizard game history modal
  const [showWizardHistoryModal, setShowWizardHistoryModal] = useState(false);
  const [resumeErrorMessage, setResumeErrorMessage] = useState('');

  // Add game type modal
  const [showAddGameModal, setShowAddGameModal] = useState(false);

  // Details modal and edit system template modal are now handled by GameTemplateSelector

  // Initialize player list with logged-in user
  useEffect(() => {
    if (user?.username && !hasInitializedUser && players.length === 0) {
      setPlayers([{
        id: `player-${Date.now()}-0`,
        name: user.username,
        userId: user.id || null,
        teamIndex: 0,
      }]);
      setHasInitializedUser(true);
    }
  }, [user, hasInitializedUser, players.length]);

  // Load friends list
  useEffect(() => {
    const loadFriends = async () => {
      if (!user?.id || !navigator.onLine) {
        setFriends([]);
        return;
      }
      try {
        const cloudFriends = await userService.getFriends(user.id);
        setFriends(cloudFriends);
      } catch (err) {
        console.warn('Could not fetch friends:', err);
        setFriends([]);
      }
    };
    loadFriends();
  }, [user]);

  // --- Player management ---
  const isCallAndMade = selectedGameType?.gameCategory === 'callAndMade';
  const normalizedSelectedGameTypeName = (selectedGameType?.name || '').trim().toLowerCase();
  const isTwoSideScoreboard = selectedGameType?.scoreEntryMode === 'twoSideGesture'
    || normalizedSelectedGameTypeName === 'volleyball'
    || normalizedSelectedGameTypeName === 'basketball';

  const getMaxPlayersForSelection = () => {
    if (isTwoSideScoreboard) return MAX_PLAYERS_TABLE;
    return isCallAndMade ? MAX_PLAYERS_WIZARD : MAX_PLAYERS_TABLE;
  };

  const getBalancedTeamIndex = (currentPlayers) => {
    const teamOneCount = currentPlayers.filter((p) => (p.teamIndex ?? 0) === 0).length;
    const teamTwoCount = currentPlayers.filter((p) => (p.teamIndex ?? 0) === 1).length;
    return teamOneCount <= teamTwoCount ? 0 : 1;
  };

  const normalizeName = (value) => (value || '').trim().toLowerCase();

  const isSamePerson = (a, b) => {
    if (!a || !b) return false;
    if (a.userId && b.userId) return a.userId === b.userId;
    return normalizeName(a.name) !== '' && normalizeName(a.name) === normalizeName(b.name);
  };

  const appendUniquePlayers = (prevPlayers, candidates, maxPlayers) => {
    const working = [...prevPlayers];

    for (const candidate of candidates) {
      const alreadyAdded = working.some((existing) => isSamePerson(existing, candidate));
      if (alreadyAdded) continue;
      if (working.length >= maxPlayers) break;

      const teamIndex = isTwoSideScoreboard ? getBalancedTeamIndex(working) : undefined;
      working.push({ ...candidate, teamIndex });
    }

    return working;
  };

  const handleAddPlayer = (teamIndex = null) => {
    const maxPlayers = getMaxPlayersForSelection();
    if (players.length >= maxPlayers) return;

    const resolvedTeamIndex = isTwoSideScoreboard
      ? (teamIndex === 0 || teamIndex === 1 ? teamIndex : getBalancedTeamIndex(players))
      : undefined;

    setPlayers(prev => [
      ...prev,
      {
        id: `player-${Date.now()}-${prev.length}`,
        name: '',
        userId: null,
        teamIndex: resolvedTeamIndex,
      }
    ]);
  };

  const handleRemovePlayer = (playerId) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const handleReorderPlayers = (oldIndex, newIndex) => {
    setPlayers(prev => {
      const newPlayers = [...prev];
      const [removed] = newPlayers.splice(oldIndex, 1);
      newPlayers.splice(newIndex, 0, removed);
      return newPlayers;
    });
  };

  const handlePlayerNameChange = (playerId, name) => {
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, name, userId: null } : p
    ));
  };

  const handlePlayerTeamChange = (playerId, teamIndex) => {
    setPlayers((prev) => prev.map((p) =>
      p.id === playerId ? { ...p, teamIndex } : p
    ));
  };

  const handleMovePlayerToOtherTeam = (playerId) => {
    setPlayers((prev) => prev.map((p) => {
      if (p.id !== playerId) return p;
      const currentTeam = p.teamIndex === 1 ? 1 : 0;
      return { ...p, teamIndex: currentTeam === 0 ? 1 : 0 };
    }));
  };

  const handleTeamNameChange = (teamKey, value) => {
    setTeamNames((prev) => ({
      ...prev,
      [teamKey]: value,
    }));
  };

  const handlePlayerNameBlur = async (playerId, name) => {
    const trimmedName = name?.trim();
    if (!trimmedName) return;

    // Check logged-in user
    if (user && trimmedName.toLowerCase() === user.username?.toLowerCase()) {
      setPlayers(prev => prev.map(p =>
        p.id === playerId ? { ...p, name: user.username, userId: user.id } : p
      ));
      return;
    }

    // Check friends
    const matchingFriend = friends.find(f =>
      f.username.toLowerCase() === trimmedName.toLowerCase()
    );
    if (matchingFriend) {
      setPlayers(prev => prev.map(p =>
        p.id === playerId ? { ...p, name: matchingFriend.username, userId: matchingFriend.id } : p
      ));
      return;
    }

    // Backend lookup
    setLookingUpPlayers(prev => new Set([...prev, playerId]));
    try {
      const result = await userService.lookupUserByUsername(trimmedName);
      if (result.found && result.user) {
        setPlayers(prev => prev.map(p =>
          p.id === playerId ? { ...p, name: result.user.username, userId: result.user.id } : p
        ));
      }
    } catch (error) {
      console.warn('Error looking up user:', error);
    } finally {
      setLookingUpPlayers(prev => {
        const newSet = new Set(prev);
        newSet.delete(playerId);
        return newSet;
      });
    }
  };

  const handleRandomize = () => {
    if (players.length < 2) return;
    setPlayers(prev => secureArrayShuffle([...prev]));
  };

  const handleAddFriends = (selectedFriends) => {
    const maxPlayers = getMaxPlayersForSelection();
    const newPlayers = selectedFriends.map((friend, idx) => ({
      id: `player-${Date.now()}-friend-${idx}`,
      name: friend.username || friend.name,
      userId: friend.id,
    }));
    setPlayers((prev) => appendUniquePlayers(prev, newPlayers, maxPlayers));
    setShowSelectFriendsModal(false);
  };

  const handleSelectRecentGroup = (group) => {
    // Deselect if clicking the already-selected group
    if (selectedRecentGroup?.gameId === group.gameId) {
      setPlayers((prev) =>
        prev.filter(existing =>
          existing.userId === user?.id ||
          !selectedRecentGroup.players.some(old => isSamePerson(existing, old))
        )
      );
      setSelectedRecentGroup(null);
      return;
    }

    const maxPlayers = getMaxPlayersForSelection();
    const newPlayers = group.players.map((player, idx) => ({
      id: `player-${Date.now()}-recent-${idx}`,
      name: player.name,
      userId: player.userId,
    }));

    setPlayers((prev) => {
      // Remove players that came from the previously selected group (but not if they're in the new group too)
      let working = prev;
      if (selectedRecentGroup) {
        working = prev.filter(existing =>
          !selectedRecentGroup.players.some(old => isSamePerson(existing, old)) ||
          group.players.some(newP => isSamePerson(existing, newP))
        );
      }
      return appendUniquePlayers(working, newPlayers, maxPlayers);
    });
    setSelectedRecentGroup(group);
  };

  useEffect(() => {
    if (!isTwoSideScoreboard) return;
    setPlayers((prev) => prev.map((p, index) => ({
      ...p,
      teamIndex: p.teamIndex === 0 || p.teamIndex === 1 ? p.teamIndex : (index % 2),
    })));
  }, [isTwoSideScoreboard]);

  // --- Game type selection ---
  const handleSelectTemplate = (template) => {
    setSelectedGameType(template);
    setActiveView('setup');
    // Initialize maxRounds from template if it's a Call & Made game
    if (template.gameCategory === 'callAndMade' && template.maxRounds) {
      setMaxRoundsLocal(template.maxRounds);
    }
  };

  const handleBack = () => {
    setActiveView('select');
    // Keep players and selectedGameType so user can switch back
  };

  const handlePageBack = () => {
    if (globalThis.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/games');
  };

  // --- Start game ---
  const handleStartCallAndMadeGame = () => {
    const result = startGameWithSetup({
      players: players.map((p) => ({
        id: p.userId || p.id,
        name: p.name,
        isVerified: !!p.userId,
      })),
      maxRounds,
      templateConfig: {
      scoringFormula: selectedGameType.scoringFormula,
      roundPattern: selectedGameType.roundPattern || 'pyramid',
      hasDealerRotation: selectedGameType.hasDealerRotation !== false,
      hasForbiddenCall: selectedGameType.hasForbiddenCall !== false,
      },
    });

    if (!result?.success) {
      console.error('Failed to start Call & Made game:', result?.error);
      return;
    }

    navigate('/game/current');
  };

  const handleStartTableGame = () => {
    if (!selectedGameType) return;

    const template = selectedGameType;
    const normalizedTemplateName = (template.name || '').trim().toLowerCase();
    const scoreboardMode = template.scoreEntryMode === 'twoSideGesture'
      || normalizedTemplateName === 'volleyball'
      || normalizedTemplateName === 'basketball';
    const firstPlayerId = user?.id || generateSecureId('player');

    const initialPlayers = players.map((p, idx) => {
      let playerId;
      if (idx === 0) {
        playerId = p.userId || firstPlayerId;
      } else {
        playerId = p.userId || generateSecureId('player');
      }
      return {
        id: playerId,
        name: p.name,
        userId: p.userId,
        teamIndex: p.teamIndex,
        points: [],
      };
    });

    const defaultTeamOneName = t('startTableGame.teamOne');
    const defaultTeamTwoName = t('startTableGame.teamTwo');
    const teamOneName = teamNames.teamOne?.trim() || defaultTeamOneName;
    const teamTwoName = teamNames.teamTwo?.trim() || defaultTeamTwoName;

    const isSmallLandscape = globalThis.matchMedia('(orientation: landscape) and (max-width: 950px)').matches;
    const newRows = isSmallLandscape ? 8 : 10;

    const gameData = scoreboardMode
      ? {
          players: [
            { id: 'team-1', name: teamOneName, points: [] },
            { id: 'team-2', name: teamTwoName, points: [] },
          ],
          teamMembers: [
            initialPlayers.filter((p) => (p.teamIndex ?? 0) === 0),
            initialPlayers.filter((p) => (p.teamIndex ?? 0) === 1),
          ],
          rows: newRows,
          timestamp: new Date().toISOString(),
          targetNumber: template.targetNumber || null,
          lowIsBetter: template.lowIsBetter || false,
          gameFinished: false,
          gameName: template.name,
          scoreEntryMode: 'twoSideGesture',
          gameType: 'scoreboard',
        }
      : {
          players: initialPlayers,
          rows: newRows,
          timestamp: new Date().toISOString(),
          targetNumber: template.targetNumber || null,
          lowIsBetter: template.lowIsBetter || false,
          gameFinished: false,
          gameName: template.name,
          scoreEntryMode: template.scoreEntryMode || null,
        };

    const newGameId = scoreboardMode
      ? LocalScoreboardGameStorage.saveTableGame(gameData, template.name)
      : LocalTableGameStorage.saveTableGame(gameData, template.name);
    if (scoreboardMode) {
      navigate(`/scoreboard/${newGameId}`, { state: { gameName: template.name } });
      return;
    }
    navigate(`/table/${newGameId}`, { state: { gameName: template.name } });
  };

  const handleStartGame = () => {
    if (isCallAndMade) {
      handleStartCallAndMadeGame();
    } else {
      handleStartTableGame();
    }
  };

  // --- Template selector callbacks ---
  const handleTemplateSelectorSelect = (templateName, settings = {}) => {
    const template = { name: templateName, ...settings };
    handleSelectTemplate(template);
  };

  const handleCreateNewTemplate = (gameName, settings = {}) => {
    if (gameName?.trim()) {
      LocalTableGameTemplate.saveTemplate(gameName.trim(), settings);
    }
  };

  const handleLoadTableGame = (gameData) => {
    if (gameData?.gameId) {
      if (
        gameData.scoreEntryMode === 'twoSideGesture'
        || gameData.gameType === 'scoreboard'
        || gameData.gameName === 'Volleyball'
        || gameData.gameName === 'Basketball'
        || gameData.gameId?.startsWith('scoreboard_game')
      ) {
        navigate(`/scoreboard/${gameData.gameId}`);
        return;
      }
      navigate(`/table/${gameData.gameId}`);
    }
  };

  // --- Derived values ---
  const maxPlayers = isTwoSideScoreboard ? MAX_PLAYERS_TABLE : (isCallAndMade ? MAX_PLAYERS_WIZARD : MAX_PLAYERS_TABLE);
  const minPlayers = isTwoSideScoreboard ? 2 : (isCallAndMade ? MIN_PLAYERS_WIZARD : MIN_PLAYERS_TABLE);
  const teamOneCount = players.filter((p) => (p.teamIndex ?? 0) === 0).length;
  const teamTwoCount = players.filter((p) => (p.teamIndex ?? 0) === 1).length;
  const bothTeamsHavePlayers = !isTwoSideScoreboard || (teamOneCount > 0 && teamTwoCount > 0);
  const canStart = players.length >= minPlayers
    && players.length <= maxPlayers
    && players.every(p => p.name && p.name.trim().length > 0)
    && bothTeamsHavePlayers;

  const recommendedRounds = players.length >= 3
    ? Math.floor(totalCards / players.length)
    : 20;

  const handleMaxRoundsChange = (value) => {
    const validValue = Math.max(0, Math.min(value, 20));
    setMaxRoundsLocal(validValue);
  };

  // --- Wizard saved games helpers ---
  const handleSelectWizardGame = (game) => {
    // Navigate to the appropriate page based on game status
    if (game.isPaused || game.gameState?.isPaused) {
      // For paused games, resume and navigate to GameInProgress
      const result = resumeGame(game.id);
      const resumedPlayers = result?.gameState?.players;
      if (result.success && Array.isArray(resumedPlayers) && resumedPlayers.length > 0) {
        setResumeErrorMessage('');
        navigate(`/game/current`);
        return true;
      } else {
        console.error('Failed to resume game:', result.error);
        const message = t('gameHistory.resumeFailedCorrupted', {
          defaultValue: 'Could not resume this paused game. The save appears to be corrupted.'
        });
        setResumeErrorMessage(message);
        globalThis.dispatchEvent(new CustomEvent('show-toast', {
          detail: {
            message,
            type: 'error',
            duration: 6000
          }
        }));
        return false;
      }
    } else {
      // For finished games, navigate to GameDetails to view
      setResumeErrorMessage('');
      navigate(`/game/${game.id}`);
      return true;
    }
  };

  // --- RENDER ---

  // Game type selection view
  if (activeView === 'select') {
    return (
      <div className="start-game-page">
        <div className="game-type-selection">
          <div className="start-select-header">
            <button className="start-select-back-button" onClick={handlePageBack} title={t('common.back')}>
              <ArrowLeftCircleIcon size={30} />
            </button>
            <h3 className="template-section-title start-select-title">{t('gameTemplates.templatesSection')}</h3>
          </div>

          {resumeErrorMessage && (
            <div className="error-message" role="alert">
              {resumeErrorMessage}
            </div>
          )}

          {/* All game templates in one unified list */}
          <GameTemplateSelector
            onSelectTemplate={handleTemplateSelectorSelect}
            onCreateNew={handleCreateNewTemplate}
            onLoadGame={handleLoadTableGame}
            onLoadWizardGames={() => {
              setResumeErrorMessage('');
              setShowWizardHistoryModal(true);
            }}
            embedded
            gameCategory={selectorGameCategory}
            tableTemplateMode={selectorTableMode}
            hideSystemSectionTitle
            hideCreateButton
            alwaysShowSavedGamesModal
            savedGamesInitialStatus="paused"
          />

          {/* Single Add New Game Type button */}
          <div className="template-selector-actions">
            <button className="create-new-btn" onClick={() => setShowAddGameModal(true)}>
              <PlusIcon size={20} />
              {t('gameTemplates.addNewGameType')}
            </button>
          </div>

          <AddGameTemplateModal
            isOpen={showAddGameModal}
            onClose={() => setShowAddGameModal(false)}
            onSave={handleCreateNewTemplate}
          />

          <WizardGameHistoryModal
            isOpen={showWizardHistoryModal}
            onClose={() => {
              setShowWizardHistoryModal(false);
              setResumeErrorMessage('');
            }}
            onSelectGame={handleSelectWizardGame}
            initialStatusFilter="paused"
          />
        </div>
      </div>
    );
  }

  // Setup view
  return (
    <div className="start-game-page">
      <div className="setup-view">
        <div className="setup-header">
          <button className="setup-back-button" onClick={handleBack} title={t('common.back')}>
            <ArrowLeftIcon size={24} />
          </button>
          <h2>{selectedGameType?.name}</h2>
        </div>

        {isTwoSideScoreboard ? (
          <TeamBuilderSetup
            players={players}
            onAddPlayer={handleAddPlayer}
            onRemovePlayer={handleRemovePlayer}
            onPlayerNameChange={handlePlayerNameChange}
            onPlayerNameBlur={handlePlayerNameBlur}
            onMovePlayerToOtherTeam={handleMovePlayerToOtherTeam}
            onRandomize={handleRandomize}
            onAddFriends={() => setShowAddPlayersChoiceModal(true)}
            maxPlayers={maxPlayers}
            lookingUpPlayers={lookingUpPlayers}
            teamNames={teamNames}
            onTeamNameChange={handleTeamNameChange}
          />
        ) : (
          <PlayerSetup
            players={players}
            onAddPlayer={handleAddPlayer}
            onRemovePlayer={handleRemovePlayer}
            onReorderPlayers={handleReorderPlayers}
            onPlayerNameChange={handlePlayerNameChange}
            onPlayerNameBlur={handlePlayerNameBlur}
            onRandomize={handleRandomize}
            onAddFriends={() => setShowAddPlayersChoiceModal(true)}
            onPlayerTeamChange={handlePlayerTeamChange}
            isTwoSideScoreboard={isTwoSideScoreboard}
            maxPlayers={maxPlayers}
            minPlayers={minPlayers}
            lookingUpPlayers={lookingUpPlayers}
          />
        )}

        {/* Call & Made game settings */}
        {isCallAndMade && (
          <div className="game-settings-section">
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-content">
                  <div className="game-settings-input">
                    <div id="rounds">
                      <label htmlFor="rounds-input">{t('game.roundsLabel')}</label>
                      <input
                        id="rounds-input"
                        type="tel"
                        value={maxRounds}
                        onChange={(e) => handleMaxRoundsChange(parseInt(e.target.value) || 0)}
                        min={1}
                        max={recommendedRounds ? recommendedRounds : 20}
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                    </div>
                    <div id="cards">
                      <label htmlFor="cards-input">{t('game.cardsLabel')}</label>
                      <input
                        id="cards-input"
                        type="tel"
                        value={totalCards}
                        onChange={(e) => setTotalCards(parseInt(e.target.value) || 60)}
                        min={1}
                        max={100}
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                    </div>
                  </div>
                  <div className="rounds-hint">
                    {t('game.recommendedRounds', { n: recommendedRounds })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table game settings display */}
        {!isCallAndMade && selectedGameType && (
          <div className="game-settings-section">
            <div className="table-settings-display">
              {selectedGameType.targetNumber && (
                <div className="setting-item">
                  <span>{t('startTableGame.target')}: </span>
                  <p>{selectedGameType.targetNumber}</p>
                </div>
              )}

              {selectedGameType.lowIsBetter !== undefined && (
                <div className="setting-item">
                  <span>{t('startTableGame.goal')}: </span>
                  <p>{selectedGameType.lowIsBetter ? t('startTableGame.lowScore') : t('startTableGame.highScore')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Start button */}
        <div className="start-game-actions">
          <button
            className="start-game-btn"
            disabled={!canStart}
            onClick={handleStartGame}
          >
            {t('game.startGame')}
          </button>

          {players.length < minPlayers && (
            <div className="error-message">
              {isCallAndMade ? t('game.minPlayersError') : t('startTableGame.minPlayersError')}
            </div>
          )}

          {players.length > maxPlayers && (
            <div className="error-message">
              {isCallAndMade ? t('game.maxPlayersError') : t('startTableGame.minPlayersError')}
            </div>
          )}

          {players.length >= minPlayers && players.length <= maxPlayers && !players.every(p => p.name && p.name.trim().length > 0) && (
            <div className="error-message">
              {t('startTableGame.allPlayersNamedError')}
            </div>
          )}

          {players.length >= minPlayers && players.length <= maxPlayers && players.every(p => p.name && p.name.trim().length > 0) && !bothTeamsHavePlayers && (
            <div className="error-message">
              {t('startTableGame.bothTeamsRequiredError')}
            </div>
          )}
        </div>
      </div>

      <SelectFriendsModal
        isOpen={showSelectFriendsModal}
        onClose={() => setShowSelectFriendsModal(false)}
        onConfirm={handleAddFriends}
        alreadySelectedPlayers={players.filter(p => p.userId).map(p => ({ userId: p.userId, name: p.name }))}
      />

      <AddPlayersChoiceModal
        isOpen={showAddPlayersChoiceModal}
        onClose={() => setShowAddPlayersChoiceModal(false)}
        onSelectFriends={() => {
          setShowAddPlayersChoiceModal(false);
          setShowSelectFriendsModal(true);
        }}
        onSelectRecentGroup={() => {
          setShowAddPlayersChoiceModal(false);
          setShowSelectRecentGroupModal(true);
        }}
      />

      <SelectRecentGroupModal
        isOpen={showSelectRecentGroupModal}
        onClose={() => setShowSelectRecentGroupModal(false)}
        onSelectGroup={handleSelectRecentGroup}
        selectedGroupId={selectedRecentGroup?.gameId}
        alreadySelectedPlayers={players.filter(p => p.userId || p.name).map(p => ({ userId: p.userId, name: p.name }))}
      />
    </div>
  );
};

export default StartGame;
