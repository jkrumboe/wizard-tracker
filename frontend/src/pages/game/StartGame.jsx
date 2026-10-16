"use client"

import { useState, useEffect, useMemo } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useGameStateContext } from "@/shared/hooks/useGameState"
import { useUser } from "@/shared/hooks/useUser"
import { userService, LocalTableGameStorage, LocalScoreboardGameStorage, LocalTableGameTemplate } from "@/shared/api"
import { secureArrayShuffle, generateSecureId } from "@/shared/utils/secureRandom"
import { SelectFriendsModal, AddPlayersChoiceModal, SelectRecentGroupModal } from '@/components/modals'
import AddGameTemplateModal from '@/components/modals/AddGameTemplateModal'
import ScanBarcodeModal from '@/components/modals/ScanBarcodeModal'
import GameThumbnail from '@/components/game/GameThumbnail'
import PlayerSetup from '@/components/game/PlayerSetup'
import TeamBuilderSetup from '@/components/game/TeamBuilderSetup'
import { useTranslation } from 'react-i18next'
import { ClockIcon, PauseIcon, PlusIcon, ScanBarcodeIcon, SearchIcon, XIcon } from '@/components/ui/Icon'
import BackButton from '@/components/ui/BackButton'
import { resolveTemplateByName, isScoreboardTemplate } from '@/shared/utils/templateResolver'
import { useGameTemplates } from '@/shared/hooks/useGameTemplates'
import { useGameHistory } from '@/shared/hooks/useGameHistory'
import { gameBelongsToTemplate } from '@/shared/utils/templateGames'
import { getResumableGames } from '@/shared/utils/resumableGames'
import { formatLastPlayed } from '@/shared/utils/formatLastPlayed'
import '@/styles/pages/startGame.css'
import '@/styles/components/players.css'
import '@/styles/components/components.css'
import '@/styles/pages/gamesPage.css'
import '@/styles/pages/gameType.css'

const MAX_PLAYERS_WIZARD = 8;
const MAX_PLAYERS_TABLE = 10;
const MIN_PLAYERS_WIZARD = 3;
const MIN_PLAYERS_TABLE = 2;

