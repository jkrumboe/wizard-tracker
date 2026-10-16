import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/shared/hooks/useUser';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useGameHistory } from '@/shared/hooks/useGameHistory';
import { useTemplateLookup } from '@/shared/hooks/useGameTemplates';
import Icon, { CheckMarkIcon, ChevronDownIcon, SearchIcon, XIcon } from '@/components/ui/Icon';
import GameHistoryItem from '@/components/game/GameHistoryItem';
import GameFilterModal from '@/components/modals/GameFilterModal';
import { createGame } from '@/shared/api/gameService';
import { LocalTableGameStorage } from '@/shared/api/localTableGameStorage';
import { LocalGameStorage } from '@/shared/api/localGameStorage';
import { LocalScoreboardGameStorage } from '@/shared/api/localScoreboardGameStorage';
import { filterGames, getDefaultFilters } from '@/shared/utils/gameFilters';
import '@/styles/pages/gamesPage.css';

// Custom icon for scoreboard games showing two team squares
const ScoreboardIcon = () => (
  <div className="mode-icon mode-icon-scoreboard">
    <span className="mode-tile mode-tile-team-a">A</span>
    <span className="mode-tile mode-tile-team-b">B</span>
  </div>
);

// Visual cue for call-and-made scoring: call first, then made result.
const CallAndMadeIcon = () => (
  <div className="mode-icon mode-icon-call-made">
    <span className="call-made-speaker-wrap" aria-hidden="true">
      <Icon name="Megaphone" size={40} strokeWidth={1.5} className="call-made-speaker-icon" />
      <span className="call-made-check">
        <CheckMarkIcon size={20} />
      </span>
    </span>
  </div>
);

// Visual cue for table score sheets.
const TableTemplateIcon = () => (
  <div className="mode-icon mode-icon-table-template">
    <div className="score-sheet-icon">
      <div className="score-sheet-row score-sheet-head">
        <span className="score-round-col">Rd</span>
        <span className="score-value-col">Pts</span>
      </div>
      <div className="score-sheet-row">
        <span className="score-round-col">1</span>
        <span className="score-value-col score-line" />
      </div>
      <div className="score-sheet-row">
        <span className="score-round-col">2</span>
        <span className="score-value-col score-line" />
      </div>
      <div className="score-sheet-row">
        <span className="score-round-col">3</span>
        <span className="score-value-col score-line" />
      </div>
    </div>
  </div>
);

