import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/shared/hooks/useUser';
import Icon, { CheckMarkIcon, TrophyIcon, UsersIcon, ShieldIcon } from '@/components/ui/Icon';
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
      <Icon name="Megaphone" size={40} className="call-made-speaker-icon" />
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

  const links = [
    {
      to: '/start?type=scoreboard',
      label: t('gamesPage.scoreboardGames'),
      description: t('gamesPage.scoreboardDescription'),
      Icon: ScoreboardIcon,
      customIcon: true,
    },
    {
      to: '/start?type=call-made',
      label: t('gamesPage.callAndMadeGames'),
      description: t('gamesPage.callAndMadeDescription'),
      Icon: CallAndMadeIcon,
      customIcon: true,
    },
    {
      to: '/start?type=table',
      label: t('gamesPage.tableGames'),
      description: t('gamesPage.tableDescription'),
      Icon: TableTemplateIcon,
      customIcon: true,
    },
    {
      to: '/leaderboard',
      label: t('nav.leaderboard'),
      description: t('gamesPage.leaderboardDescription'),
      Icon: TrophyIcon,
      iconSize: 48
    },
    {
      to: '/friend-leaderboard',
      label: t('nav.friendCompareShort'),
      description: t('gamesPage.friendsDescription'),
      Icon: UsersIcon,
      iconSize: 48
    },
  ];

  if (user?.role === 'admin') {
    links.push({
      to: '/admin',
      label: t('nav.adminPanel'),
      description: t('gamesPage.adminDescription'),
      Icon: ShieldIcon,
      iconSize: 48
    });
  }

  return (
    <div className="games-page">

      <div className="games-link-grid">
        {links.map((item) => {
          const LinkIcon = item.Icon;
          return (
          <Link key={item.to} to={item.to} className="games-link-card">
            <div className="games-link-icon" aria-hidden="true">
              {item.customIcon ? <LinkIcon /> : <LinkIcon size={item.iconSize ?? 28} />}
            </div>
            <div className="games-link-text">
              <h2>{item.label}</h2>
              <p>{item.description}</p>
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
};

export default GamesPage;