const StartGame = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useUser();
  const {
    startGameWithSetup,
  } = useGameStateContext();
  const { templates: allTemplates } = useGameTemplates();
  const { games: finishedGames } = useGameHistory();

  const startType = searchParams.get('type');
  // Set by the barcode scanner to jump straight to a game's setup page
  const templateParam = searchParams.get('template');
  const addTemplateType = { 'call-made': 'callAndMade', scoreboard: 'scoreboard', table: 'table' }[startType] || null;

  // View state
  const [activeView, setActiveView] = useState('select'); // 'select' or 'setup'
  const [selectedGameType, setSelectedGameType] = useState(null); // null or template object

  // Player state (local, not from game context)
  const [players, setPlayers] = useState([]);
  const [hasInitializedUser, setHasInitializedUser] = useState(false);

  // Wizard settings
  const [maxRounds, setMaxRoundsLocal] = useState(20);
  const [totalCards, setTotalCards] = useState(60);

  const [_friends, setFriends] = useState([]);

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

  // Game list search
  const [templateSearch, setTemplateSearch] = useState('');

  // Add game type modal
  const [showAddGameModal, setShowAddGameModal] = useState(false);

  // Barcode scanner
  const [showScanModal, setShowScanModal] = useState(false);
  const [templateNotFound, setTemplateNotFound] = useState('');


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
    if (selectedGameType?.maxPlayers != null) return selectedGameType.maxPlayers;
    return 100;
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
    if (selectedRecentGroup?.groupId === group.groupId) {
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
    // Picking a group is the confirmation, so there is nothing left to do in the sheet
    setShowSelectRecentGroupModal(false);
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

  // Open the setup page for ?template=<name>, then drop the param so scanning
  // the same game again (or going back) behaves like a fresh selection
  useEffect(() => {
    if (!templateParam) return undefined;
    let cancelled = false;

    const openTemplateFromParam = async () => {
      const template = await resolveTemplateByName(templateParam);
      if (cancelled) return;
      if (template) {
        setTemplateNotFound('');
        handleSelectTemplate(template);
      } else {
        setTemplateNotFound(templateParam);
      }
      setSearchParams((params) => {
        params.delete('template');
        return params;
      }, { replace: true });
    };

    void openTemplateFromParam();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateParam]);

  // Setup is opened from a game's page (?template=), so go back there
  const handleBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }
    if (selectedGameType?.name) {
      navigate(`/game-types/${encodeURIComponent(selectedGameType.name)}`, { replace: true });
      return;
    }
    setActiveView('select');
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
      // Lets the game's page list it under the template it was started from
      templateName: selectedGameType.name,
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
      navigate(`/scoreboard/${newGameId}`, { state: { gameName: template.name, startType } });
      return;
    }
    navigate(`/table/${newGameId}`, { state: { gameName: template.name, startType } });
  };

  const handleStartGame = () => {
    if (isCallAndMade) {
      handleStartCallAndMadeGame();
    } else {
      handleStartTableGame();
    }
  };

  // --- Template list ---
  const handleCreateNewTemplate = (gameName, settings = {}) => {
    if (gameName?.trim()) {
      LocalTableGameTemplate.saveTemplate(gameName.trim(), settings);
      globalThis.dispatchEvent(new CustomEvent('templateCreated', { detail: { templateName: gameName.trim(), settings } }));
    }
  };

  // The "New game" pills on the Games page open this list for one type (?type=)
  const visibleTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    return allTemplates
      .filter((tpl) => {
        if (startType === 'call-made') return tpl.gameCategory === 'callAndMade';
        if (startType === 'scoreboard') return isScoreboardTemplate(tpl);
        if (startType === 'table') return tpl.gameCategory !== 'callAndMade' && !isScoreboardTemplate(tpl);
        return true;
      })
      .filter((tpl) => !query || tpl.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTemplates, templateSearch, startType]);

  // Played/paused stats per type for the list rows
  const templateStats = useMemo(() => {
    const pausedGames = activeView === 'select' ? getResumableGames({ limit: null }) : []
    return new Map(visibleTemplates.map((template) => {
      const played = finishedGames.filter((game) => gameBelongsToTemplate(game, template))
      const paused = pausedGames.filter((game) => gameBelongsToTemplate(game, template))
      const lastPlayed = Math.max(
        ...played.map((game) => new Date(game.created_at).getTime() || 0),
        ...paused.map((game) => new Date(game.lastPlayed).getTime() || 0),
        0,
      )
      return [template, { playedCount: played.length, pausedCount: paused.length, lastPlayed }]
    }))
  }, [visibleTemplates, finishedGames, activeView])

  const listTitle = {
    'call-made': t('gamesPage.callAndMadeGames'),
    table: t('gamesPage.tableGames'),
    scoreboard: t('gamesPage.scoreboardGames'),
  }[startType] || t('gameTemplates.templatesSection');

  // --- Derived values ---
  const maxPlayers = getMaxPlayersForSelection();
  const minPlayers = selectedGameType?.minPlayers
    ?? (isTwoSideScoreboard ? 2 : (isCallAndMade ? MIN_PLAYERS_WIZARD : MIN_PLAYERS_TABLE));
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

  // --- RENDER ---

  // Game type selection view: one row per game (box art + name)
  if (activeView === 'select') {
    return (
      <div className="game-type-page start-select-page">
        <header className="game-type-header">
          <BackButton fallback="/games" />
          <h1 className="games-title game-type-title">{listTitle}</h1>
          <nav className="games-quick-links">
            {/* Barcode lookups need an account (BGG API terms) */}
            {user && (
              <button
                type="button"
                className="games-quick-link"
                onClick={() => setShowScanModal(true)}
                aria-label={t('home.scanGame')}
                title={t('home.scanGame')}
              >
                <ScanBarcodeIcon size={18} aria-hidden="true" />
                <span className="games-quick-link-label">{t('home.scanGame')}</span>
              </button>
            )}
            <button
              type="button"
              className="games-quick-link"
              onClick={() => setShowAddGameModal(true)}
              aria-label={t('gameTemplates.addNewGameType')}
              title={t('gameTemplates.addNewGameType')}
            >
              <PlusIcon size={18} aria-hidden="true" />
              <span className="games-quick-link-label">{t('gameType.add')}</span>
            </button>
          </nav>
        </header>

        {templateNotFound && (
          <div className="error-message" role="alert">
            {t('scanBarcode.templateNotFound', { name: templateNotFound })}
          </div>
        )}

        <div className="games-filter-bar">
          <div className="games-search-wrapper">
            <SearchIcon size={16} className="games-search-icon" />
            <input
              type="text"
              className="games-search-input"
              placeholder={t('gameType.searchGames')}
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
            />
            {templateSearch && (
              <button
                className="games-search-clear"
                onClick={() => setTemplateSearch('')}
                aria-label={t('common.clear')}
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {visibleTemplates.length > 0 ? (
          <div className="game-row-list">
            {visibleTemplates.map((template) => {
              const { playedCount, pausedCount, lastPlayed } = templateStats.get(template)
              return (
              <Link
                key={template._id || template.id || template.name}
                to={`/game-types/${encodeURIComponent(template.name)}`}
                className="game-row"
              >
                <span className="game-row-art">
                  <span className="game-row-initial" aria-hidden="true">{template.name.charAt(0)}</span>
                  <GameThumbnail template={template} />
                </span>
                <span className="game-row-text">
                  <span className="game-row-name">{template.name}</span>
                  <span className="game-row-meta">
                    <ClockIcon size={12} aria-hidden="true" />
                    <span className="game-row-meta-text">
                      {lastPlayed
                        ? t('gameType.lastPlayed', { when: formatLastPlayed(lastPlayed, i18n.language) })
                        : t('gameType.notPlayedYet')}
                    </span>
                    {pausedCount > 0 && (
                      <span className="game-row-paused">
                        <PauseIcon size={11} aria-hidden="true" />
                        {t('gameType.pausedCount', { count: pausedCount })}
                      </span>
                    )}
                  </span>
                </span>
                <span className="game-row-count">
                  <span className="game-row-count-value">{playedCount}</span>
                  <span className="game-row-count-label">{t('gameType.gamesLabel', { count: playedCount })}</span>
                </span>
              </Link>
              )
            })}
          </div>
        ) : (
          <p className="empty-message">{t('gameType.noMatches')}</p>
        )}

        <AddGameTemplateModal
          isOpen={showAddGameModal}
          onClose={() => setShowAddGameModal(false)}
          onSave={handleCreateNewTemplate}
          templateType={addTemplateType}
        />

        <ScanBarcodeModal
          isOpen={showScanModal && Boolean(user)}
          onClose={() => setShowScanModal(false)}
        />
      </div>
    );
  }

  // Setup view
  return (
    <div className="start-game-page">
      <div className="setup-view">
        <div className="setup-header">
          <BackButton onClick={handleBack} />
          <h2>{selectedGameType?.name}</h2>
        </div>

        {isTwoSideScoreboard ? (
          <TeamBuilderSetup
            players={players}
            onAddPlayer={handleAddPlayer}
            onRemovePlayer={handleRemovePlayer}
            onPlayerNameChange={handlePlayerNameChange}
            onMovePlayerToOtherTeam={handleMovePlayerToOtherTeam}
            onRandomize={handleRandomize}
            onAddFriends={() => setShowAddPlayersChoiceModal(true)}
            maxPlayers={maxPlayers}
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
            onRandomize={handleRandomize}
            onAddFriends={() => setShowAddPlayersChoiceModal(true)}
            onPlayerTeamChange={handlePlayerTeamChange}
            isTwoSideScoreboard={isTwoSideScoreboard}
            maxPlayers={maxPlayers}
            minPlayers={minPlayers}
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
            className="setup-start-btn"
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
        selectedGroupId={selectedRecentGroup?.groupId}
        alreadySelectedPlayers={players.filter(p => p.userId || p.name).map(p => ({ userId: p.userId, name: p.name }))}
      />
    </div>
  );
};

export default StartGame;