const GamesPage = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const { isOnline } = useOnlineStatus();

  const { games: allGames, loading, syncStatuses: gameSyncStatuses } = useGameHistory();
  const findTemplate = useTemplateLookup();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState(getDefaultFilters());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredGames = useMemo(() => {
    let games = filterGames(allGames, filters);
    if (typeFilter !== 'all') {
      games = games.filter(game => game.gameType === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      games = games.filter(game => {
        const name = (game.name || game.gameType || '').toLowerCase();
        const players = (game.players || [])
          .map(p => typeof p === 'string' ? p : (p.name || '')).join(' ').toLowerCase();
        return name.includes(q) || players.includes(q);
      });
    }
    return games;
  }, [allGames, filters, searchQuery, typeFilter]);

  const handleApplyFilters = (newFilters) => setFilters(newFilters);

  // Auto-upload local games (all types) scored while not logged in
  useEffect(() => {
    if (!user || !isOnline) return;

    const uploadPendingGames = async () => {
      try {
        const { createTableGame } = await import('@/shared/api/tableGameService');

        // Wizard games
        const localGames = LocalGameStorage.getAllSavedGames();
        const unsyncedWizard = Object.entries(localGames).filter(([, game]) =>
          game.gameFinished && !game.isUploaded && !game.isImported && !game.isShared && !game.originalGameId
        );
        for (let i = 0; i < unsyncedWizard.length; i++) {
          const [gameId, gameData] = unsyncedWizard[i];
          try {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));
            const result = await createGame(gameData, gameId);
            if (result?.game?.id) LocalGameStorage.markGameAsUploaded(gameId, result.game.id);
          } catch { /* silent fail */ }
        }

        // Table games
        const allTableGames = LocalTableGameStorage.getAllSavedTableGamesAllUsers();
        const unsyncedTable = Object.entries(allTableGames).filter(([, game]) =>
          game.gameFinished && !game.isUploaded
        );
        for (let i = 0; i < unsyncedTable.length; i++) {
          const [gameId, record] = unsyncedTable[i];
          try {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));
            const gameData = record.gameData?.gameData || record.gameData || record;
            const result = await createTableGame(gameData, gameId);
            if (result?.game?._id) LocalTableGameStorage.markGameAsUploaded(gameId, result.game._id);
          } catch { /* silent fail */ }
        }

        // Scoreboard games
        const allScoreboardGames = LocalScoreboardGameStorage.getAllSavedTableGamesAllUsers();
        const unsyncedScoreboard = Object.entries(allScoreboardGames).filter(([, game]) =>
          game.gameFinished && !game.isUploaded
        );
        for (let i = 0; i < unsyncedScoreboard.length; i++) {
          const [gameId, record] = unsyncedScoreboard[i];
          try {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));
            const gameData = record.gameData?.gameData || record.gameData || record;
            const result = await createTableGame(gameData, gameId);
            if (result?.game?._id) LocalScoreboardGameStorage.markGameAsUploaded(gameId, result.game._id);
          } catch { /* silent fail */ }
        }
      } catch { /* silent fail */ }
    };

    const timer = setTimeout(uploadPendingGames, 1500);
    return () => clearTimeout(timer);
  }, [user, isOnline]);

  const startLinks = [
    { to: '/start?type=call-made',  label: t('gamesPage.callAndMadeGames'), icon: 'Wand2'  },
    { to: '/start?type=table',      label: t('gamesPage.tableGames'),       icon: 'Dices'  },
    { to: '/start?type=scoreboard', label: t('gamesPage.scoreboardGames'),  icon: 'Target' },
  ];

  const quickLinks = [
    { to: '/leaderboard',        label: t('nav.leaderboard'),        icon: 'Trophy' },
    { to: '/friend-leaderboard', label: t('nav.friendCompareShort'), icon: 'Swords' },
  ];

  if (user?.role === 'admin') {
    quickLinks.push({ to: '/admin', label: t('nav.adminPanel'), icon: 'ShieldCheck' });
  }

  const typeOptions = [
    { value: 'all',        label: t('gamesPage.allTypes') },
    { value: 'wizard',     label: 'Wizard' },
    { value: 'table',      label: t('gamesPage.tableGames') },
    { value: 'scoreboard', label: t('gamesPage.scoreboardGames') },
  ];

  return (
    <div className="games-page">

      <header className="games-header">
        <h1 className="games-title">{t('nav.games')}</h1>
        <nav className="games-quick-links">
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="games-quick-link"
              aria-label={item.label}
              title={item.label}
            >
              <Icon name={item.icon} size={18} strokeWidth={2} aria-hidden="true" />
              <span className="games-quick-link-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </header>

      <section className="games-start" aria-label={t('nav.newGame')}>
        <span className="games-section-label">{t('nav.newGame')}</span>
        <div className="games-start-row">
          {startLinks.map((item) => (
            <Link key={item.to} to={item.to} className="games-start-pill">
              <Icon name={item.icon} size={18} strokeWidth={2} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="games-history-section">

        <div className="games-filter-bar">
          <div className="games-search-wrapper">
            <SearchIcon size={16} className="games-search-icon" />
            <input
              type="text"
              className="games-search-input"
              placeholder={t('account.searchGames')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="games-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
          <div className="games-type-select-wrapper">
            <select
              className="games-type-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label={t('gamesPage.typeFilter')}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDownIcon size={16} className="games-type-select-icon" aria-hidden="true" />
          </div>
        </div>

        <div className="games-list-header">
          <span className="games-list-count">
            {t('account.gamesCount', { count: filteredGames.length })}
          </span>
        </div>

        {filteredGames.length > 0 ? (
          <div className="game-history">
            {filteredGames.map(game => (
              <GameHistoryItem
                findTemplate={findTemplate}
                key={game.id}
                game={{
                  ...game,
                  isUploaded: game.gameType === 'table'
                    ? game.isUploaded
                    : gameSyncStatuses[game.id]?.synced || game.isUploaded
                }}
              />
            ))}
          </div>
        ) : loading ? (
          <div className="loading-message">{t('home.loadingGames')}</div>
        ) : (
          <div className="empty-message">
            {allGames.length > 0 ? t('home.noGamesMatchFilters') : t('home.noGamesFound')}
          </div>
        )}
      </section>

      <GameFilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApplyFilters={handleApplyFilters}
        initialFilters={filters}
      />
    </div>
  );
};

export default GamesPage;
