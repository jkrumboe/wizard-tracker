import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/shared/hooks/useUser';
import { BarChartIcon, GamepadIcon, ListIcon, TrophyIcon, UsersIcon, ShieldIcon } from '@/components/ui/Icon';
import '@/styles/pages/gamesPage.css';

const GamesPage = () => {
  const { t } = useTranslation();
  const { user } = useUser();

  const links = [
    {
      to: '/start?type=scoreboard',
      label: t('gamesPage.scoreboardGames'),
      description: t('gamesPage.scoreboardDescription'),
      Icon: BarChartIcon,
    },
    {
      to: '/start?type=call-made',
      label: t('gamesPage.callAndMadeGames'),
      description: t('gamesPage.callAndMadeDescription'),
      Icon: GamepadIcon,
    },
    {
      to: '/start?type=table',
      label: t('gamesPage.tableGames'),
      description: t('gamesPage.tableDescription'),
      Icon: ListIcon,
    },
    {
      to: '/leaderboard',
      label: t('nav.leaderboard'),
      description: t('gamesPage.leaderboardDescription'),
      Icon: TrophyIcon,
    },
    {
      to: '/friend-leaderboard',
      label: t('nav.friendCompareShort'),
      description: t('gamesPage.friendsDescription'),
      Icon: UsersIcon,
    },
  ];

  if (user?.role === 'admin') {
    links.push({
      to: '/admin',
      label: t('nav.adminPanel'),
      description: t('gamesPage.adminDescription'),
      Icon: ShieldIcon,
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
              <LinkIcon size={22} />
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
